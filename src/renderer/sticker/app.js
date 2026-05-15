const api = window.holidayAPI

window.onerror = (msg, url, line, col, err) => {
  try { console.error('[sticker]', msg, err) } catch {}
}
window.onunhandledrejection = (e) => {
  try { console.error('[sticker] unhandled', e.reason) } catch {}
}

const ontopBtn = document.getElementById('ontop-btn')
ontopBtn.onclick = async () => {
  const v = await api.toggleOnTop()
  ontopBtn.classList.toggle('active', v)
}
api.onOnTopChanged((v) => ontopBtn.classList.toggle('active', v))
api.getOnTopState().then((v) => ontopBtn.classList.toggle('active', v))

const sticker = document.getElementById('sticker')
sticker.style.setProperty('-webkit-app-region', 'drag')

let _opacity = 1.0

function getCountdownColor(days) {
  if (days >= 90) return '#27ae60'
  if (days >= 30) return '#f1c40f'
  if (days >= 7) return '#e67e22'
  if (days >= 1) return '#e74c3c'
  return '#c0392b'
}

function applyOpacity(val) {
  const v = Math.max(0, Math.min(1, val))
  const bgAlpha = 0.92 * v
  sticker.style.background = `rgba(255, 255, 255, ${bgAlpha})`
  const borderColor = `rgba(240, 240, 240, ${v})`
  document.querySelectorAll('.holiday-list li').forEach(el => {
    el.style.borderBottomColor = borderColor
  })
  const footer = document.querySelector('.footer')
  if (footer) footer.style.borderTopColor = borderColor
  const next = document.querySelector('.next-holiday')
  if (next) {
    next.style.background = `linear-gradient(135deg, rgba(255,245,245,${v}), rgba(255,240,240,${v}))`
    next.style.borderColor = `rgba(255,224,224,${v})`
  }
}
api.getSettings().then(s => { _opacity = s.opacity ?? 1.0; applyOpacity(_opacity) })
api.onOpacityChanged((v) => { _opacity = v; applyOpacity(v) })
let toastTimer = null
sticker.ondblclick = () => {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  clearTimeout(toastTimer)
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = '✨ Holiday Sticker'
  sticker.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  toastTimer = setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 1500)
}

api.onRefresh(() => refresh())

async function refresh() {
  const holidays = await api.getHolidays()
  render(holidays || [])
}

function render(holidays) {
  const today = new Date().toISOString().split('T')[0]
  const oneYearLater = new Date()
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  const oneYearLaterStr = oneYearLater.toISOString().split('T')[0]
  const upcoming = holidays
    .filter(h => h.date >= today && h.date <= oneYearLaterStr)
    .sort((a, b) => a.date.localeCompare(b.date))

  const next = upcoming[0]
  const nextName = document.getElementById('next-name')
  const nextCountdown = document.getElementById('next-countdown')
  const nextDate = document.getElementById('next-date')

  if (next) {
    const days = Math.ceil((new Date(next.date) - new Date(today)) / (1000 * 60 * 60 * 24))
    const duration = getHolidayDuration(next.date, upcoming)
    nextCountdown.style.color = getCountdownColor(days)
    nextCountdown.textContent = days === 0 ? '就是今天！🎉' : `还有 ${days} 天`
    nextDate.textContent = `${next.date} ${getWeekday(next.date)}${duration > 1 ? `（放${duration}天）` : ''}`
    api.getLunarDate(next.date).then(l => {
      if (l) nextDate.textContent += ` 农历${l.monthStr}${l.dayStr}`
    })
  } else {
    nextName.textContent = '暂无节日数据'
    nextCountdown.textContent = ''
    nextDate.textContent = ''
    nextCountdown.style.color = ''
  }

  const list = document.getElementById('holiday-list')
  list.innerHTML = upcoming.slice(0, 10).map(h => {
    const days = Math.ceil((new Date(h.date) - new Date(today)) / (1000 * 60 * 60 * 24))
    const duration = getHolidayDuration(h.date, upcoming)
    return `<li>
      <div class="li-row">
        <span class="holiday-icon">🎉</span>
        <span class="holiday-name">${h.localName}</span>
        <span class="holiday-countdown" style="color:${getCountdownColor(days)}">+${days}天</span>
        <span class="holiday-date">${h.date.slice(5)}${duration > 1 ? ` 放${duration}天` : ''}</span>
      </div>
    </li>`
  }).join('')

  document.getElementById('today-date').textContent =
    `今日: ${today} ${getWeekday(today)}`
}

function getHolidayDuration(dateStr, upcoming) {
  const dateSet = new Set(upcoming.map(h => h.date))
  let count = 1
  while (true) {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + count)
    if (dateSet.has(d.toISOString().split('T')[0])) {
      count++
    } else {
      break
    }
  }
  return count
}

function getWeekday(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[new Date(dateStr).getDay()]
}

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
      <span class="holiday-countdown" style="color:${getCountdownColor(days)}">${days === 0 ? '今天' : `+${days}天`}</span>
      <span class="holiday-date">${nextDate.slice(5)}</span>
    </li>`
  }
}

function getNextOccurrence(r) {
  const now = new Date()
  if (r.type === 'once') return r.date
  if (r.type === 'daily') return now.toISOString().split('T')[0]
  if (r.type === 'weekly') {
    const targetDay = Number(r.date)
    const today = now.getDay() || 7
    let diff = targetDay - today
    if (diff <= 0) diff += 7
    const d = new Date(now)
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
  }
  if (r.type === 'yearly') {
    const [m, d] = r.date.split('-').map(Number)
    let d2 = new Date(now.getFullYear(), m - 1, d)
    if (d2 < now) d2 = new Date(now.getFullYear() + 1, m - 1, d)
    return d2.toISOString().split('T')[0]
  }
  if (r.type === 'monthly') {
    let d2 = new Date(now.getFullYear(), now.getMonth(), Number(r.date))
    if (d2 <= now) d2 = new Date(now.getFullYear(), now.getMonth() + 1, Number(r.date))
    return d2.toISOString().split('T')[0]
  }
  return null
}

refresh().then(loadCustomReminders)
setInterval(refresh, 60 * 60 * 1000)
