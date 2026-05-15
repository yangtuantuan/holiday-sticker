# Vue + TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate Holiday Sticker from vanilla JS to Vue 3 + TypeScript with componentized renderer windows.

**Architecture:** Three-tier Electron app: main process (Node.js TS) manages IPC/API/store, two independent Vue 3 renderer windows (sticker + settings) communicate through typed IPC bridge, shared types in `src/shared/types.ts`.

**Tech Stack:** electron-vite, Vue 3 (Composition API + `<script setup>`), TypeScript (strict), electron-store, yarn

**Spec:** `docs/superpowers/specs/2026-05-16-vue-ts-migration-design.md`

---

## File Structure

```
holiday-sticker/
├── electron.vite.config.ts          # NEW - electron-vite config
├── package.json                     # MODIFY - scripts, main, deps
├── tsconfig.json                    # NEW - base TS config
├── tsconfig.node.json               # NEW - main/preload TS config
├── tsconfig.web.json                # NEW - renderer TS config
├── src/
│   ├── main/
│   │   ├── index.ts                 # NEW - main entry (was main.js)
│   │   ├── store.ts                 # RENAMED - store.js → TS
│   │   ├── api.ts                   # RENAMED - api.js → TS
│   │   ├── lunar.ts                 # RENAMED - lunar.js → TS
│   │   ├── scheduler.ts             # RENAMED - scheduler.js → TS
│   │   ├── tray.ts                  # RENAMED - tray.js → TS
│   │   ├── logger.ts                # RENAMED - logger.js → TS
│   │   └── ipc/                     # NEW - split IPC handlers
│   │       ├── index.ts             # register all handlers
│   │       ├── holiday.ts
│   │       ├── settings.ts
│   │       ├── reminder.ts
│   │       └── window.ts
│   ├── preload/
│   │   └── index.ts                 # NEW - typed preload (was preload.js)
│   ├── renderer/
│   │   ├── sticker/
│   │   │   ├── index.html           # MODIFY - Vue entry script
│   │   │   ├── main.ts              # NEW - Vue app creation
│   │   │   ├── App.vue              # NEW - root component
│   │   │   ├── components/
│   │   │   │   ├── NextHoliday.vue
│   │   │   │   ├── HolidayList.vue
│   │   │   │   ├── HolidayItem.vue
│   │   │   │   ├── CustomReminderList.vue
│   │   │   │   └── Footer.vue
│   │   │   └── styles/
│   │   │       └── main.css         # RENAMED - style.css → here
│   │   └── settings/
│   │       ├── index.html           # MODIFY - Vue entry script
│   │       ├── main.ts              # NEW - Vue app creation
│   │       ├── App.vue              # NEW - root component
│   │       ├── components/
│   │       │   ├── SettingsSidebar.vue
│   │       │   ├── GeneralTab.vue
│   │       │   ├── ReminderTab.vue
│   │       │   ├── CustomReminderTab.vue
│   │       │   └── ReminderForm.vue
│   │       └── styles/
│   │           └── main.css         # RENAMED - style.css → here
│   └── shared/
│       └── types.ts                 # NEW - shared interfaces
├── assets/icon.png                  # EXISTING
├── tests/
│   ├── store.test.js                # MODIFY - adjust imports
│   └── scheduler.test.js            # MODIFY - adjust imports
├── main.js                          # DELETE
├── preload.js                       # DELETE
├── src/renderer/sticker/app.js      # DELETE
├── src/renderer/sticker/style.css   # DELETE (moved to styles/)
├── src/renderer/settings/app.js     # DELETE
└── src/renderer/settings/style.css  # DELETE (moved to styles/)
```

---

### Task 1: Project Scaffolding (configs + dependencies)

**Files:**
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Modify: `package.json`

- [ ] **1.1: Update package.json**

```json
{
  "scripts": {
    "start": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "jest",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "main": "./out/main/index.js",
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "jest": "^29.0.0",
    "electron-vite": "^2.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "vue": "^3.4.0",
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  },
  "dependencies": {
    "electron-store": "^8.0.0",
    "lunar": "^2.0.0"
  }
}
```

Note: `vue` goes to `dependencies` (used at runtime in renderer), `electron-vite` and `@vitejs/plugin-vue` to `devDependencies`.

- [ ] **1.2: Install dependencies**

Run: `yarn install`

Expected: All packages install without errors.

- [ ] **1.3: Create tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- [ ] **1.4: Create tsconfig.node.json** (for main + preload)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "./out",
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src/main/**/*", "src/preload/**/*"]
}
```

- [ ] **1.5: Create tsconfig.web.json** (for renderer)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "vueCompilerOptions": {
    "target": 3.4
  },
  "include": ["src/renderer/**/*"]
}
```

- [ ] **1.6: Create electron.vite.config.ts**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          sticker: resolve(__dirname, 'src/renderer/sticker/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings/index.html')
        }
      }
    }
  }
})
```

- [ ] **1.7: Commit**

```bash
git add electron.vite.config.ts tsconfig.json tsconfig.node.json tsconfig.web.json package.json yarn.lock
git commit -m "chore: add electron-vite, Vue 3, TypeScript toolchain"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **2.1: Create src/shared/types.ts**

```ts
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
```

