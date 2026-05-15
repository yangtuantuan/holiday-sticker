import { ipcMain } from 'electron'
import logger from '../logger'
import type Store from '../store'
import type Api from '../api'
import { solarToLunar, lunarToSolar, getLunarMonthInfo, formatLunarDateDisplay } from '../lunar'

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
      const [y, m, d] = dateStr.split('-').map(Number)
      return solarToLunar(y, m, d)
    } catch (err) {
      logger.error('get-lunar-date 失败', err)
      return null
    }
  })

  ipcMain.handle('get-lunar-month-info', (_event, year: number) => {
    try {
      return getLunarMonthInfo(year)
    } catch (err) {
      logger.error('get-lunar-month-info 失败', err)
      return []
    }
  })

  ipcMain.handle('format-lunar-date', (_event, dateStr: string, type: string) => {
    try {
      return formatLunarDateDisplay(dateStr, type)
    } catch (err) {
      logger.error('format-lunar-date 失败', err)
      return dateStr
    }
  })
}
