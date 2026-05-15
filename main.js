// Electron 主进程入口
// 负责：创建窗口、IPC 通信、定时调度、系统托盘、通知

const { app, BrowserWindow, ipcMain, Notification, Menu } = require('electron')
const path = require('path')
const Store = require('./src/main/store')
const Api = require('./src/main/api')
const Scheduler = require('./src/main/scheduler')
const TrayManager = require('./src/main/tray')
const logger = require('./src/main/logger')
const { solarToLunar } = require('./src/main/lunar')

const store = new Store()
const api = new Api()

let mainWindow = null     // 贴纸窗口
let settingsWindow = null // 设置窗口
let scheduler = null
let trayManager = null

// 创建贴纸窗口：无边框、半透明
function createStickerWindow() {
  const settings = store.getSettings()
  mainWindow = new BrowserWindow({
    width: 280,
    height: 350,
    frame: false,            // 无标题栏
    transparent: true,       // 透明背景（毛玻璃效果）
    alwaysOnTop: settings.pinOnTop,
    resizable: false,
    skipTaskbar: true,       // 不在任务栏显示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'sticker', 'index.html'))

  mainWindow.once('ready-to-show', () => {
    if (settings.windowPosition) {
      mainWindow.setBounds(settings.windowPosition)
    }
    mainWindow.webContents.send('opacity-changed', settings.opacity ?? 1.0)
  })

  let moveTimer = null
  mainWindow.on('move', () => {
    clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds()
        store.updateSettings({ windowPosition: { x: bounds.x, y: bounds.y } })
      }
    }, 300)
  })
}

// 创建设置窗口
function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  settingsWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'settings', 'index.html'))
  // 点击关闭按钮时隐藏窗口而不是销毁（方便下次快速打开）
  settingsWindow.on('close', (e) => {
    e.preventDefault()
    settingsWindow.hide()
  })
}

// 发送 Windows 系统通知
function sendNotification(data) {
  if (data.subtype === 'today') {
    const n = new Notification({
      title: '📅 ' + data.title,
      body: data.type === 'holiday'
        ? `今天是 ${data.localName} 🎉`
        : `提醒：${data.title}`
    })
    n.show()
  }
}

// 向贴纸窗口广播更新后的节日数据
function broadcastHolidays() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    const holidays = [
      ...(store.getHolidayCache(currentYear) || []),
      ...(store.getHolidayCache(nextYear) || [])
    ].filter(Boolean)
    mainWindow.webContents.send('holiday-update', holidays)
  }
}

// ===== IPC 处理器 =====
// 渲染进程通过 preload.js 暴露的 holidayAPI 调用这些方法

function wrapIpc(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    try {
      return await fn(event, ...args)
    } catch (err) {
      logger.error(`IPC ${name} 失败`, err)
      throw err
    }
  })
}

wrapIpc('get-holidays', () => {
  const currentYear = String(new Date().getFullYear())
  const nextYear = String(new Date().getFullYear() + 1)
  return [
    ...(store.getHolidayCache(currentYear) || []),
    ...(store.getHolidayCache(nextYear) || [])
  ].filter(Boolean)
})

wrapIpc('get-settings', () => store.getSettings())
wrapIpc('update-settings', (_, settings) => {
  store.updateSettings(settings)
  if (settings.autoStart !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.autoStart })
  }
})
wrapIpc('get-custom-reminders', () => store.getCustomReminders())
wrapIpc('add-custom-reminder', (_, r) => store.addCustomReminder(r))
wrapIpc('update-custom-reminder', (_, id, r) => store.updateCustomReminder(id, r))
wrapIpc('remove-custom-reminder', (_, id) => store.removeCustomReminder(id))

wrapIpc('get-ontop-state', () => store.getSettings().pinOnTop)
wrapIpc('toggle-ontop', () => {
  const v = !mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(v)
  store.updateSettings({ pinOnTop: v })
  mainWindow.webContents.send('ontop-changed', v)
  return v
})

wrapIpc('open-settings', () => {
  if (settingsWindow) settingsWindow.show()
})

wrapIpc('set-opacity', (_, value) => {
  if (mainWindow) {
    store.updateSettings({ opacity: value })
    mainWindow.webContents.send('opacity-changed', value)
  }
})

wrapIpc('get-lunar-date', (_, dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return solarToLunar(y, m, d)
})

wrapIpc('check-update', () => {
  const currentVersion = app.getVersion()
  logger.info(`检查更新，当前版本: ${currentVersion}`)
  return { hasUpdate: false, currentVersion, message: `当前版本 ${currentVersion}，已是最新版` }
})

// ===== 应用启动 =====
app.whenReady().then(() => {
  try {
    createStickerWindow()
    createSettingsWindow()
    settingsWindow.hide()

    scheduler = new Scheduler(store, api, sendNotification, broadcastHolidays)
    scheduler.start()

    Menu.setApplicationMenu(null)

    trayManager = new TrayManager(mainWindow, settingsWindow, store)
    trayManager.create()
    logger.info('应用启动成功')
  } catch (err) {
    logger.error('应用启动失败', err)
  }
})

// 全局错误捕获
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常', err)
})
process.on('unhandledRejection', (err) => {
  logger.error('未处理的 Promise 拒绝', err)
})

// 退出前销毁托盘，防止图标残留
app.on('before-quit', () => {
  if (trayManager) trayManager.destroy()
})

// 防止关闭所有窗口时退出（贴纸窗口关闭不应退出应用）
app.on('window-all-closed', () => {})
