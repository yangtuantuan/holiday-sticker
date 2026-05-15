import { toLunar, formatLunar, createLunarDate, toGregorian, formatLunarParts } from 'lunar'
import type { LunarResult, LunarMonthInfo } from '../shared/types'

export function solarToLunar(year: number, month: number, day: number): LunarResult | null {
  try {
    const result = toLunar(new Date(year, month - 1, day))
    if (!result || !result.lunar) return null
    const { lunar } = result
    const formatted = formatLunar(lunar)
    const withoutPrefix = formatted.replace('农历', '')
    const gzY = withoutPrefix.split('年')[0]
    const rest = withoutPrefix.split('年')[1]
    const monthEnd = rest.indexOf('月')
    if (monthEnd === -1) return null
    const monthStr = (lunar.isLeapMonth ? '闰' : '') + rest.slice(0, monthEnd + 1)
    const dayStr = rest.slice(monthEnd + 1)
    return { year: lunar.year, month: lunar.month, day: lunar.day, monthStr, dayStr, gzY: gzY || '' }
  } catch {
    return null
  }
}

const LUNAR_MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const LUNAR_DAY_NAMES = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

function getLunarMonthName(month: number): string {
  return LUNAR_MONTH_NAMES[month] || ''
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function lunarToSolar(dateStr: string, type: string): string | null {
  try {
    if (type === 'once') {
      const [y, m, d] = dateStr.split('-').map(Number)
      if (!y || !m || !d) return null
      const gregorian = toGregorian(createLunarDate({ year: y, month: m, day: d, isLeapMonth: false }))
      const date = gregorian.date
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
    if (type === 'yearly') {
      const [m, d] = dateStr.split('-').map(Number)
      if (!m || !d) return null
      const now = new Date()
      const currentYear = now.getFullYear()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      let gregorian = toGregorian(createLunarDate({ year: currentYear, month: m, day: d, isLeapMonth: false }))
      let gregDate = gregorian.date
      if (gregDate <= todayStart) {
        gregorian = toGregorian(createLunarDate({ year: currentYear + 1, month: m, day: d, isLeapMonth: false }))
        gregDate = gregorian.date
      }
      return `${gregDate.getFullYear()}-${pad(gregDate.getMonth() + 1)}-${pad(gregDate.getDate())}`
    }
    return null
  } catch {
    return null
  }
}

export function getLunarMonthInfo(year: number): LunarMonthInfo[] {
  const result: LunarMonthInfo[] = []
  for (let m = 1; m <= 12; m++) {
    for (const isLeap of [false, true]) {
      let days = 0
      for (const d of [30, 29, 28]) {
        try {
          toGregorian(createLunarDate({ year, month: m, day: d, isLeapMonth: isLeap }))
          days = d
          break
        } catch {
          // continue
        }
      }
      if (days > 0) {
        result.push({ month: m, isLeap, days, label: (isLeap ? '闰' : '') + getLunarMonthName(m) })
      }
    }
  }
  return result
}

export function formatLunarDateDisplay(dateStr: string, type: string): string {
  try {
    if (type === 'once') {
      const [y, m, d] = dateStr.split('-').map(Number)
      if (!y || !m || !d) return ''
      const lunar = createLunarDate({ year: y, month: m, day: d, isLeapMonth: false })
      const parts = formatLunarParts(lunar)
      const yearStem = parts.find(p => p.type === 'yearStem')?.value || ''
      const yearBranch = parts.find(p => p.type === 'yearBranch')?.value || ''
      const monthLabel = parts.find(p => p.type === 'month')?.value || ''
      const dayLabel = parts.find(p => p.type === 'day')?.value || ''
      return `农历${yearStem}${yearBranch}年${monthLabel}${dayLabel}`
    }
    if (type === 'yearly') {
      const [m, d] = dateStr.split('-').map(Number)
      if (!m || !d) return ''
      return `每年农历${getLunarMonthName(m)}${LUNAR_DAY_NAMES[d] || ''}`
    }
    return ''
  } catch {
    return ''
  }
}