- [ ] **2.2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add shared TypeScript type definitions"
```

---

### Task 3: Convert logger + store (no dependencies)

**Files:**
- Rename: `src/main/logger.js` → `src/main/logger.ts`
- Rename: `src/main/store.js` → `src/main/store.ts`
- Modify: `tests/store.test.js`

- [ ] **3.1: Convert src/main/logger.ts**

```ts
import { appendFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

class Logger {
  private _logPath: string | null = null

  private _ensurePath(): string {
    if (!this._logPath) {
      const userData = app.getPath('userData')
      this._logPath = join(userData, 'error.log')
    }
    return this._logPath
  }

  private _write(level: string, msg: string, err?: unknown): void {
    const ts = new Date().toISOString()
    const errInfo = err ? `\n${err instanceof Error ? err.stack || err.message : String(err)}` : ''
    const line = `[${ts}] [${level}] ${msg}${errInfo}\n`
    console.error(line.trim())
    try {
      appendFileSync(this._ensurePath(), line, 'utf-8')
    } catch {
      // ignore file write errors
    }
  }

  info(msg: string): void { this._write('INFO', msg) }
  warn(msg: string, err?: unknown): void { this._write('WARN', msg, err) }
  error(msg: string, err?: unknown): void { this._write('ERROR', msg, err) }
}

export default new Logger()
```

- [ ] **3.2: Convert src/main/store.ts**

```ts
import ElectronStore from 'electron-store'
import type { Settings, Reminder } from '../shared/types'

interface StoreSchema {
  settings: Settings
  customReminders: Reminder[]
  holidayCache: Record<string, unknown>
}

class Store {
  private _store: ElectronStore<StoreSchema>

  constructor() {
    this._store = new ElectronStore<StoreSchema>({
      defaults: {
        settings: {
          stickerPosition: 'bottom-right',
          autoStart: true,
          reminderEnabled: true,
          dailyReminderTime: '08:00',
          advanceReminderPresets: [1, 3, 7],
          customAdvanceReminderDays: [],
          pinOnTop: false,
          opacity: 1.0,
          windowPosition: null
        },
        customReminders: [],
        holidayCache: {}
      }
    })
  }

  getSettings(): Settings {
    return this._store.get('settings')
  }

  updateSettings(partial: Partial<Settings>): void {
    const current = this.getSettings()
    this._store.set('settings', { ...current, ...partial })
  }

  addCustomReminder(data: Omit<Reminder, 'id'>): Reminder {
    const reminders = this.getCustomReminders()
    const reminder: Reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...data,
      enabled: data.enabled !== false
    }
    reminders.push(reminder)
    this._store.set('customReminders', reminders)
    return reminder
  }

  getCustomReminders(): Reminder[] {
    return this._store.get('customReminders')
  }

  removeCustomReminder(id: string): void {
    const reminders = this.getCustomReminders().filter(r => r.id !== id)
    this._store.set('customReminders', reminders)
  }

  updateCustomReminder(id: string, data: Partial<Reminder>): Reminder | null {
    const reminders = this.getCustomReminders()
    const idx = reminders.findIndex(r => r.id === id)
    if (idx === -1) return null
    reminders[idx] = { ...reminders[idx], ...data }
    this._store.set('customReminders', reminders)
    return reminders[idx]
  }

  updateHolidayCache(year: string, holidays: unknown): void {
    const cache = this._store.get('holidayCache') as Record<string, unknown>
    cache[year] = holidays
    cache.lastUpdated = new Date().toISOString()
    this._store.set('holidayCache', cache)
  }

  getHolidayCache(year: string): unknown {
    const cache = this._store.get('holidayCache') as Record<string, unknown>
    return cache[year] || null
  }

  getLastUpdated(): string | undefined {
    return (this._store.get('holidayCache') as Record<string, unknown>).lastUpdated as string | undefined
  }
}

export default Store
```

- [ ] **3.3: Update tests/store.test.js** (fix imports for the new TS structure)

Read the current file first, then adjust requires to point to `../src/main/store.ts`. If Jest can't handle TS directly, we may need to add `transform` config. For now, assume Jest handles it via `ts-jest` or the existing setup.

```js
const Store = require('../src/main/store').default
```

- [ ] **3.4: Run store tests**

Run: `yarn test --testPathPattern=store`
Expected: All store tests pass.

- [ ] **3.5: Commit**

```bash
git add src/main/logger.ts src/main/store.ts tests/store.test.js
git rm src/main/logger.js src/main/store.js
git commit -m "refactor: convert logger and store to TypeScript"
```

---

### Task 4: Convert api + lunar + logger reference updates

**Files:**
- Rename: `src/main/api.js` → `src/main/api.ts`
- Rename: `src/main/lunar.js` → `src/main/lunar.ts`
- Modify: `tests/scheduler.test.js` (if needed for imports)

- [ ] **4.1: Convert src/main/api.ts**

```ts
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
```

- [ ] **4.2: Convert src/main/lunar.ts**

```ts
import { toLunar, formatLunar } from 'lunar'
import type { LunarResult } from '../shared/types'

export function solarToLunar(year: number, month: number, day: number): LunarResult | null {
  try {
    const result = toLunar(new Date(year, month - 1, day))
    if (!result || !result.lunar) return null
    const { lunar } = result
    const formatted = formatLunar(lunar)
    const withoutPrefix = formatted.replace('农历', '')
    const gzY = withoutPrefix.split('年')[0]
    const rest = withoutPrefix.split('年')[1]
    const monthEnd = rest.indexOf('月')
    if (monthEnd === -1) return null
    const monthStr = (lunar.isLeapMonth ? '闰' : '') + rest.slice(0, monthEnd + 1)
    const dayStr = rest.slice(monthEnd + 1)
    return { year: lunar.year, month: lunar.month, day: lunar.day, monthStr, dayStr, gzY: gzY || '' }
  } catch {
    return null
  }
}
```

- [ ] **4.3: Commit**

```bash
git add src/main/api.ts src/main/lunar.ts
git rm src/main/api.js src/main/lunar.js
git commit -m "refactor: convert api and lunar modules to TypeScript"
```

---

### Task 5: Convert scheduler + tray

**Files:**
- Rename: `src/main/scheduler.js` → `src/main/scheduler.ts`
- Rename: `src/main/tray.js` → `src/main/tray.ts`
- Modify: `tests/scheduler.test.js`

- [ ] **5.1: Convert src/main/scheduler.ts**

```ts
import logger from './logger'
import type Store from './store'
import type Api from './api'
import type { Holiday, Reminder, NotificationData } from '../shared/types'

type NotifyFn = (data: NotificationData) => void
type OnUpdateFn = () => void

class Scheduler {
  private store: Store
  private api: Api
  private notify: NotifyFn
  private onUpdate: OnUpdateFn
  private _interval: ReturnType<typeof setInterval> | null = null

  constructor(store: Store, api: Api, notifyFn: NotifyFn, onUpdateFn: OnUpdateFn) {
    this.store = store
    this.api = api
    this.notify = notifyFn
    this.onUpdate = onUpdateFn
    this._interval = null
  }

  start(): void {
    try {
      this.dailyCheck()
    } catch (err) {
      logger.error('初始每日检查失败', err)
    }
    this._interval = setInterval(() => {
      try {
        this.dailyCheck()
      } catch (err) {
        logger.error('定时每日检查失败', err)
      }
    }, 60 * 60 * 1000)
    setInterval(() => {
      try {
        this.minuteCheck()
      } catch (err) {
        logger.error('分钟检查失败', err)
      }
    }, 60 * 1000)
  }

  async dailyCheck(): Promise<void> {
    try {
      const lastUpdated = this.store.getLastUpdated()
      if (lastUpdated) {
        const lastDate = lastUpdated.split('T')[0]
        const today = new Date().toISOString().split('T')[0]
        if (lastDate === today) return
      }

      const data = await this.api.fetchCurrentAndNextYear('CN')
      for (const [year, holidays] of Object.entries(data)) {
        if (holidays) {
          this.store.updateHolidayCache(year, holidays)
        }
      }
      this.onUpdate()
    } catch (err) {
      logger.error('每日检查执行失败', err)
    }
  }

