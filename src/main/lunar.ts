import { toLunar, formatLunar } from 'lunar'
import type { LunarResult } from '../shared/types'

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
