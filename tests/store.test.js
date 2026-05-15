const Store = require('../src/main/store')

jest.mock('electron-store', () => {
  const mockStore = { get: jest.fn(), set: jest.fn() }
  return jest.fn(() => mockStore)
})

describe('Store', () => {
  let store

  beforeEach(() => {
    store = new Store()
  })

  test('getSettings returns default values when no config saved', () => {
    const defaults = store.getSettings()
    expect(defaults.stickerPosition).toBe('bottom-right')
    expect(defaults.autoStart).toBe(true)
    expect(defaults.dailyReminderTime).toBe('08:00')
  })

  test('updateSettings writes to electron-store', () => {
    store.updateSettings({ stickerPosition: 'top-right' })
    expect(store._store.set).toHaveBeenCalledWith('settings', expect.objectContaining({
      stickerPosition: 'top-right'
    }))
  })

  test('addCustomReminder stores a reminder with id and enabled defaults', () => {
    const reminder = store.addCustomReminder({ title: 'test', type: 'once', date: '2026-06-01' })
    expect(reminder.id).toBeDefined()
    expect(reminder.enabled).toBe(true)
    expect(store._store.set).toHaveBeenCalled()
  })

  test('getCustomReminders returns list', () => {
    store._store.get.mockReturnValue([{ id: '1', title: 'test' }])
    expect(store.getCustomReminders()).toHaveLength(1)
  })

  test('removeCustomReminder deletes by id', () => {
    store._store.get.mockReturnValue([{ id: '1' }, { id: '2' }])
    store.removeCustomReminder('1')
    const saved = store._store.set.mock.calls.find(c => c[0] === 'customReminders')
    expect(saved[1]).toHaveLength(1)
    expect(saved[1][0].id).toBe('2')
  })

  test('updateHolidayCache stores year data', () => {
    store.updateHolidayCache('2026', [{ date: '2026-01-29' }])
    expect(store._store.set).toHaveBeenCalledWith('holidayCache', expect.objectContaining({
      '2026': [{ date: '2026-01-29' }]
    }))
  })

  test('getHolidayCache returns null for missing year', () => {
    store._store.get.mockReturnValue({})
    expect(store.getHolidayCache('2026')).toBeNull()
  })
})
