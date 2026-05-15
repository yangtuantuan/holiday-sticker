// 贴纸窗口的渲染进程脚本
// 通过 window.holidayAPI 与主进程通信（详见 preload.js）

const api = window.holidayAPI

// 关闭按钮
document.getElementById('close-btn').onclick = () => window.close()

// 监听主进程的刷新事件（系统托盘点击"刷新"时触发）
api.onRefresh(() => refresh())

// 刷新节日数据并渲染
async function refresh() {
  const holidays = await api.getHolidays()
  render(holidays || [])
}

// 渲染贴纸内容
function render(holidays) {
  const today = new Date().toISOString().split('T')[0]
  // 筛选出今天及以后的节日，按日期排序
  const upcoming = holidays
    .filter(h => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  // 高亮显示最近的一个节日
  const next = upcoming[0]
  const nextName = document.getElementById('next-name')
  const nextCountdown = document.getElementById('next-countdown')
  const nextDate = document.getElementById('next-date')

  if (next) {
    const days = Math.ceil((new Date(next.date) - new Date(today)) / (1000 * 60 * 60 * 24))
    nextName.textContent = `距离 ${next.localName}`
    nextCountdown.textContent = days === 0 ? '就是今天！🎉' : `还有 ${days} 天`
    nextDate.textContent = `${next.date} ${getWeekday(next.date)}`
  } else {
    nextName.textContent = '暂无节日数据'
    nextCountdown.textContent = ''
    nextDate.textContent = ''
  }

  // 列出其余近期节日（最多 9 个）
  const list = document.getElementById('holiday-list')
  list.innerHTML = upcoming.slice(1, 10).map(h => {
    const days = Math.ceil((new Date(h.date) - new Date(today)) / (1000 * 60 * 60 * 24))
    return `<li>
      <span class="holiday-icon">🎉</span>
      <span class="holiday-name">${h.localName}</span>
      <span class="holiday-countdown">+${days}天</span>
      <span class="holiday-date">${h.date.slice(5)}</span>
    </li>`
  }).join('')

  // 底部显示当天日期
  document.getElementById('today-date').textContent =
    `今日: ${today} ${getWeekday(today)}`
}

// 根据日期字符串获取中文星期
function getWeekday(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[new Date(dateStr).getDay()]
}

// 加载自定义提醒并混排到列表中
async function loadCustomReminders() {
  const reminders = await api.getCustomReminders()
  const list = document.getElementById('holiday-list')
  const today = new Date().toISOString().split('T')[0]

  for (const r of reminders) {
    if (!r.enabled) continue
    const nextDate = getNextOccurrence(r)
    if (!nextDate || nextDate < today) continue
    const days = Math.ceil((new Date(nextDate) - new Date(today)) / (1000 * 60 * 60 * 24))
    list.innerHTML += `<li>
      <span class="holiday-icon">📌</span>
      <span class="holiday-name">${r.title}</span>
      <span class="holiday-countdown">${days === 0 ? '今天' : `+${days}天`}</span>
      <span class="holiday-date">${nextDate.slice(5)}</span>
    </li>`
  }
}

// 计算自定义提醒的下次发生日期
// 与 scheduler.js 中的 _getNextOccurrence 逻辑一致
function getNextOccurrence(r) {
  if (r.type === 'once') return r.date
  if (r.type === 'yearly') {
    const [m, d] = r.date.split('-').map(Number)
    const now = new Date()
    let d2 = new Date(now.getFullYear(), m - 1, d)
    if (d2 < now) d2 = new Date(now.getFullYear() + 1, m - 1, d)
    return d2.toISOString().split('T')[0]
  }
  if (r.type === 'monthly') {
    const now = new Date()
    let d2 = new Date(now.getFullYear(), now.getMonth(), Number(r.date))
    if (d2 <= now) d2 = new Date(now.getFullYear(), now.getMonth() + 1, Number(r.date))
    return d2.toISOString().split('T')[0]
  }
  if (r.type === 'daily') return new Date().toISOString().split('T')[0]
  return null
}

// 启动：先加载节日，再加载自定义提醒
refresh().then(loadCustomReminders)
// 每小时自动刷新一次
setInterval(refresh, 60 * 60 * 1000)
