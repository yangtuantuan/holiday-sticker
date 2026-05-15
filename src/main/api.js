const BASE_URL = 'https://date.nager.at/api/v3'

class Api {
  async fetchHolidaysByYear(countryCode, year) {
    try {
      const url = `${BASE_URL}/PublicHolidays/${year}/${countryCode}`
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async fetchCurrentAndNextYear(countryCode) {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const [current, next] = await Promise.all([
      this.fetchHolidaysByYear(countryCode, currentYear),
      this.fetchHolidaysByYear(countryCode, nextYear)
    ])
    return {
      [currentYear]: current,
      [nextYear]: next
    }
  }
}

module.exports = Api
