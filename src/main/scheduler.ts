import logger from './logger'
import type Store from './store'
import type Api from './api'
import type { Holiday, Reminder, NotificationData } from '../shared/types'

type NotifyFn = (data: NotificationData) => void
type OnUpdateFn = () => void

class Scheduler {
  private store: Store
  private api: Api
  private notify: NotifyFn
  private onUpdate: OnUpdateFn
  private _interval: ReturnType<typeof setInterval> | null = null

  constructor(store: Store, api: Api, notifyFn: NotifyFn, onUpdateFn: OnUpdateFn) {
    this.store = store
    this.api = api
    this.notify = notifyFn
    this.onUpdate = onUpdateFn
    this._interval = null
  }

  start(): void {
    try {
      this.dailyCheck()
    } catch (err) {
      logger.error('初始每日检查失败', err)
    }
    this._interval = setInterval(() => {
      try {
        this.dailyCheck()
      } catch (err) {
        logger.error('定时每日检查失败', err)
      }
    }, 60 * 60 * 1000)
    setInterval(() => {
      try {
        this.minuteCheck()
      } catch (err) {
        logger.error('分钟检查失败', err)
      }
    }, 60 * 1000)
  }

  async dailyCheck(): Promise<void> {
    try {
      const lastUpdated = this.store.getLastUpdated()
      if (lastUpdated) {
        const lastDate = lastUpdated.split('T')[0]
        const today = new Date().toISOString().split('T')[0]
        if (lastDate === today) return
      }

      const data = await this.api.fetchCurrentAndNextYear('CN')
      for (const [year, holidays] of Object.entries(data)) {
        if (holidays) {
          this.store.updateHolidayCache(year, holidays)
        }
      }
      this.onUpdate()
    } catch (err) {
      logger.error('每日检查执行失败', err)
    }
  }

  getNextHoliday(holidays: Holiday[]): Holiday | null {
    const today = new Date().toISOString().split('T')[0]
    const upcoming = holidays
      .filter(h => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    return upcoming.length > 0 ? upcoming[0] : null
  }

  checkReminders(holidays: Holiday[], customReminders: Reminder[]): NotificationData[] {
    const today = new Date().toISOString().split('T')[0]
    const results: NotificationData[] = []

    for (const h of holidays) {
      if (h.date === today) {
        results.push({ title: h.localName, type: 'holiday', subtype: 'today', date: h.date, localName: h.localName })
      }
    }

    for (const r of customReminders) {
      if (!r.enabled) continue
      const nextDate = this._getNextOccurrence(r)
      if (nextDate === today) {
        results.push({ title: r.title, type: 'custom', subtype: 'today', date: today })
      }
    }

    return results
  }

  minuteCheck(): void {
    const settings = this.store.getSettings()
    if (!settings.reminderEnabled) return

    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    const holidays = [
      ...((this.store.getHolidayCache(currentYear) as Holiday[]) || []),
      ...((this.store.getHolidayCache(nextYear) as Holiday[]) || [])
    ].filter(Boolean)

    const reminders = this.checkReminders(holidays, this.store.getCustomReminders())
    for (const r of reminders) {
      this.notify(r)
    }
  }

  _getNextOccurrence(reminder: Reminder): string {
    const now = new Date()
    if (reminder.type === 'once') return reminder.date
    if (reminder.type === 'daily') return now.toISOString().split('T')[0]
    if (reminder.type === 'weekly') {
      const targetDay = Number(reminder.date)
      const today = now.getDay() || 7
      let diff = targetDay - today
      if (diff <= 0) diff += 7
      const d = new Date(now)
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    }
    const [m, d] = reminder.date.split('-').map(Number)
    if (reminder.type === 'yearly') {
      let d2 = new Date(now.getFullYear(), m - 1, d)
      if (d2 < now) d2 = new Date(now.getFullYear() + 1, m - 1, d)
      return d2.toISOString().split('T')[0]
    }
    if (reminder.type === 'monthly') {
      let d2 = new Date(now.getFullYear(), now.getMonth(), Number(reminder.date))
      if (d2 <= now) d2 = new Date(now.getFullYear(), now.getMonth() + 1, Number(reminder.date))
      return d2.toISOString().split('T')[0]
    }
    return reminder.date
  }
}

export default Scheduler
