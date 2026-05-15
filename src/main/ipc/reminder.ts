import { ipcMain } from 'electron'
import type Store from '../store'
import type { Reminder } from '../../shared/types'

export function registerReminderHandlers(store: Store): void {
  ipcMain.handle('get-custom-reminders', () => store.getCustomReminders())

  ipcMain.handle('add-custom-reminder', (_event, data: Omit<Reminder, 'id'>) => {
    return store.addCustomReminder(data)
  })

  ipcMain.handle('update-custom-reminder', (_event, id: string, data: Partial<Reminder>) => {
    return store.updateCustomReminder(id, data)
  })

  ipcMain.handle('remove-custom-reminder', (_event, id: string) => {
    store.removeCustomReminder(id)
  })
}
