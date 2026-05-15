import { ipcMain, app } from 'electron'
import logger from '../logger'
import type Store from '../store'

export function registerWindowHandlers(store: Store, mainWindow: Electron.BrowserWindow, settingsWindow: Electron.BrowserWindow): void {
  ipcMain.handle('get-ontop-state', () => store.getSettings().pinOnTop)

  ipcMain.handle('toggle-ontop', () => {
    const v = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(v)
    store.updateSettings({ pinOnTop: v })
    mainWindow.webContents.send('ontop-changed', v)
    return v
  })

  ipcMain.handle('open-settings', () => {
    if (settingsWindow) settingsWindow.show()
  })

  ipcMain.handle('set-opacity', (_event, value: number) => {
    store.updateSettings({ opacity: value })
    mainWindow.webContents.send('opacity-changed', value)
  })

  ipcMain.handle('check-update', () => {
    const currentVersion = app.getVersion()
    logger.info(`检查更新，当前版本: ${currentVersion}`)
    return { hasUpdate: false, currentVersion, message: `当前版本 ${currentVersion}，已是最新版` }
  })
}
