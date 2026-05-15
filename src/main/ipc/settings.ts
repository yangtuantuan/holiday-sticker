import { ipcMain, app } from 'electron'
import type Store from '../store'

export function registerSettingsHandlers(store: Store): void {
  ipcMain.handle('get-settings', () => store.getSettings())

  ipcMain.handle('update-settings', (_event, settings: Record<string, unknown>) => {
    store.updateSettings(settings as Parameters<typeof store.updateSettings>[0])
    if (settings.autoStart !== undefined) {
      app.setLoginItemSettings({ openAtLogin: Boolean(settings.autoStart) })
    }
  })
}
