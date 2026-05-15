const BASE_URL = 'https://date.nager.at/api/v3'

interface NagerHoliday {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
  launchYear: number | null
  types: string[]
}

class Api {
  async fetchHolidaysByYear(countryCode: string, year: number): Promise<NagerHoliday[] | null> {
    try {
      const url = `${BASE_URL}/PublicHolidays/${year}/${countryCode}`
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async fetchCurrentAndNextYear(countryCode: string): Promise<Record<string, NagerHoliday[] | null>> {
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

export default Api
