import ElectronStore from 'electron-store'
import type { Settings, Reminder } from '../shared/types'

interface StoreSchema {
  settings: Settings
  customReminders: Reminder[]
  holidayCache: Record<string, unknown>
}

class Store {
  private _store: ElectronStore<StoreSchema>

  constructor() {
    this._store = new ElectronStore<StoreSchema>({
      defaults: {
        settings: {
          stickerPosition: 'bottom-right',
          autoStart: true,
          reminderEnabled: true,
          dailyReminderTime: '08:00',
          advanceReminderPresets: [1, 3, 7],
          customAdvanceReminderDays: [],
          pinOnTop: false,
          opacity: 1.0,
          windowPosition: null
        },
        customReminders: [],
        holidayCache: {}
      }
    })
  }

  getSettings(): Settings {
    return this._store.get('settings')
  }

  updateSettings(partial: Partial<Settings>): void {
    const current = this.getSettings()
    this._store.set('settings', { ...current, ...partial })
  }

  addCustomReminder(data: Omit<Reminder, 'id'>): Reminder {
    const reminders = this.getCustomReminders()
    const reminder: Reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...data,
      enabled: data.enabled !== false
    }
    reminders.push(reminder)
    this._store.set('customReminders', reminders)
    return reminder
  }

  getCustomReminders(): Reminder[] {
    return this._store.get('customReminders')
  }

  removeCustomReminder(id: string): void {
    const reminders = this.getCustomReminders().filter(r => r.id !== id)
    this._store.set('customReminders', reminders)
  }

  updateCustomReminder(id: string, data: Partial<Reminder>): Reminder | null {
    const reminders = this.getCustomReminders()
    const idx = reminders.findIndex(r => r.id === id)
    if (idx === -1) return null
    reminders[idx] = { ...reminders[idx], ...data }
    this._store.set('customReminders', reminders)
    return reminders[idx]
  }

  updateHolidayCache(year: string, holidays: unknown): void {
    const cache = this._store.get('holidayCache') as Record<string, unknown>
    cache[year] = holidays
    cache.lastUpdated = new Date().toISOString()
    this._store.set('holidayCache', cache)
  }

  getHolidayCache(year: string): unknown {
    const cache = this._store.get('holidayCache') as Record<string, unknown>
    return cache[year] || null
  }

  getLastUpdated(): string | undefined {
    return (this._store.get('holidayCache') as Record<string, unknown>).lastUpdated as string | undefined
  }
}

export default Store
