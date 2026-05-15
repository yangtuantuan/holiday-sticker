import { ipcMain } from 'electron'
import logger from '../logger'
import type Store from '../store'
import type Api from '../api'

export function registerHolidayHandlers(store: Store, api: Api): void {
  ipcMain.handle('get-holidays', () => {
    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    return [
      ...(store.getHolidayCache(currentYear) || []),
      ...(store.getHolidayCache(nextYear) || [])
    ].filter(Boolean)
  })

  ipcMain.handle('get-lunar-date', (_event, dateStr: string) => {
    try {
      const { solarToLunar } = require('../lunar')
      const [y, m, d] = dateStr.split('-').map(Number)
      return solarToLunar(y, m, d)
    } catch (err) {
      logger.error('get-lunar-date 失败', err)
      return null
    }
  })
}
