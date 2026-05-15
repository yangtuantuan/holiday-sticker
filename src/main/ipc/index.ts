import type Store from '../store'
import type Api from '../api'
import type { BrowserWindow } from 'electron'
import { registerHolidayHandlers } from './holiday'
import { registerSettingsHandlers } from './settings'
import { registerReminderHandlers } from './reminder'
import { registerWindowHandlers } from './window'

export function registerAllHandlers(
  store: Store,
  api: Api,
  mainWindow: BrowserWindow,
  settingsWindow: BrowserWindow
): void {
  registerHolidayHandlers(store, api)
  registerSettingsHandlers(store)
  registerReminderHandlers(store)
  registerWindowHandlers(store, mainWindow, settingsWindow)
}
