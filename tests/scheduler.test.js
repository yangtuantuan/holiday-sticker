const Scheduler = require('../src/main/scheduler').default

// 使用假定时器，避免测试实际等待
jest.useFakeTimers()

describe('Scheduler', () => {
  let scheduler
  let mockStore
  let mockApi
  let mockNotify
  let mockOnUpdate

  // 每个测试前创建模拟对象（mock）
  beforeEach(() => {
    mockStore = {
      getSettings: jest.fn().mockReturnValue({
        dailyReminderTime: '08:00',
        advanceReminderPresets: [1, 3, 7],
        customAdvanceReminderDays: []
      }),
      getHolidayCache: jest.fn().mockReturnValue(null),
      updateHolidayCache: jest.fn(),
      getCustomReminders: jest.fn().mockReturnValue([]),
      getLastUpdated: jest.fn().mockReturnValue(null)
    }
    mockApi = {
      fetchCurrentAndNextYear: jest.fn()
    }
    mockNotify = jest.fn()
    mockOnUpdate = jest.fn()

    scheduler = new Scheduler(mockStore, mockApi, mockNotify, mockOnUpdate)
  })

  // 首次运行应该调用 API 并更新缓存
  test('starts and runs daily check on first start', async () => {
    mockApi.fetchCurrentAndNextYear.mockResolvedValue({
      '2026': [{ date: '2026-01-29', localName: '春节' }],
      '2027': null
    })

    await scheduler.dailyCheck()

    expect(mockApi.fetchCurrentAndNextYear).toHaveBeenCalledWith('CN')
    expect(mockStore.updateHolidayCache).toHaveBeenCalledWith('2026', [{ date: '2026-01-29', localName: '春节' }])
    expect(mockOnUpdate).toHaveBeenCalled()
  })

  // 如果当天已经更新过，跳过 API 调用
  test('skips API call if cache is fresh (same day)', async () => {
    const today = new Date().toISOString().split('T')[0]
    mockStore.getLastUpdated.mockReturnValue(today + 'T10:00:00.000Z')

    await scheduler.dailyCheck()

    expect(mockApi.fetchCurrentAndNextYear).not.toHaveBeenCalled()
  })

  // 没有节日时 getNextHoliday 返回 null
  test('getNextHoliday returns null when no holidays exist', () => {
    const result = scheduler.getNextHoliday([])
    expect(result).toBeNull()
  })

  // getNextHoliday 应该返回最近的未来节日（测试日期需在当前日期之后）
  test('getNextHoliday returns the upcoming holiday', () => {
    const holidays = [
      { date: '2026-05-10', localName: 'past' },
      { date: '2026-05-20', localName: '春节' },
      { date: '2026-06-01', localName: '儿童节' }
    ]
    const result = scheduler.getNextHoliday(holidays)
    expect(result.localName).toBe('春节')
  })

  // 没有提醒时返回空数组
  test('checkReminders returns empty array when no reminders due', () => {
    const result = scheduler.checkReminders([], [])
    expect(result).toEqual([])
  })

  // 今天有节日时应该检测到
  test('checkReminders detects holiday today', () => {
    const today = new Date().toISOString().split('T')[0]
    const holidays = [{ date: today, localName: '测试节' }]
    const result = scheduler.checkReminders(holidays, [])
    expect(result.some(r => r.title === '测试节' && r.type === 'holiday')).toBe(true)
  })

  test('_getNextOccurrence handles lunar calendar once type', () => {
    const reminder = {
      id: 'test1',
      title: '农历生日',
      type: 'once',
      date: '2026-1-1',
      time: '09:00',
      calendar: 'lunar',
      advanceReminderDays: [],
      enabled: true
    }
    const result = scheduler._getNextOccurrence(reminder)
    expect(result).toBe('2026-02-17')
  })

  test('_getNextOccurrence handles lunar calendar yearly type', () => {
    const reminder = {
      id: 'test2',
      title: '每年农历三月十五',
      type: 'yearly',
      date: '3-15',
      time: '09:00',
      calendar: 'lunar',
      advanceReminderDays: [],
      enabled: true
    }
    const result = scheduler._getNextOccurrence(reminder)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('_getNextOccurrence handles leap month lunar date', () => {
    const reminder = {
      id: 'test3',
      title: '闰二月十五',
      type: 'once',
      date: '2023-102-15',
      time: '09:00',
      calendar: 'lunar',
      advanceReminderDays: [],
      enabled: true
    }
    const result = scheduler._getNextOccurrence(reminder)
    expect(result).toBe('2023-04-05')
  })

  test('_getNextOccurrence treats gregorian calendar same as before', () => {
    const reminder = {
      id: 'test4',
      title: '普通提醒',
      type: 'once',
      date: '2026-06-01',
      time: '09:00',
      calendar: 'gregorian',
      advanceReminderDays: [],
      enabled: true
    }
    const result = scheduler._getNextOccurrence(reminder)
    expect(result).toBe('2026-06-01')
  })
})
