import { app, BrowserWindow, Notification, Menu } from 'electron'
import { join } from 'path'
import Store from './store'
import Api from './api'
import Scheduler from './scheduler'
import TrayManager from './tray'
import logger from './logger'
import { registerAllHandlers } from './ipc'
import type { NotificationData } from '../shared/types'

const store = new Store()
const api = new Api()

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let scheduler: Scheduler | null = null
let trayManager: TrayManager | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createStickerWindow(): void {
  const settings = store.getSettings()
  mainWindow = new BrowserWindow({
    width: 280,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: settings.pinOnTop,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${VITE_DEV_SERVER_URL}/sticker/index.html`)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/sticker/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (settings.windowPosition) {
      mainWindow!.setBounds(settings.windowPosition)
    }
    mainWindow!.webContents.send('opacity-changed', settings.opacity ?? 1.0)
  })

  let moveTimer: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('move', () => {
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds()
        store.updateSettings({ windowPosition: { x: bounds.x, y: bounds.y } })
      }
    }, 300)
  })
}

function createSettingsWindow(): void {
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${VITE_DEV_SERVER_URL}/settings/index.html`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/settings/index.html'))
  }

  settingsWindow.on('close', (e) => {
    e.preventDefault()
    settingsWindow!.hide()
  })
}

function sendNotification(data: NotificationData): void {
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

function broadcastHolidays(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    const holidays = [
      ...((store.getHolidayCache(currentYear) as unknown[]) || []),
      ...((store.getHolidayCache(nextYear) as unknown[]) || [])
    ].filter(Boolean)
    mainWindow.webContents.send('holiday-update', holidays)
  }
}

app.whenReady().then(() => {
  try {
    createStickerWindow()
    createSettingsWindow()
    settingsWindow!.hide()

    app.setLoginItemSettings({ openAtLogin: store.getSettings().autoStart })

    scheduler = new Scheduler(store, api, sendNotification, broadcastHolidays)
    scheduler.start()

    Menu.setApplicationMenu(null)

    registerAllHandlers(store, api, mainWindow!, settingsWindow!)

    trayManager = new TrayManager(mainWindow!, settingsWindow!, store)
    trayManager.create()
    logger.info('应用启动成功')
  } catch (err) {
    logger.error('应用启动失败', err)
  }
})

process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常', err)
})
process.on('unhandledRejection', (err) => {
  logger.error('未处理的 Promise 拒绝', err)
})

app.on('before-quit', () => {
  if (trayManager) trayManager.destroy()
})

app.on('window-all-closed', () => {})
