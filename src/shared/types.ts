export interface Holiday {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
  launchYear: number | null
  types: string[]
}

export interface LunarResult {
  year: number
  month: number
  day: number
  monthStr: string
  dayStr: string
  gzY: string
}

export interface Reminder {
  id: string
  title: string
  type: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  date: string
  time: string
  advanceReminderDays: number[]
  enabled: boolean
}

export interface Settings {
  stickerPosition: string
  autoStart: boolean
  reminderEnabled: boolean
  dailyReminderTime: string
  advanceReminderPresets: number[]
  customAdvanceReminderDays: number[]
  pinOnTop: boolean
  opacity: number
  windowPosition: { x: number; y: number } | null
}

export interface UpdateResult {
  hasUpdate: boolean
  currentVersion: string
  message: string
}

export interface NotificationData {
  title: string
  type: 'holiday' | 'custom'
  subtype: 'today' | 'advance'
  date: string
  localName?: string
}

export interface HolidayAPI {
  getHolidays: () => Promise<Holiday[]>
  getSettings: () => Promise<Settings>
  updateSettings: (s: Partial<Settings>) => Promise<void>
  getCustomReminders: () => Promise<Reminder[]>
  addCustomReminder: (r: Omit<Reminder, 'id'>) => Promise<Reminder>
  updateCustomReminder: (id: string, r: Partial<Reminder>) => Promise<void>
  removeCustomReminder: (id: string) => Promise<void>
  getOnTopState: () => Promise<boolean>
  toggleOnTop: () => Promise<boolean>
  onOnTopChanged: (cb: (v: boolean) => void) => void
  openSettings: () => Promise<void>
  setOpacity: (v: number) => Promise<void>
  onOpacityChanged: (cb: (v: number) => void) => void
  getLunarDate: (dateStr: string) => Promise<LunarResult | null>
  checkUpdate: () => Promise<UpdateResult>
  onRefresh: (cb: () => void) => void
}