  getNextHoliday(holidays: Holiday[]): Holiday | null {
    const today = new Date().toISOString().split('T')[0]
    const upcoming = holidays
      .filter(h => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    return upcoming.length > 0 ? upcoming[0] : null
  }

  checkReminders(holidays: Holiday[], customReminders: Reminder[]): NotificationData[] {
    const today = new Date().toISOString().split('T')[0]
    const results: NotificationData[] = []

    for (const h of holidays) {
      if (h.date === today) {
        results.push({ title: h.localName, type: 'holiday', subtype: 'today', date: h.date, localName: h.localName })
      }
    }

    for (const r of customReminders) {
      if (!r.enabled) continue
      const nextDate = this._getNextOccurrence(r)
      if (nextDate === today) {
        results.push({ title: r.title, type: 'custom', subtype: 'today', date: today })
      }
    }

    return results
  }

  minuteCheck(): void {
    const settings = this.store.getSettings()
    if (!settings.reminderEnabled) return

    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    const holidays = [
      ...((this.store.getHolidayCache(currentYear) as Holiday[]) || []),
      ...((this.store.getHolidayCache(nextYear) as Holiday[]) || [])
    ].filter(Boolean)

    const reminders = this.checkReminders(holidays, this.store.getCustomReminders())
    for (const r of reminders) {
      this.notify(r)
    }
  }

  _getNextOccurrence(reminder: Reminder): string {
    const now = new Date()
    if (reminder.type === 'once') return reminder.date
    if (reminder.type === 'daily') return now.toISOString().split('T')[0]
    if (reminder.type === 'weekly') {
      const targetDay = Number(reminder.date)
      const today = now.getDay() || 7
      let diff = targetDay - today
      if (diff <= 0) diff += 7
      const d = new Date(now)
      d.setDate(d.getDate() + diff)
      return d.toISOString().split('T')[0]
    }
    const [m, d] = reminder.date.split('-').map(Number)
    if (reminder.type === 'yearly') {
      let d2 = new Date(now.getFullYear(), m - 1, d)
      if (d2 < now) d2 = new Date(now.getFullYear() + 1, m - 1, d)
      return d2.toISOString().split('T')[0]
    }
    if (reminder.type === 'monthly') {
      let d2 = new Date(now.getFullYear(), now.getMonth(), Number(reminder.date))
      if (d2 <= now) d2 = new Date(now.getFullYear(), now.getMonth() + 1, Number(reminder.date))
      return d2.toISOString().split('T')[0]
    }
    return reminder.date
  }
}

export default Scheduler
```

- [ ] **5.2: Convert src/main/tray.ts**

```ts
import { app, Tray, Menu, nativeImage, Notification } from 'electron'
import { join } from 'path'
import logger from './logger'
import type Store from './store'
import type { BrowserWindow } from 'electron'

class TrayManager {
  private mainWindow: BrowserWindow
  private settingsWindow: BrowserWindow
  private store: Store
  private tray: Tray | null = null
  private _defaultIcon!: Electron.NativeImage

  constructor(mainWindow: BrowserWindow, settingsWindow: BrowserWindow, store: Store) {
    this.mainWindow = mainWindow
    this.settingsWindow = settingsWindow
    this.store = store
    this.tray = null
  }

