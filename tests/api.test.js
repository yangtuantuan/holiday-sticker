const Api = require('../src/main/api')

global.fetch = jest.fn()

describe('Api', () => {
  let api

  beforeEach(() => {
    api = new Api()
    jest.resetAllMocks()
  })

  test('fetchHolidaysByYear calls Nager.Date API', async () => {
    const mockData = [{ date: '2026-01-29', localName: '春节' }]
    global.fetch.mockResolvedValue({ ok: true, json: () => mockData })

    const result = await api.fetchHolidaysByYear('CN', 2026)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://date.nager.at/api/v3/PublicHolidays/2026/CN'
    )
    expect(result).toEqual(mockData)
  })

  test('fetchHolidaysByYear returns null on network error', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'))
    const result = await api.fetchHolidaysByYear('CN', 2026)
    expect(result).toBeNull()
  })

  test('fetchHolidaysByYear returns null on non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429 })
    const result = await api.fetchHolidaysByYear('CN', 2026)
    expect(result).toBeNull()
  })
})
