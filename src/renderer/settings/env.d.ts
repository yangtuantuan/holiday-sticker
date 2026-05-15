import type { HolidayAPI } from '../../shared/types'

declare global {
  interface Window {
    holidayAPI: HolidayAPI
  }
}