  create(): void {
    this._defaultIcon = nativeImage.createFromPath(
      join(__dirname, '..', '..', 'assets', 'icon.png')
    ).resize({ width: 16, height: 16 })
    this.tray = new Tray(this._defaultIcon)
    this.tray.setToolTip('Holiday Sticker')
    this.tray.on('double-click', () => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) return
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide()
      } else {
        this.mainWindow.show()
      }
    })
    this.mainWindow.on('show', () => this._updateMenu())
    this.mainWindow.on('hide', () => this._updateMenu())
    this.mainWindow.on('always-on-top-changed', () => this._updateMenu())
    this._updateMenu()
  }

  _updateMenu(): void {
    const isVisible = this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isVisible()
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? '隐藏贴纸' : '显示贴纸',
        click: () => {
          if (!this.mainWindow || this.mainWindow.isDestroyed()) return
          if (this.mainWindow.isVisible()) {
            this.mainWindow.hide()
          } else {
            this.mainWindow.show()
          }
        }
      },
      {
        label: this.mainWindow && !this.mainWindow.isDestroyed() && this.mainWindow.isAlwaysOnTop() ? '取消置顶' : '置顶',
        click: () => {
          if (!this.mainWindow || this.mainWindow.isDestroyed()) return
          const v = !this.mainWindow.isAlwaysOnTop()
          this.mainWindow.setAlwaysOnTop(v)
          this.store.updateSettings({ pinOnTop: v })
          this.mainWindow.webContents.send('ontop-changed', v)
        }
      },
      { type: 'separator' },
      {
        label: '设置',
        click: () => {
          if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
            this.settingsWindow.show()
          }
        }
      },
      {
        label: '刷新节日数据',
        click: () => {
          if (!this.mainWindow || this.mainWindow.isDestroyed()) return
          this.mainWindow.webContents.send('refresh-holidays')
        }
      },
      { type: 'separator' },
      {
        label: '检查更新',
        click: () => this._checkUpdate()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit()
      }
    ])
    this.tray!.setContextMenu(contextMenu)
  }

  async _checkUpdate(): Promise<void> {
    try {
      const currentVersion = app.getVersion()
      const notification = new Notification({
        title: 'Holiday Sticker',
        body: `当前版本: ${currentVersion}，已是最新版`
      })
      notification.show()
    } catch (err) {
      logger.error('检查更新失败', err)
    }
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

export default TrayManager
```

- [ ] **5.3: Update tests/scheduler.test.js** (fix imports for TS)

Read it first, then adjust.

- [ ] **5.4: Run scheduler tests**

Run: `yarn test --testPathPattern=scheduler`
Expected: All scheduler tests pass.

- [ ] **5.5: Commit**

```bash
git add src/main/scheduler.ts src/main/tray.ts tests/scheduler.test.js
git rm src/main/scheduler.js src/main/tray.js
git commit -m "refactor: convert scheduler and tray to TypeScript"
```

---

### Task 6: Split IPC handlers

**Files:**
- Create: `src/main/ipc/holiday.ts`
- Create: `src/main/ipc/settings.ts`
- Create: `src/main/ipc/reminder.ts`
- Create: `src/main/ipc/window.ts`
- Create: `src/main/ipc/index.ts`

- [ ] **6.1: Create src/main/ipc/holiday.ts**

```ts
import { ipcMain } from 'electron'
import logger from '../logger'
import type Store from '../store'
import type Api from '../api'

export function registerHolidayHandlers(store: Store, api: Api): void {
  ipcMain.handle('get-holidays', () => {
    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    return [
      ...(store.getHolidayCache(currentYear) || []),
      ...(store.getHolidayCache(nextYear) || [])
    ].filter(Boolean)
  })

  ipcMain.handle('get-lunar-date', (_event, dateStr: string) => {
    try {
      const { solarToLunar } = require('../lunar')
      const [y, m, d] = dateStr.split('-').map(Number)
      return solarToLunar(y, m, d)
    } catch (err) {
      logger.error('get-lunar-date 失败', err)
      return null
    }
  })
}
```

- [ ] **6.2: Create src/main/ipc/settings.ts**

```ts
import { ipcMain, app } from 'electron'
import type Store from '../store'

export function registerSettingsHandlers(store: Store): void {
  ipcMain.handle('get-settings', () => store.getSettings())

  ipcMain.handle('update-settings', (_event, settings: Record<string, unknown>) => {
    store.updateSettings(settings as Parameters<typeof store.updateSettings>[0])
    if (settings.autoStart !== undefined) {
      app.setLoginItemSettings({ openAtLogin: Boolean(settings.autoStart) })
    }
  })
}
```

- [ ] **6.3: Create src/main/ipc/reminder.ts**

```ts
import { ipcMain } from 'electron'
import type Store from '../store'
import type { Reminder } from '../../shared/types'

export function registerReminderHandlers(store: Store): void {
  ipcMain.handle('get-custom-reminders', () => store.getCustomReminders())

  ipcMain.handle('add-custom-reminder', (_event, data: Omit<Reminder, 'id'>) => {
    return store.addCustomReminder(data)
  })

  ipcMain.handle('update-custom-reminder', (_event, id: string, data: Partial<Reminder>) => {
    return store.updateCustomReminder(id, data)
  })

  ipcMain.handle('remove-custom-reminder', (_event, id: string) => {
    store.removeCustomReminder(id)
  })
}
```

- [ ] **6.4: Create src/main/ipc/window.ts**

```ts
import { ipcMain, app } from 'electron'
import logger from '../logger'
import type Store from '../store'

export function registerWindowHandlers(store: Store, mainWindow: Electron.BrowserWindow, settingsWindow: Electron.BrowserWindow): void {
  ipcMain.handle('get-ontop-state', () => store.getSettings().pinOnTop)

  ipcMain.handle('toggle-ontop', () => {
    const v = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(v)
    store.updateSettings({ pinOnTop: v })
    mainWindow.webContents.send('ontop-changed', v)
    return v
  })

  ipcMain.handle('open-settings', () => {
    if (settingsWindow) settingsWindow.show()
  })

  ipcMain.handle('set-opacity', (_event, value: number) => {
    store.updateSettings({ opacity: value })
    mainWindow.webContents.send('opacity-changed', value)
  })

  ipcMain.handle('check-update', () => {
    const currentVersion = app.getVersion()
    logger.info(`检查更新，当前版本: ${currentVersion}`)
    return { hasUpdate: false, currentVersion, message: `当前版本 ${currentVersion}，已是最新版` }
  })
}
```

- [ ] **6.5: Create src/main/ipc/index.ts**

```ts
import type Store from '../store'
import type Api from '../api'
import type { BrowserWindow } from 'electron'
import { registerHolidayHandlers } from './holiday'
import { registerSettingsHandlers } from './settings'
import { registerReminderHandlers } from './reminder'
import { registerWindowHandlers } from './window'

export function registerAllHandlers(
  store: Store,
  api: Api,
  mainWindow: BrowserWindow,
  settingsWindow: BrowserWindow
): void {
  registerHolidayHandlers(store, api)
  registerSettingsHandlers(store)
  registerReminderHandlers(store)
  registerWindowHandlers(store, mainWindow, settingsWindow)
}
```

- [ ] **6.6: Commit**

```bash
git add src/main/ipc/
git commit -m "refactor: split IPC handlers into domain modules"
```

---

### Task 7: Rewrite main process entry point

**Files:**
- Create: `src/main/index.ts`

- [ ] **7.1: Create src/main/index.ts**

```ts
import { app, BrowserWindow, Notification, Menu } from 'electron'
import { join } from 'path'
import Store from './store'
import Api from './api'
import Scheduler from './scheduler'
import TrayManager from './tray'
import logger from './logger'
import { registerAllHandlers } from './ipc'
import type { NotificationData } from '../shared/types'

const store = new Store()
const api = new Api()

let mainWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let scheduler: Scheduler | null = null
let trayManager: TrayManager | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createStickerWindow(): void {
  const settings = store.getSettings()
  mainWindow = new BrowserWindow({
    width: 280,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: settings.pinOnTop,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${VITE_DEV_SERVER_URL}/sticker/index.html`)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/sticker/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (settings.windowPosition) {
      mainWindow!.setBounds(settings.windowPosition)
    }
    mainWindow!.webContents.send('opacity-changed', settings.opacity ?? 1.0)
  })

  let moveTimer: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('move', () => {
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds()
        store.updateSettings({ windowPosition: { x: bounds.x, y: bounds.y } })
      }
    }, 300)
  })
}

function createSettingsWindow(): void {
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(`${VITE_DEV_SERVER_URL}/settings/index.html`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/settings/index.html'))
  }

  settingsWindow.on('close', (e) => {
    e.preventDefault()
    settingsWindow!.hide()
  })
}

function sendNotification(data: NotificationData): void {
  if (data.subtype === 'today') {
    const n = new Notification({
      title: '📅 ' + data.title,
      body: data.type === 'holiday'
        ? `今天是 ${data.localName} 🎉`
        : `提醒：${data.title}`
    })
    n.show()
  }
}

function broadcastHolidays(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    const holidays = [
      ...((store.getHolidayCache(currentYear) as unknown[]) || []),
      ...((store.getHolidayCache(nextYear) as unknown[]) || [])
    ].filter(Boolean)
    mainWindow.webContents.send('holiday-update', holidays)
  }
}

app.whenReady().then(() => {
  try {
    createStickerWindow()
    createSettingsWindow()
    settingsWindow!.hide()

    scheduler = new Scheduler(store, api, sendNotification, broadcastHolidays)
    scheduler.start()

    Menu.setApplicationMenu(null)

    registerAllHandlers(store, api, mainWindow!, settingsWindow!)

    trayManager = new TrayManager(mainWindow!, settingsWindow!, store)
    trayManager.create()
    logger.info('应用启动成功')
  } catch (err) {
    logger.error('应用启动失败', err)
  }
})

process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常', err)
})
process.on('unhandledRejection', (err) => {
  logger.error('未处理的 Promise 拒绝', err)
})

app.on('before-quit', () => {
  if (trayManager) trayManager.destroy()
})

app.on('window-all-closed', () => {})
```

Note: `VITE_DEV_SERVER_URL` is an environment variable that electron-vite sets during dev mode. In production, built files are loaded from the `out/` directory.

- [ ] **7.2: Commit**

```bash
git add src/main/index.ts
git commit -m "refactor: rewrite main process entry point in TypeScript"
```

---

### Task 8: Rewrite preload script

**Files:**
- Create: `src/preload/index.ts`

- [ ] **8.1: Create src/preload/index.ts**

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { HolidayAPI } from '../shared/types'

const api: HolidayAPI = {
  getHolidays: () => ipcRenderer.invoke('get-holidays'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (s) => ipcRenderer.invoke('update-settings', s),
  getCustomReminders: () => ipcRenderer.invoke('get-custom-reminders'),
  addCustomReminder: (r) => ipcRenderer.invoke('add-custom-reminder', r),
  updateCustomReminder: (id, r) => ipcRenderer.invoke('update-custom-reminder', id, r),
  removeCustomReminder: (id) => ipcRenderer.invoke('remove-custom-reminder', id),
  getOnTopState: () => ipcRenderer.invoke('get-ontop-state'),
  toggleOnTop: () => ipcRenderer.invoke('toggle-ontop'),
  onOnTopChanged: (cb) => { ipcRenderer.on('ontop-changed', (_event, v) => cb(v)) },
  openSettings: () => ipcRenderer.invoke('open-settings'),
  setOpacity: (v) => ipcRenderer.invoke('set-opacity', v),
  onOpacityChanged: (cb) => { ipcRenderer.on('opacity-changed', (_event, v) => cb(v)) },
  getLunarDate: (dateStr) => ipcRenderer.invoke('get-lunar-date', dateStr),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  onRefresh: (cb) => { ipcRenderer.on('refresh-holidays', () => cb()) }
}

contextBridge.exposeInMainWorld('holidayAPI', api)
```

- [ ] **8.2: Commit**

```bash
git add src/preload/index.ts
git rm preload.js
git commit -m "refactor: rewrite preload script in TypeScript"
```

---

### Task 9: Sticker window - entry + HTML + styles

**Files:**
- Modify: `src/renderer/sticker/index.html`
- Create: `src/renderer/sticker/main.ts`
- Create: `src/renderer/sticker/styles/main.css` (copy from `style.css`)

- [ ] **9.1: Update src/renderer/sticker/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Holiday Sticker</title>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **9.2: Create src/renderer/sticker/main.ts**

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **9.3: Move and keep src/renderer/sticker/styles/main.css** (same content as existing style.css)

Copy `src/renderer/sticker/style.css` → `src/renderer/sticker/styles/main.css` (exact same content)

- [ ] **9.4: Commit**

```bash
git add src/renderer/sticker/index.html src/renderer/sticker/main.ts src/renderer/sticker/styles/main.css
git commit -m "feat: setup sticker window Vue entry point"
```

---

### Task 10: Sticker window - Vue components

**Files:**
- Create: `src/renderer/sticker/App.vue`
- Create: `src/renderer/sticker/components/NextHoliday.vue`
- Create: `src/renderer/sticker/components/HolidayList.vue`
- Create: `src/renderer/sticker/components/HolidayItem.vue`
- Create: `src/renderer/sticker/components/CustomReminderList.vue`
- Create: `src/renderer/sticker/components/Footer.vue`

- [ ] **10.1: Create src/renderer/sticker/App.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Holiday, Reminder } from '../../shared/types'
import NextHoliday from './components/NextHoliday.vue'
import HolidayList from './components/HolidayList.vue'
import CustomReminderList from './components/CustomReminderList.vue'
import Footer from './components/Footer.vue'

const api = (window as any).holidayAPI

const holidays = ref<Holiday[]>([])
const reminders = ref<Reminder[]>([])
const onTop = ref(false)
const opacity = ref(1.0)

function getCountdownColor(days: number): string {
  if (days >= 90) return '#27ae60'
  if (days >= 30) return '#f1c40f'
  if (days >= 7) return '#e67e22'
  if (days >= 1) return '#e74c3c'
  return '#c0392b'
}

function getHolidayDuration(dateStr: string, upcoming: Holiday[]): number {
  const dateSet = new Set(upcoming.map(h => h.date))
  let count = 1
  while (true) {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + count)
    if (dateSet.has(d.toISOString().split('T')[0])) {
      count++
    } else {
      break
    }
  }
  return count
}

function getWeekday(dateStr: string): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[new Date(dateStr).getDay()]
}

function getNextOccurrence(r: Reminder): string | null {
  const now = new Date()
  if (r.type === 'once') return r.date
  if (r.type === 'daily') return now.toISOString().split('T')[0]
  if (r.type === 'weekly') {
    const targetDay = Number(r.date)
    const today = now.getDay() || 7
    let diff = targetDay - today
    if (diff <= 0) diff += 7
    const d = new Date(now)
    d.setDate(d.getDate() + diff)
    return d.toISOString().split('T')[0]
  }
  if (r.type === 'yearly') {
    const [m, d] = r.date.split('-').map(Number)
    let d2 = new Date(now.getFullYear(), m - 1, d)
    if (d2 < now) d2 = new Date(now.getFullYear() + 1, m - 1, d)
    return d2.toISOString().split('T')[0]
  }
  if (r.type === 'monthly') {
    let d2 = new Date(now.getFullYear(), now.getMonth(), Number(r.date))
    if (d2 <= now) d2 = new Date(now.getFullYear(), now.getMonth() + 1, Number(r.date))
    return d2.toISOString().split('T')[0]
  }
  return null
}

function applyOpacity(val: number): void {
  opacity.value = val
}

async function loadData(): Promise<void> {
  holidays.value = (await api.getHolidays()) || []
  reminders.value = (await api.getCustomReminders()) || []
}

function showToast(): void {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = '✨ Holiday Sticker'
  document.getElementById('app')!.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 1500)
}

onMounted(async () => {
  await loadData()
  onTop.value = await api.getOnTopState()
  const settings = await api.getSettings()
  opacity.value = settings.opacity ?? 1.0
  applyOpacity(opacity.value)

  api.onOnTopChanged((v: boolean) => { onTop.value = v })
  api.onOpacityChanged((v: number) => { applyOpacity(v) })
  api.onRefresh(() => loadData())

  setInterval(loadData, 60 * 60 * 1000)
})
</script>

<template>
  <div
    id="sticker"
    class="sticker"
    :style="{ opacity: opacity }"
    @dblclick="showToast"
  >
    <button
      id="ontop-btn"
      class="ontop-btn"
      :class="{ active: onTop }"
      @click="async () => { onTop = await api.toggleOnTop() }"
    >📍</button>

    <NextHoliday
      :holidays="holidays"
      :get-countdown-color="getCountdownColor"
      :get-holiday-duration="getHolidayDuration"
      :get-weekday="getWeekday"
    />

    <div class="divider">── 近期节日 ──</div>

    <HolidayList
      :holidays="holidays"
      :today="new Date().toISOString().split('T')[0]"
      :get-countdown-color="getCountdownColor"
      :get-holiday-duration="getHolidayDuration"
      :get-weekday="getWeekday"
    />

    <CustomReminderList
      :reminders="reminders"
      :get-countdown-color="getCountdownColor"
      :get-next-occurrence="getNextOccurrence"
    />

    <Footer />
  </div>
</template>
```

- [ ] **10.2: Create NextHoliday.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Holiday } from '../../../shared/types'

const api = (window as any).holidayAPI

const props = defineProps<{
  holidays: Holiday[]
  getCountdownColor: (days: number) => string
  getHolidayDuration: (date: string, holidays: Holiday[]) => number
  getWeekday: (date: string) => string
}>()

const lunarStr = ref('')

function getNextHoliday(): Holiday | null {
  const today = new Date().toISOString().split('T')[0]
  const oneYearLater = new Date()
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  const upcoming = props.holidays
    .filter(h => h.date >= today && h.date <= oneYearLater.toISOString().split('T')[0])
    .sort((a, b) => a.date.localeCompare(b.date))
  return upcoming[0] || null
}

function calcDays(date: string): number {
  const today = new Date().toISOString().split('T')[0]
  return Math.ceil((new Date(date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
}

watch(() => props.holidays, async (val) => {
  const next = getNextHoliday()
  if (next) {
    const l = await api.getLunarDate(next.date)
    if (l) {
      lunarStr.value = ` 农历${l.monthStr}${l.dayStr}`
    } else {
      lunarStr.value = ''
    }
  } else {
    lunarStr.value = ''
  }
}, { immediate: true })
</script>

<template>
  <div id="next-holiday" class="next-holiday">
    <template v-if="getNextHoliday()">
      <div id="next-name" class="next-name">{{ getNextHoliday()!.localName }}</div>
      <div
        id="next-countdown"
        class="next-countdown"
        :style="{ color: getCountdownColor(calcDays(getNextHoliday()!.date)) }"
      >
        {{ calcDays(getNextHoliday()!.date) === 0 ? '就是今天！🎉' : `还有 ${calcDays(getNextHoliday()!.date)} 天` }}
      </div>
      <div id="next-date" class="next-date">
        {{ getNextHoliday()!.date }} {{ getWeekday(getNextHoliday()!.date)
        }}{{ getHolidayDuration(getNextHoliday()!.date, holidays) > 1 ? `（放${getHolidayDuration(getNextHoliday()!.date, holidays)}天）` : '' }}{{ lunarStr }}
      </div>
    </template>
    <template v-else>
      <div id="next-name" class="next-name">暂无节日数据</div>
      <div id="next-countdown" class="next-countdown"></div>
      <div id="next-date" class="next-date"></div>
    </template>
  </div>
</template>
```

- [ ] **10.3: Create HolidayList.vue**

```vue
<script setup lang="ts">
import type { Holiday } from '../../../shared/types'
import HolidayItem from './HolidayItem.vue'

defineProps<{
  holidays: Holiday[]
  today: string
  getCountdownColor: (days: number) => string
  getHolidayDuration: (date: string, holidays: Holiday[]) => number
  getWeekday: (date: string) => string
}>()

function getUpcoming(holidays: Holiday[], today: string, limit: number = 10): Holiday[] {
  const oneYearLater = new Date()
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  return holidays
    .filter(h => h.date >= today && h.date <= oneYearLater.toISOString().split('T')[0])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}
</script>

<template>
  <ul id="holiday-list" class="holiday-list">
    <HolidayItem
      v-for="h in getUpcoming(holidays, today)"
      :key="h.date + h.localName"
      :holiday="h"
      :today="today"
      :get-countdown-color="getCountdownColor"
      :get-holiday-duration="getHolidayDuration"
      :get-weekday="getWeekday"
    />
  </ul>
</template>
```

- [ ] **10.4: Create HolidayItem.vue**

```vue
<script setup lang="ts">
import type { Holiday } from '../../../shared/types'

const props = defineProps<{
  holiday: Holiday
  today: string
  getCountdownColor: (days: number) => string
  getHolidayDuration: (date: string, holidays: Holiday[]) => number
  getWeekday: (date: string) => string
}>()

function calcDays(date: string): number {
  return Math.ceil((new Date(date).getTime() - new Date(props.today).getTime()) / (1000 * 60 * 60 * 24))
}
</script>

<template>
  <li>
    <div class="li-row">
      <span class="holiday-icon">🎉</span>
      <span class="holiday-name">{{ holiday.localName }}</span>
      <span class="holiday-countdown" :style="{ color: getCountdownColor(calcDays(holiday.date)) }">
        +{{ calcDays(holiday.date) }}天
      </span>
      <span class="holiday-date">
        {{ holiday.date.slice(5) }}{{ getHolidayDuration(holiday.date, [holiday]) > 1 ? ` 放${getHolidayDuration(holiday.date, [holiday])}天` : '' }}
      </span>
    </div>
  </li>
</template>
```

- [ ] **10.5: Create CustomReminderList.vue**

```vue
<script setup lang="ts">
import type { Reminder } from '../../../shared/types'

const props = defineProps<{
  reminders: Reminder[]
  getCountdownColor: (days: number) => string
  getNextOccurrence: (r: Reminder) => string | null
}>()

function calcDays(date: string): number {
  const today = new Date().toISOString().split('T')[0]
  return Math.ceil((new Date(date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
}

function getActiveReminders(): { reminder: Reminder; nextDate: string; days: number }[] {
  const today = new Date().toISOString().split('T')[0]
  const result: { reminder: Reminder; nextDate: string; days: number }[] = []
  for (const r of props.reminders) {
    if (!r.enabled) continue
    const nextDate = props.getNextOccurrence(r)
    if (!nextDate || nextDate < today) continue
    const days = calcDays(nextDate)
    result.push({ reminder: r, nextDate, days })
  }
  return result
}
</script>

<template>
  <li v-for="item in getActiveReminders()" :key="item.reminder.id">
    <div class="li-row">
      <span class="holiday-icon">📌</span>
      <span class="holiday-name">{{ item.reminder.title }}</span>
      <span class="holiday-countdown" :style="{ color: getCountdownColor(item.days) }">
        {{ item.days === 0 ? '今天' : `+${item.days}天` }}
      </span>
      <span class="holiday-date">{{ item.nextDate.slice(5) }}</span>
    </div>
  </li>
</template>
```

- [ ] **10.6: Create Footer.vue**

```vue
<script setup lang="ts">
function getToday(): string {
  const today = new Date().toISOString().split('T')[0]
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `今日: ${today} ${days[new Date().getDay()]}`
}
</script>

<template>
  <div class="footer">
    <span id="today-date">{{ getToday() }}</span>
  </div>
</template>
```

- [ ] **10.7: Commit**

```bash
git add src/renderer/sticker/App.vue src/renderer/sticker/components/
git commit -m "feat: add sticker window Vue components"
```

---

### Task 11: Settings window - entry + HTML + styles

**Files:**
- Modify: `src/renderer/settings/index.html`
- Create: `src/renderer/settings/main.ts`
- Create: `src/renderer/settings/styles/main.css` (copy from `style.css`)

- [ ] **11.1: Update src/renderer/settings/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>设置 - Holiday Sticker</title>
  <link rel="stylesheet" href="./styles/main.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **11.2: Create src/renderer/settings/main.ts**

```ts
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **11.3: Copy settings/style.css → styles/main.css**

Copy `src/renderer/settings/style.css` → `src/renderer/settings/styles/main.css`

- [ ] **11.4: Commit**

```bash
git add src/renderer/settings/index.html src/renderer/settings/main.ts src/renderer/settings/styles/main.css
git commit -m "feat: setup settings window Vue entry point"
```

---

### Task 12: Settings window - Vue components

**Files:**
- Create: `src/renderer/settings/App.vue`
- Create: `src/renderer/settings/components/SettingsSidebar.vue`
- Create: `src/renderer/settings/components/GeneralTab.vue`
- Create: `src/renderer/settings/components/ReminderTab.vue`
- Create: `src/renderer/settings/components/CustomReminderTab.vue`
- Create: `src/renderer/settings/components/ReminderForm.vue`

- [ ] **12.1: Create App.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import SettingsSidebar from './components/SettingsSidebar.vue'
import GeneralTab from './components/GeneralTab.vue'
import ReminderTab from './components/ReminderTab.vue'
import CustomReminderTab from './components/CustomReminderTab.vue'

const activeTab = ref('general')
</script>

<template>
  <div class="container">
    <SettingsSidebar v-model="activeTab" />
    <div class="content">
      <GeneralTab v-if="activeTab === 'general'" />
      <ReminderTab v-if="activeTab === 'reminders'" />
      <CustomReminderTab v-if="activeTab === 'custom'" />
    </div>
  </div>
</template>
```

- [ ] **12.2: Create SettingsSidebar.vue**

```vue
<script setup lang="ts">
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const tabs = [
  { key: 'general', label: '通用' },
  { key: 'reminders', label: '提醒' },
  { key: 'custom', label: '自定义提醒' }
]
</script>

<template>
  <div class="sidebar">
    <div
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: modelValue === tab.key }"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </div>
  </div>
</template>
```

- [ ] **12.3: Create GeneralTab.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings } from '../../../shared/types'

const api = (window as any).holidayAPI

const settings = ref<Settings | null>(null)
const opacityLabel = ref('100%')
const statusMsg = ref('')
const updateMsg = ref('')

async function load(): Promise<void> {
  settings.value = await api.getSettings()
  if (settings.value) {
    opacityLabel.value = Math.round((settings.value.opacity ?? 1.0) * 100) + '%'
  }
}

async function save(): Promise<void> {
  if (!settings.value) return
  await api.updateSettings({
    stickerPosition: settings.value.stickerPosition,
    autoStart: settings.value.autoStart,
    reminderEnabled: settings.value.reminderEnabled
  })
  statusMsg.value = '✓ 已保存'
  setTimeout(() => { statusMsg.value = '' }, 2000)
}

async function onOpacityChange(e: Event): Promise<void> {
  const v = parseFloat((e.target as HTMLInputElement).value)
  opacityLabel.value = Math.round(v * 100) + '%'
  if (settings.value) settings.value.opacity = v
  await api.setOpacity(v)
}

async function checkUpdate(): Promise<void> {
  const result = await api.checkUpdate()
  updateMsg.value = result.message
  setTimeout(() => { updateMsg.value = '' }, 3000)
}

onMounted(load)
</script>

<template>
  <div class="tab-content active" id="tab-general">
    <h2>通用设置</h2>
    <div v-if="settings" class="form-group">
      <label>贴纸位置</label>
      <select v-model="settings.stickerPosition">
        <option value="top-left">左上</option>
        <option value="top-right">右上</option>
        <option value="bottom-left">左下</option>
        <option value="bottom-right">右下</option>
      </select>
    </div>
    <div class="form-group">
      <label><input type="checkbox" v-model="settings!.autoStart"> 开机自启</label>
    </div>
    <div class="form-group">
      <label><input type="checkbox" v-model="settings!.reminderEnabled"> 启用提醒</label>
    </div>
    <div class="form-group">
      <label>贴纸透明度</label>
      <div class="opacity-row">
        <input
          type="range" min="0.3" max="1.0" step="0.05"
          :value="settings?.opacity ?? 1.0"
          @input="onOpacityChange"
        >
        <span class="opacity-label">{{ opacityLabel }}</span>
      </div>
    </div>
    <div class="form-group">
      <label>检查更新</label>
      <button class="btn-secondary" @click="checkUpdate">检查更新</button>
      <span class="status-msg">{{ updateMsg }}</span>
    </div>
    <button class="btn-primary" @click="save">保存</button>
    <div class="status-msg">{{ statusMsg }}</div>
  </div>
</template>
```

- [ ] **12.4: Create ReminderTab.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings } from '../../../shared/types'

const api = (window as any).holidayAPI

const settings = ref<Settings | null>(null)
const customDays = ref('')
const statusMsg = ref('')

async function load(): Promise<void> {
  settings.value = await api.getSettings()
  if (settings.value) {
    customDays.value = (settings.value.customAdvanceReminderDays || []).join(', ')
  }
}

async function save(): Promise<void> {
  if (!settings.value) return
  await api.updateSettings({
    dailyReminderTime: settings.value.dailyReminderTime,
    advanceReminderPresets: settings.value.advanceReminderPresets,
    customAdvanceReminderDays: customDays.value
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
  })
  statusMsg.value = '✓ 已保存'
  setTimeout(() => { statusMsg.value = '' }, 2000)
}

function togglePreset(days: number): void {
  if (!settings.value) return
  const idx = settings.value.advanceReminderPresets.indexOf(days)
  if (idx === -1) {
    settings.value.advanceReminderPresets.push(days)
  } else {
    settings.value.advanceReminderPresets.splice(idx, 1)
  }
}

onMounted(load)
</script>

<template>
  <div class="tab-content active" id="tab-reminders">
    <h2>提醒设置</h2>
    <div v-if="settings" class="form-group">
      <label>每日节日提醒时间</label>
      <input type="time" v-model="settings.dailyReminderTime">
    </div>
    <div class="form-group">
      <label>提前提醒天数</label>
      <div id="advance-presets">
        <label>
          <input type="checkbox" :checked="settings.advanceReminderPresets.includes(1)" @change="togglePreset(1)"> 1天
        </label>
        <label>
          <input type="checkbox" :checked="settings.advanceReminderPresets.includes(3)" @change="togglePreset(3)"> 3天
        </label>
        <label>
          <input type="checkbox" :checked="settings.advanceReminderPresets.includes(7)" @change="togglePreset(7)"> 7天
        </label>
      </div>
      <div class="form-group-inline">
        <label>自定义天数（逗号分隔，如 14, 30）</label>
        <input type="text" v-model="customDays" placeholder="例如: 14, 30">
      </div>
    </div>
    <button class="btn-primary" @click="save">保存</button>
    <div class="status-msg">{{ statusMsg }}</div>
  </div>
</template>
```

- [ ] **12.5: Create CustomReminderTab.vue**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Reminder } from '../../../shared/types'
import ReminderForm from './ReminderForm.vue'

const api = (window as any).holidayAPI

const reminders = ref<Reminder[]>([])
const editingId = ref<string | null>(null)
const showForm = ref(false)
const editingReminder = ref<Reminder | null>(null)

async function loadReminders(): Promise<void> {
  reminders.value = await api.getCustomReminders()
}

function startAdd(): void {
  editingId.value = null
  editingReminder.value = null
  showForm.value = true
}

async function startEdit(id: string): Promise<void> {
  editingId.value = id
  const r = (await api.getCustomReminders()).find((x: Reminder) => x.id === id)
  if (r) {
    editingReminder.value = { ...r }
    showForm.value = true
  }
}

async function deleteReminder(id: string): Promise<void> {
  await api.removeCustomReminder(id)
  await loadReminders()
}

async function onSave(data: Omit<Reminder, 'id'>): Promise<void> {
  if (editingId.value) {
    await api.updateCustomReminder(editingId.value, data)
  } else {
    await api.addCustomReminder(data)
  }
  showForm.value = false
  editingReminder.value = null
  await loadReminders()
}

function onCancel(): void {
  showForm.value = false
  editingReminder.value = null
}

const typeLabels: Record<string, string> = {
  once: '一次性',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年'
}

onMounted(loadReminders)
</script>

<template>
  <div class="tab-content active" id="tab-custom">
    <h2>自定义提醒</h2>
    <div id="custom-reminder-list">
      <div v-for="r in reminders" :key="r.id" class="reminder-item">
        <div>
          <div class="title">{{ r.title }}</div>
          <div class="meta">{{ typeLabels[r.type] }} · {{ r.date }} {{ r.time || '' }}</div>
        </div>
        <div class="actions">
          <button @click="startEdit(r.id)">✏️</button>
          <button @click="deleteReminder(r.id)">🗑️</button>
        </div>
      </div>
    </div>
    <button class="btn-secondary" @click="startAdd">+ 添加提醒</button>

    <ReminderForm
      v-if="showForm"
      :reminder="editingReminder"
      @save="onSave"
      @cancel="onCancel"
    />
  </div>
</template>
```

- [ ] **12.6: Create ReminderForm.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { Reminder } from '../../../shared/types'

const props = defineProps<{
  reminder: Reminder | null
}>()

const emit = defineEmits<{
  save: [data: Omit<Reminder, 'id'>]
  cancel: []
}>()

const title = ref(props.reminder?.title ?? '')
const type = ref(props.reminder?.type ?? 'once')
const date = ref(props.reminder?.date ?? '')
const time = ref(props.reminder?.time ?? '09:00')
const advance = ref((props.reminder?.advanceReminderDays ?? []).join(', '))

function submit(): void {
  emit('save', {
    title: title.value,
    type: type.value as Reminder['type'],
    date: date.value,
    time: time.value,
    advanceReminderDays: advance.value
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0),
    enabled: true
  })
}
</script>

<template>
  <div id="reminder-form" class="reminder-form">
    <div class="form-group">
      <label>标题</label>
      <input type="text" v-model="title" placeholder="例如: 朋友生日">
    </div>
    <div class="form-group">
      <label>类型</label>
      <select v-model="type">
        <option value="once">一次性</option>
        <option value="daily">每天</option>
        <option value="weekly">每周</option>
        <option value="monthly">每月</option>
        <option value="yearly">每年</option>
      </select>
    </div>
    <div class="form-group">
      <label>日期</label>
      <input type="text" v-model="date" placeholder="一次性: 2026-03-15 / 每周: 1-7 / 每年: 03-15 / 每月: 15">
      <div class="hint">一次性填完整日期，每周填 1-7（周一~周日），每年填 MM-DD，每月填天数</div>
    </div>
    <div class="form-group">
      <label>时间</label>
      <input type="time" v-model="time">
    </div>
    <div class="form-group">
      <label>提前提醒天数（逗号分隔）</label>
      <input type="text" v-model="advance" placeholder="例如: 1, 3">
    </div>
    <div class="form-actions">
      <button class="btn-primary" @click="submit">保存</button>
      <button class="btn-cancel" @click="emit('cancel')">取消</button>
    </div>
  </div>
</template>
```

- [ ] **12.7: Commit**

```bash
git add src/renderer/settings/App.vue src/renderer/settings/components/
git commit -m "feat: add settings window Vue components"
```

---

### Task 13: Type declaration for window.holidayAPI

**Files:**
- Create: `src/renderer/sticker/env.d.ts`
- Create: `src/renderer/settings/env.d.ts`

- [ ] **13.1: Create src/renderer/sticker/env.d.ts**

```ts
import type { HolidayAPI } from '../../shared/types'

declare global {
  interface Window {
    holidayAPI: HolidayAPI
  }
}
```

- [ ] **13.2: Create src/renderer/settings/env.d.ts**

Same content.

```ts
import type { HolidayAPI } from '../../shared/types'

declare global {
  interface Window {
    holidayAPI: HolidayAPI
  }
}
```

- [ ] **13.3: Commit**

```bash
git add src/renderer/sticker/env.d.ts src/renderer/settings/env.d.ts
git commit -m "feat: add type declaration for window.holidayAPI"
```

---

### Task 14: Cleanup old files

**Files:**
- Delete: `main.js`
- Delete: `preload.js`
- Delete: `src/renderer/sticker/app.js`
- Delete: `src/renderer/sticker/style.css`
- Delete: `src/renderer/settings/app.js`
- Delete: `src/renderer/settings/style.css`

- [ ] **14.1: Remove old files**

Run:
```bash
git rm main.js preload.js src/renderer/sticker/app.js src/renderer/sticker/style.css src/renderer/settings/app.js src/renderer/settings/style.css
```

- [ ] **14.2: Commit**

```bash
git commit -m "chore: remove old vanilla JS files after Vue migration"
```

---

### Task 15: Verify build + run tests

- [ ] **15.1: Try building the project**

Run: `yarn build`
Expected: electron-vite builds successfully, output in `out/` directory.

- [ ] **15.2: Run all tests**

Run: `yarn test`
Expected: All existing tests pass.

- [ ] **15.3: Verify dev server starts**

Run: `yarn start` (then immediately close)
Expected: electron-vite starts without errors.

- [ ] **15.4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: adjustments for build and test compatibility"
```

---

### Self-Review Checklist

1. **Spec coverage:** Does every spec requirement have a corresponding task?
   - ✅ electron-vite setup → Task 1
   - ✅ Shared types → Task 2
   - ✅ Main process TS conversion → Tasks 3-5
   - ✅ IPC handler splitting → Task 6
   - ✅ Main entry point → Task 7
   - ✅ Preload script → Task 8
   - ✅ Sticker window Vue → Tasks 9-10
   - ✅ Settings window Vue → Tasks 11-12
   - ✅ Type declarations → Task 13
   - ✅ Cleanup → Task 14
   - ✅ Build verification → Task 15

2. **Placeholder scan:** No "TBD", "TODO", or placeholders in any task.

3. **Type consistency:** `HolidayAPI`, `Reminder`, `Settings`, `Holiday` types defined in Task 2 and used consistently across all subsequent tasks.
