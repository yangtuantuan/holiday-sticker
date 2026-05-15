// 调度器：负责定时刷新节日数据、检查提醒、触发通知
// 通过依赖注入拿到 store、api、notify 函数，方便测试

const logger = require('./logger')

class Scheduler {
  constructor(store, api, notifyFn, onUpdateFn) {
    this.store = store
    this.api = api
    this.notify = notifyFn    // 发通知的回调（由 main.js 传入）
    this.onUpdate = onUpdateFn // 数据更新后通知渲染进程的回调
    this._interval = null
  }

  // 启动调度：立即执行一次每日检查 + 设置定时器
  start() {
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

  // 每日检查：如果当天还没更新，就去拉 API
  async dailyCheck() {
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

  // 从节日列表中找出最近的尚未到来的节日
  getNextHoliday(holidays) {
    const today = new Date().toISOString().split('T')[0]
    const upcoming = holidays
      .filter(h => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    return upcoming.length > 0 ? upcoming[0] : null
  }

  // 检查哪些提醒需要触发
  // 返回数组 [{ title, type, subtype, date, localName }]
  checkReminders(holidays, customReminders) {
    const today = new Date().toISOString().split('T')[0]
    const results = []

    // 检查节日——今天是不是某个节日
    for (const h of holidays) {
      if (h.date === today) {
        results.push({ title: h.localName, type: 'holiday', subtype: 'today', date: h.date, localName: h.localName })
      }
    }

    // 检查自定义提醒
    for (const r of customReminders) {
      if (!r.enabled) continue
      const nextDate = this._getNextOccurrence(r)
      if (nextDate === today) {
        results.push({ title: r.title, type: 'custom', subtype: 'today', date: today })
      }
    }

    return results
  }

  // 每分钟检查一次：如果有提醒就发通知
  minuteCheck() {
    const settings = this.store.getSettings()
    if (!settings.reminderEnabled) return

    // 组合今年 + 明年的节日数据
    const holidays = [
      ...(this.store.getHolidayCache(String(new Date().getFullYear())) || []),
      ...(this.store.getHolidayCache(String(new Date().getFullYear() + 1)) || [])
    ].filter(Boolean)

    const reminders = this.checkReminders(holidays, this.store.getCustomReminders())
    for (const r of reminders) {
      this.notify(r)
    }
  }

  // 计算自定义提醒的下次发生日期（内部方法）
  // once    → 直接返回 date
  // weekly  → 每周这一天（1=周一 ... 7=周日）
  // yearly  → 每年这一天
  // monthly → 每月这一天
  // daily   → 每天
  _getNextOccurrence(reminder) {
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

module.exports = Scheduler
