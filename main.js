// Electron 主进程入口
// 负责：创建窗口、IPC 通信、定时调度、系统托盘、通知

const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const path = require('path')
const Store = require('./src/main/store')
const Api = require('./src/main/api')
const Scheduler = require('./src/main/scheduler')
const TrayManager = require('./src/main/tray')

const store = new Store()
const api = new Api()

let mainWindow = null     // 贴纸窗口
let settingsWindow = null // 设置窗口
let scheduler = null
let trayManager = null

// 创建贴纸窗口：无边框、半透明、始终置顶
function createStickerWindow() {
  mainWindow = new BrowserWindow({
    width: 280,
    height: 400,
    frame: false,            // 无标题栏
    transparent: true,       // 透明背景（毛玻璃效果）
    alwaysOnTop: true,       // 始终置顶
    resizable: false,
    skipTaskbar: true,       // 不在任务栏显示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 安全：隔离渲染进程上下文
      nodeIntegration: false    // 安全：禁止渲染进程直接使用 Node
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'sticker', 'index.html'))
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

ipcMain.handle('get-holidays', () => {
  const currentYear = String(new Date().getFullYear())
  const nextYear = String(new Date().getFullYear() + 1)
  return [
    ...(store.getHolidayCache(currentYear) || []),
    ...(store.getHolidayCache(nextYear) || [])
  ].filter(Boolean)
})

ipcMain.handle('get-settings', () => store.getSettings())
ipcMain.handle('update-settings', (_, settings) => {
  store.updateSettings(settings)
  if (settings.autoStart !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.autoStart })
  }
})
ipcMain.handle('get-custom-reminders', () => store.getCustomReminders())
ipcMain.handle('add-custom-reminder', (_, r) => store.addCustomReminder(r))
ipcMain.handle('update-custom-reminder', (_, id, r) => store.updateCustomReminder(id, r))
ipcMain.handle('remove-custom-reminder', (_, id) => store.removeCustomReminder(id))

// ===== 应用启动 =====
app.whenReady().then(() => {
  createStickerWindow()
  createSettingsWindow()
  settingsWindow.hide()  // 设置窗口默认隐藏

  // 启动调度器
  scheduler = new Scheduler(store, api, sendNotification, broadcastHolidays)
  scheduler.start()

  // 创建系统托盘
  trayManager = new TrayManager(mainWindow, settingsWindow)
  trayManager.create()
})

// 防止关闭所有窗口时退出（贴纸窗口关闭不应退出应用）
app.on('window-all-closed', () => {})
