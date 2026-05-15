const { lunarToSolar, getLunarMonthInfo, formatLunarDateDisplay } = require('../src/main/lunar')

describe('lunarToSolar', () => {
  test('converts once type regular lunar date', () => {
    expect(lunarToSolar('2026-1-1', 'once')).toBe('2026-02-17')
  })

  test('converts once type leap lunar date', () => {
    expect(lunarToSolar('2023-102-15', 'once')).toBe('2023-04-05')
  })

  test('converts once type regular month with same number as leap', () => {
    expect(lunarToSolar('2023-2-15', 'once')).toBe('2023-03-06')
  })

  test('returns null for invalid type', () => {
    expect(lunarToSolar('2026-1-1', 'daily')).toBeNull()
  })

  test('returns null for invalid date string', () => {
    expect(lunarToSolar('invalid', 'once')).toBeNull()
  })

  test('returns null for malformed date parts', () => {
    expect(lunarToSolar('abc-def-ghi', 'once')).toBeNull()
  })

  test('yearly returns a future date string', () => {
    const result = lunarToSolar('3-15', 'yearly')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('yearly advances year when date has passed', () => {
    const result = lunarToSolar('1-1', 'yearly')
    const today = new Date()
    const resultDate = new Date(result)
    expect(resultDate.getTime()).toBeGreaterThanOrEqual(today.getTime() - 86400000)
  })
})

describe('getLunarMonthInfo', () => {
  test('returns 12 months for regular year 2024', () => {
    const info = getLunarMonthInfo(2024)
    expect(info.length).toBe(12)
    info.forEach(m => {
      expect(m.month).toBeGreaterThanOrEqual(1)
      expect(m.month).toBeLessThanOrEqual(12)
      expect(m.isLeap).toBe(false)
      expect(m.days).toBeGreaterThanOrEqual(28)
      expect(m.days).toBeLessThanOrEqual(30)
      expect(m.label).toBeTruthy()
    })
  })

  test('returns 13 months for leap year 2023 (闰二月)', () => {
    const info = getLunarMonthInfo(2023)
    expect(info.length).toBe(13)
    const leapMonths = info.filter(m => m.isLeap)
    expect(leapMonths.length).toBe(1)
    expect(leapMonths[0].month).toBe(2)
    expect(leapMonths[0].label).toBe('闰二月')
  })

  test('month labels are correct', () => {
    const info = getLunarMonthInfo(2024)
    expect(info[0].label).toBe('正月')
    expect(info[1].label).toBe('二月')
    expect(info[2].label).toBe('三月')
    expect(info[11].label).toBe('十二月')
  })
})

describe('formatLunarDateDisplay', () => {
  test('formats once type correctly', () => {
    const result = formatLunarDateDisplay('2026-1-1', 'once')
    expect(result).toMatch(/^农历/)
    expect(result).toContain('正月')
    expect(result).toContain('初一')
  })

  test('formats once type with leap month', () => {
    const result = formatLunarDateDisplay('2023-102-15', 'once')
    expect(result).toContain('闰二月')
    expect(result).toContain('十五')
  })

  test('formats yearly type correctly', () => {
    const result = formatLunarDateDisplay('3-15', 'yearly')
    expect(result).toBe('每年农历三月十五')
  })

  test('formats yearly type with leap month', () => {
    const result = formatLunarDateDisplay('102-15', 'yearly')
    expect(result).toBe('每年农历闰二月十五')
  })

  test('returns empty string for unknown type', () => {
    expect(formatLunarDateDisplay('3-15', 'monthly')).toBe('')
  })

  test('returns empty string for invalid input', () => {
    expect(formatLunarDateDisplay('invalid', 'once')).toBe('')
  })
})
