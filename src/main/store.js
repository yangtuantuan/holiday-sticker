const ElectronStore = require('electron-store')

class Store {
  constructor() {
    this._store = new ElectronStore({
      defaults: {
        settings: {
          stickerPosition: 'bottom-right',
          autoStart: true,
          reminderEnabled: true,
          dailyReminderTime: '08:00',
          advanceReminderPresets: [1, 3, 7],
          customAdvanceReminderDays: []
        },
        customReminders: [],
        holidayCache: {}
      }
    })
  }

  getSettings() {
    return this._store.get('settings')
  }

  updateSettings(partial) {
    const current = this.getSettings()
    this._store.set('settings', { ...current, ...partial })
  }

  addCustomReminder(data) {
    const reminders = this.getCustomReminders()
    const reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...data,
      enabled: data.enabled !== false
    }
    reminders.push(reminder)
    this._store.set('customReminders', reminders)
    return reminder
  }

  getCustomReminders() {
    return this._store.get('customReminders')
  }

  removeCustomReminder(id) {
    const reminders = this.getCustomReminders().filter(r => r.id !== id)
    this._store.set('customReminders', reminders)
  }

  updateCustomReminder(id, data) {
    const reminders = this.getCustomReminders()
    const idx = reminders.findIndex(r => r.id === id)
    if (idx === -1) return null
    reminders[idx] = { ...reminders[idx], ...data }
    this._store.set('customReminders', reminders)
    return reminders[idx]
  }

  updateHolidayCache(year, holidays) {
    const cache = this._store.get('holidayCache')
    cache[year] = holidays
    cache.lastUpdated = new Date().toISOString()
    this._store.set('holidayCache', cache)
  }

  getHolidayCache(year) {
    const cache = this._store.get('holidayCache')
    return cache[year] || null
  }

  getLastUpdated() {
    return this._store.get('holidayCache.lastUpdated')
  }
}

module.exports = Store
