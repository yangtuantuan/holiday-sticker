// electron-store：一个简单的 JSON 文件存储库，自动保存在用户数据目录
// 这里用它来存设置、节日缓存、自定义提醒
const ElectronStore = require('electron-store')

class Store {
  constructor() {
    this._store = new ElectronStore({
      // 默认值——第一次启动时自动写入
      defaults: {
        settings: {
          stickerPosition: 'bottom-right',  // 贴纸位置：右下角
          autoStart: true,                   // 开机自启
          reminderEnabled: true,             // 提醒总开关
          dailyReminderTime: '08:00',        // 每日节日提醒时间
          advanceReminderPresets: [1, 3, 7], // 提前提醒天数（可选预设）
          customAdvanceReminderDays: [],      // 用户自定义的提前提醒天数
          pinOnTop: false,                    // 置顶状态
          opacity: 1.0,                      // 贴纸透明度
          windowPosition: null               // 窗口最后位置 { x, y }
        },
        customReminders: [],  // 用户自定义提醒列表
        holidayCache: {}       // 节日缓存 { "2026": [...], "2027": [...] }
      }
    })
  }

  // 获取所有设置
  getSettings() {
    return this._store.get('settings')
  }

  // 更新部分设置（只传要改的字段即可）
  updateSettings(partial) {
    const current = this.getSettings()
    this._store.set('settings', { ...current, ...partial })
  }

  // 添加一条自定义提醒
  // data: { title, type, date, time, advanceReminderDays }
  // type: 'once' | 'daily' | 'monthly' | 'yearly'
  addCustomReminder(data) {
    const reminders = this.getCustomReminders()
    // 生成唯一 ID：时间戳 + 随机字符
    const reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...data,
      enabled: data.enabled !== false  // 默认为启用
    }
    reminders.push(reminder)
    this._store.set('customReminders', reminders)
    return reminder
  }

  // 获取全部自定义提醒
  getCustomReminders() {
    return this._store.get('customReminders')
  }

  // 按 ID 删除自定义提醒
  removeCustomReminder(id) {
    const reminders = this.getCustomReminders().filter(r => r.id !== id)
    this._store.set('customReminders', reminders)
  }

  // 按 ID 更新自定义提醒（合并更新）
  updateCustomReminder(id, data) {
    const reminders = this.getCustomReminders()
    const idx = reminders.findIndex(r => r.id === id)
    if (idx === -1) return null
    reminders[idx] = { ...reminders[idx], ...data }
    this._store.set('customReminders', reminders)
    return reminders[idx]
  }

  // 缓存某年的节日数据（从 Nager.Date API 获取的原始数据）
  updateHolidayCache(year, holidays) {
    const cache = this._store.get('holidayCache')
    cache[year] = holidays
    cache.lastUpdated = new Date().toISOString()  // 记录更新时间，用于判断是否需要刷新
    this._store.set('holidayCache', cache)
  }

  // 获取某年的缓存节日数据，没有则返回 null
  getHolidayCache(year) {
    const cache = this._store.get('holidayCache')
    return cache[year] || null
  }

  // 获取缓存最后更新时间
  getLastUpdated() {
    return this._store.get('holidayCache.lastUpdated')
  }
}

module.exports = Store
