// Nager.Date API：免费、无需 API Key 的公共节日 API
// 文档：https://date.nager.at
const BASE_URL = 'https://date.nager.at/api/v3'

class Api {
  // 获取指定国家、指定年份的节日列表
  // countryCode: 'CN' 表示中国
  // 返回: 节日数组 [{ date, localName, name, countryCode, ... }]
  async fetchHolidaysByYear(countryCode, year) {
    try {
      const url = `${BASE_URL}/PublicHolidays/${year}/${countryCode}`
      const res = await fetch(url)
      if (!res.ok) return null  // 非 200 响应（如 429 限流）返回 null
      return await res.json()
    } catch {
      return null  // 网络异常也返回 null，调用方自行处理
    }
  }

  // 一次获取当年 + 下一年数据（避免年底切换年份时断层）
  // 返回: { "2026": [...], "2027": [...] }
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
