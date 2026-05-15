const Scheduler = require('../src/main/scheduler')

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

  // getNextHoliday 应该返回最近的未来节日
  test('getNextHoliday returns the upcoming holiday', () => {
    const holidays = [
      { date: '2026-01-10', localName: 'past' },
      { date: '2026-01-29', localName: '春节' },
      { date: '2026-02-12', localName: '元宵节' }
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
})
