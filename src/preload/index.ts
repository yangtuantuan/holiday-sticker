import { contextBridge, ipcRenderer } from 'electron'
import type { HolidayAPI } from '../shared/types'

const api: HolidayAPI = {
  getHolidays: () => ipcRenderer.invoke('get-holidays'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (s) => ipcRenderer.invoke('update-settings', s),
  getCustomReminders: () => ipcRenderer.invoke('get-custom-reminders'),
  addCustomReminder: (r) => ipcRenderer.invoke('add-custom-reminder', r),
  updateCustomReminder: (id, r) => ipcRenderer.invoke('update-custom-reminder', id, r),
  removeCustomReminder: (id) => ipcRenderer.invoke('remove-custom-reminder', id),
  getOnTopState: () => ipcRenderer.invoke('get-ontop-state'),
  toggleOnTop: () => ipcRenderer.invoke('toggle-ontop'),
  onOnTopChanged: (cb) => { ipcRenderer.on('ontop-changed', (_event, v) => cb(v)) },
  openSettings: () => ipcRenderer.invoke('open-settings'),
  setOpacity: (v) => ipcRenderer.invoke('set-opacity', v),
  onOpacityChanged: (cb) => { ipcRenderer.on('opacity-changed', (_event, v) => cb(v)) },
  getLunarDate: (dateStr) => ipcRenderer.invoke('get-lunar-date', dateStr),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  onRefresh: (cb) => { ipcRenderer.on('refresh-holidays', () => cb()) }
}

contextBridge.exposeInMainWorld('holidayAPI', api)
