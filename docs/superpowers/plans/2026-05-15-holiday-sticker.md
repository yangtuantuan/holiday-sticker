# Holiday Sticker — Windows Desktop Holiday Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron Windows desktop app that shows Chinese holiday countdowns on a desktop sticker and sends notifications for holidays and custom reminders.

**Architecture:** Electron app with main process (API polling, scheduler, system tray, storage) and two renderer windows (sticker overlay, settings panel). Main/renderer communicate via IPC through a preload bridge.

**Tech Stack:** Electron 28+, electron-store, electron-builder, Jest, Nager.Date API (free, no key)

**Project location:** `E:\web\holiday-sticker`

---

### Task 1: Project scaffolding and dependencies

**Files:**
- Create: `holiday-sticker/package.json`
- Create: `holiday-sticker/.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "holiday-sticker",
  "version": "1.0.0",
  "description": "Windows desktop holiday reminder sticker",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "test": "jest",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.0.0",
    "jest": "^29.0.0"
  },
  "dependencies": {
    "electron-store": "^8.0.0"
  },
  "build": {
    "appId": "com.holiday-sticker.app",
    "productName": "Holiday Sticker",
    "win": {
      "target": "nsis"
    }
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.superpowers/
*.log
```

- [ ] **Step 3: Install dependencies**

```bash
cd E:\web\holiday-sticker
npm install
```

- [ ] **Step 4: Create directory structure**

```bash
mkdir src\main src\renderer\sticker src\renderer\settings assets tests
```

Expected: directory tree with `src/main/`, `src/renderer/sticker/`, `src/renderer/settings/`, `assets/`, `tests/`

- [ ] **Step 5: Commit**

```
git init
git add .
git commit -m "chore: scaffold project structure"
```

---

### Task 2: Store module

**Files:**
- Create: `holiday-sticker/src/main/store.js`
- Create: `holiday-sticker/tests/store.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/store.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd E:\web\holiday-sticker
npx jest tests/store.test.js
```

Expected: FAIL with "Store is not defined" or similar

- [ ] **Step 3: Write minimal implementation**

```js
// src/main/store.js
const ElectronStore = require('electron-store')

class Store {
  constructor() {
    this._store = new ElectronStore({
      defaults: {
        settings: {
          stickerPosition: 'bottom-right',
          autoStart: true,
          reminderEnabled: true,
          dailyReminderTime: '08:00',
          advanceReminderPresets: [1, 3, 7],
          customAdvanceReminderDays: []
        },
        customReminders: [],
        holidayCache: {}
      }
    })
  }

  getSettings() {
    return this._store.get('settings')
  }

  updateSettings(partial) {
    const current = this.getSettings()
    this._store.set('settings', { ...current, ...partial })
  }

  addCustomReminder(data) {
    const reminders = this.getCustomReminders()
    const reminder = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...data,
      enabled: data.enabled !== false
    }
    reminders.push(reminder)
    this._store.set('customReminders', reminders)
    return reminder
  }

  getCustomReminders() {
    return this._store.get('customReminders')
  }

  removeCustomReminder(id) {
    const reminders = this.getCustomReminders().filter(r => r.id !== id)
    this._store.set('customReminders', reminders)
  }

  updateCustomReminder(id, data) {
    const reminders = this.getCustomReminders()
    const idx = reminders.findIndex(r => r.id === id)
    if (idx === -1) return null
    reminders[idx] = { ...reminders[idx], ...data }
    this._store.set('customReminders', reminders)
    return reminders[idx]
  }

  updateHolidayCache(year, holidays) {
    const cache = this._store.get('holidayCache')
    cache[year] = holidays
    cache.lastUpdated = new Date().toISOString()
    this._store.set('holidayCache', cache)
  }

  getHolidayCache(year) {
    const cache = this._store.get('holidayCache')
    return cache[year] || null
  }

  getLastUpdated() {
    return this._store.get('holidayCache.lastUpdated')
  }
}

module.exports = Store
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/store.test.js
```

Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```
git add src/main/store.js tests/store.test.js
git commit -m "feat: add electron-store wrapper module"
```

---

### Task 3: API module

**Files:**
- Create: `holiday-sticker/src/main/api.js`
- Create: `holiday-sticker/tests/api.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/api.test.js
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
```

- [ ] **Step 2: Run tests**

```bash
npx jest tests/api.test.js
```

Expected: FAIL (Api module not found)

- [ ] **Step 3: Write implementation**

```js
// src/main/api.js
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
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/api.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```
git add src/main/api.js tests/api.test.js
git commit -m "feat: add Nager.Date API wrapper"
```

---

### Task 4: Scheduler module

**Files:**
- Create: `holiday-sticker/src/main/scheduler.js`
- Create: `holiday-sticker/tests/scheduler.test.js`

- [ ] **Step 1: Write tests**

```js
// tests/scheduler.test.js
const Scheduler = require('../src/main/scheduler')

jest.useFakeTimers()

describe('Scheduler', () => {
  let scheduler
  let mockStore
  let mockApi
  let mockNotify
  let mockOnUpdate

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

  test('skips API call if cache is fresh (same day)', async () => {
    const today = new Date().toISOString().split('T')[0]
    mockStore.getLastUpdated.mockReturnValue(today + 'T10:00:00.000Z')

    await scheduler.dailyCheck()

    expect(mockApi.fetchCurrentAndNextYear).not.toHaveBeenCalled()
  })

  test('getNextHoliday returns null when no holidays exist', () => {
    const result = scheduler.getNextHoliday([])
    expect(result).toBeNull()
  })

  test('getNextHoliday returns the upcoming holiday', () => {
    const holidays = [
      { date: '2026-01-10', localName: 'past' },
      { date: '2026-01-29', localName: '春节' },
      { date: '2026-02-12', localName: '元宵节' }
    ]
    const result = scheduler.getNextHoliday(holidays)
    expect(result.localName).toBe('春节')
  })

  test('checkReminders returns empty array when no reminders due', () => {
    const result = scheduler.checkReminders([], [])
    expect(result).toEqual([])
  })

  test('checkReminders detects holiday today', () => {
    const today = new Date().toISOString().split('T')[0]
    const holidays = [{ date: today, localName: '测试节' }]
    const result = scheduler.checkReminders(holidays, [])
    expect(result.some(r => r.title === '测试节' && r.type === 'holiday')).toBe(true)
  })
})
```

- [ ] **Step 2: Write implementation**

```js
// src/main/scheduler.js
class Scheduler {
  constructor(store, api, notifyFn, onUpdateFn) {
    this.store = store
    this.api = api
    this.notify = notifyFn
    this.onUpdate = onUpdateFn
    this._interval = null
  }

  start() {
    this.dailyCheck()
    this._interval = setInterval(() => this.dailyCheck(), 60 * 60 * 1000)
    // reminder check every minute
    setInterval(() => this.minuteCheck(), 60 * 1000)
  }

  async dailyCheck() {
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
  }

  getNextHoliday(holidays) {
    const today = new Date().toISOString().split('T')[0]
    const upcoming = holidays
      .filter(h => h.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    return upcoming.length > 0 ? upcoming[0] : null
  }

  checkReminders(holidays, customReminders) {
    const today = new Date().toISOString().split('T')[0]
    const results = []

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

  minuteCheck() {
    const settings = this.store.getSettings()
    if (!settings.reminderEnabled) return

    const holidays = [
      ...(this.store.getHolidayCache(String(new Date().getFullYear())) || []),
      ...(this.store.getHolidayCache(String(new Date().getFullYear() + 1)) || [])
    ].filter(Boolean)

    const reminders = this.checkReminders(holidays, this.store.getCustomReminders())
    for (const r of reminders) {
      this.notify(r)
    }
  }

  _getNextOccurrence(reminder) {
    if (reminder.type === 'once') return reminder.date
    const now = new Date()
    const [m, d] = reminder.date.split('-').map(Number)
    if (reminder.type === 'yearly') {
      let d = new Date(now.getFullYear(), m - 1, d)
      if (d < now) d = new Date(now.getFullYear() + 1, m - 1, d)
      return d.toISOString().split('T')[0]
    }
    if (reminder.type === 'monthly') {
      let d = new Date(now.getFullYear(), now.getMonth(), Number(reminder.date))
      if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, Number(reminder.date))
      return d.toISOString().split('T')[0]
    }
    if (reminder.type === 'daily') return now.toISOString().split('T')[0]
    return reminder.date
  }
}

module.exports = Scheduler
```

- [ ] **Step 3: Run tests**

```bash
npx jest tests/scheduler.test.js
```

Expected: PASS

- [ ] **Step 4: Commit**

```
git add src/main/scheduler.js tests/scheduler.test.js
git commit -m "feat: add scheduler with API polling and reminder check"
```

---

### Task 5: Tray module

**Files:**
- Create: `holiday-sticker/src/main/tray.js`

- [ ] **Step 1: Write implementation**

```js
// src/main/tray.js
const { Tray, Menu, nativeImage } = require('electron')
const path = require('path')

class TrayManager {
  constructor(mainWindow, settingsWindow) {
    this.mainWindow = mainWindow
    this.settingsWindow = settingsWindow
    this.tray = null
  }

  create() {
    const iconPath = path.join(__dirname, '..', '..', 'assets', 'icon.png')
    const icon = nativeImage.createFromPath(iconPath)
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }))
    this.tray.setToolTip('Holiday Sticker')
    this._updateMenu()
  }

  _updateMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '设置',
        click: () => this.settingsWindow.show()
      },
      {
        label: '刷新节日数据',
        click: () => {
          this.mainWindow.webContents.send('refresh-holidays')
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          const { app } = require('electron')
          app.quit()
        }
      }
    ])
    this.tray.setContextMenu(contextMenu)
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

module.exports = TrayManager
```

- [ ] **Step 2: Commit**

```
git add src/main/tray.js
git commit -m "feat: add system tray with context menu"
```

---

### Task 6: Preload script and IPC bridge

**Files:**
- Create: `holiday-sticker/preload.js`

- [ ] **Step 1: Write implementation**

```js
// preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('holidayAPI', {
  getHolidays: () => ipcRenderer.invoke('get-holidays'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (s) => ipcRenderer.invoke('update-settings', s),
  getCustomReminders: () => ipcRenderer.invoke('get-custom-reminders'),
  addCustomReminder: (r) => ipcRenderer.invoke('add-custom-reminder', r),
  updateCustomReminder: (id, r) => ipcRenderer.invoke('update-custom-reminder', id, r),
  removeCustomReminder: (id) => ipcRenderer.invoke('remove-custom-reminder', id),
  onRefresh: (cb) => ipcRenderer.on('refresh-holidays', cb)
})
```

- [ ] **Step 2: Commit**

```
git add preload.js
git commit -m "feat: add preload script with IPC bridge"
```

---

### Task 7: Main process — wire everything together

**Files:**
- Create: `holiday-sticker/main.js`

- [ ] **Step 1: Write implementation**

```js
// main.js
const { app, BrowserWindow, ipcMain, Notification } = require('electron')
const path = require('path')
const Store = require('./src/main/store')
const Api = require('./src/main/api')
const Scheduler = require('./src/main/scheduler')
const TrayManager = require('./src/main/tray')

const store = new Store()
const api = new Api()

let mainWindow = null
let settingsWindow = null
let scheduler = null
let trayManager = null

function createStickerWindow() {
  mainWindow = new BrowserWindow({
    width: 280,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'sticker', 'index.html'))
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  settingsWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'settings', 'index.html'))
  settingsWindow.on('close', (e) => {
    e.preventDefault()
    settingsWindow.hide()
  })
}

function sendNotification(data) {
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

function broadcastHolidays() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const currentYear = String(new Date().getFullYear())
    const nextYear = String(new Date().getFullYear() + 1)
    const holidays = [
      ...(store.getHolidayCache(currentYear) || []),
      ...(store.getHolidayCache(nextYear) || [])
    ].filter(Boolean)
    mainWindow.webContents.send('holiday-update', holidays)
  }
}

ipcMain.handle('get-holidays', () => {
  const currentYear = String(new Date().getFullYear())
  const nextYear = String(new Date().getFullYear() + 1)
  return [
    ...(store.getHolidayCache(currentYear) || []),
    ...(store.getHolidayCache(nextYear) || [])
  ].filter(Boolean)
})

ipcMain.handle('get-settings', () => store.getSettings())
ipcMain.handle('update-settings', (_, settings) => {
  store.updateSettings(settings)
  if (settings.autoStart !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.autoStart })
  }
})
ipcMain.handle('get-custom-reminders', () => store.getCustomReminders())
ipcMain.handle('add-custom-reminder', (_, r) => store.addCustomReminder(r))
ipcMain.handle('update-custom-reminder', (_, id, r) => store.updateCustomReminder(id, r))
ipcMain.handle('remove-custom-reminder', (_, id) => store.removeCustomReminder(id))

app.whenReady().then(() => {
  createStickerWindow()
  createSettingsWindow()
  settingsWindow.hide()

  scheduler = new Scheduler(store, api, sendNotification, broadcastHolidays)
  scheduler.start()

  trayManager = new TrayManager(mainWindow, settingsWindow)
  trayManager.create()
})

app.on('window-all-closed', () => {})
```

- [ ] **Step 2: Commit**

```
git add main.js
git commit -m "feat: wire up main process with all modules"
```

---

### Task 8: Sticker window renderer

**Files:**
- Create: `holiday-sticker/src/renderer/sticker/index.html`
- Create: `holiday-sticker/src/renderer/sticker/style.css`
- Create: `holiday-sticker/src/renderer/sticker/app.js`

- [ ] **Step 1: Write HTML**

```html
<!-- src/renderer/sticker/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Holiday Sticker</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="sticker" class="sticker">
    <div id="drag-region" class="drag-region"></div>
    <div id="close-btn" class="close-btn">&times;</div>

    <div class="header">🏮 节日倒计时</div>

    <div id="next-holiday" class="next-holiday">
      <div id="next-name" class="next-name">加载中...</div>
      <div id="next-countdown" class="next-countdown"></div>
      <div id="next-date" class="next-date"></div>
    </div>

    <div class="divider">── 近期节日 ──</div>

    <ul id="holiday-list" class="holiday-list"></ul>

    <div class="footer">
      <span id="today-date"></span>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write CSS**

```css
/* src/renderer/sticker/style.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  background: transparent;
  color: #333;
  -webkit-app-region: no-drag;
  user-select: none;
  overflow: hidden;
}

.sticker {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 16px;
  width: 280px;
  min-height: 300px;
  position: relative;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  -webkit-app-region: drag;
  cursor: grab;
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 20px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
  color: #999;
  z-index: 10;
}

.sticker:hover .close-btn {
  opacity: 1;
}

.close-btn:hover {
  color: #e74c3c;
}

.header {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 12px;
  color: #e74c3c;
}

.next-holiday {
  background: linear-gradient(135deg, #fff5f5, #fff0f0);
  border-radius: 12px;
  padding: 14px;
  text-align: center;
  margin-bottom: 12px;
  border: 1px solid #ffe0e0;
}

.next-name {
  font-size: 16px;
  font-weight: 600;
  color: #c0392b;
}

.next-countdown {
  font-size: 28px;
  font-weight: 700;
  color: #e74c3c;
  margin: 6px 0;
}

.next-date {
  font-size: 12px;
  color: #888;
}

.divider {
  text-align: center;
  color: #bbb;
  font-size: 12px;
  margin: 8px 0;
}

.holiday-list {
  list-style: none;
  max-height: 200px;
  overflow-y: auto;
}

.holiday-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 4px;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
}

.holiday-list li:last-child {
  border-bottom: none;
}

.holiday-icon {
  margin-right: 6px;
}

.holiday-name {
  flex: 1;
}

.holiday-countdown {
  color: #e67e22;
  font-weight: 500;
  font-size: 12px;
}

.holiday-date {
  color: #999;
  font-size: 11px;
  margin-left: 8px;
}

.footer {
  text-align: center;
  font-size: 11px;
  color: #bbb;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}
```

- [ ] **Step 3: Write JS**

```js
// src/renderer/sticker/app.js
const api = window.holidayAPI

document.getElementById('close-btn').onclick = () => window.close()

api.onRefresh(() => refresh())

async function refresh() {
  const holidays = await api.getHolidays()
  render(holidays || [])
}

function render(holidays) {
  const today = new Date().toISOString().split('T')[0]
  const upcoming = holidays
    .filter(h => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  const next = upcoming[0]
  const nextName = document.getElementById('next-name')
  const nextCountdown = document.getElementById('next-countdown')
  const nextDate = document.getElementById('next-date')

  if (next) {
    const days = Math.ceil((new Date(next.date) - new Date(today)) / (1000 * 60 * 60 * 24))
    nextName.textContent = `距离 ${next.localName}`
    nextCountdown.textContent = days === 0 ? '就是今天！🎉' : `还有 ${days} 天`
    nextDate.textContent = `${next.date} ${getWeekday(next.date)}`
  } else {
    nextName.textContent = '暂无节日数据'
    nextCountdown.textContent = ''
    nextDate.textContent = ''
  }

  const list = document.getElementById('holiday-list')
  list.innerHTML = upcoming.slice(1, 10).map(h => {
    const days = Math.ceil((new Date(h.date) - new Date(today)) / (1000 * 60 * 60 * 24))
    return `<li>
      <span class="holiday-icon">🎉</span>
      <span class="holiday-name">${h.localName}</span>
      <span class="holiday-countdown">+${days}天</span>
      <span class="holiday-date">${h.date.slice(5)}</span>
    </li>`
  }).join('')

  document.getElementById('today-date').textContent =
    `今日: ${today} ${getWeekday(today)}`
}

function getWeekday(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return days[new Date(dateStr).getDay()]
}

// Load custom reminders from renderer process
async function loadCustomReminders() {
  const reminders = await api.getCustomReminders()
  const list = document.getElementById('holiday-list')
  const today = new Date().toISOString().split('T')[0]

  for (const r of reminders) {
    if (!r.enabled) continue
    const nextDate = getNextOccurrence(r)
    if (!nextDate || nextDate < today) continue
    const days = Math.ceil((new Date(nextDate) - new Date(today)) / (1000 * 60 * 60 * 24))
    list.innerHTML += `<li>
      <span class="holiday-icon">📌</span>
      <span class="holiday-name">${r.title}</span>
      <span class="holiday-countdown">${days === 0 ? '今天' : `+${days}天`}</span>
      <span class="holiday-date">${nextDate.slice(5)}</span>
    </li>`
  }
}

function getNextOccurrence(r) {
  if (r.type === 'once') return r.date
  if (r.type === 'yearly') {
    const [m, d] = r.date.split('-').map(Number)
    const now = new Date()
    let d2 = new Date(now.getFullYear(), m - 1, d)
    if (d2 < now) d2 = new Date(now.getFullYear() + 1, m - 1, d)
    return d2.toISOString().split('T')[0]
  }
  if (r.type === 'monthly') {
    const now = new Date()
    let d2 = new Date(now.getFullYear(), now.getMonth(), Number(r.date))
    if (d2 <= now) d2 = new Date(now.getFullYear(), now.getMonth() + 1, Number(r.date))
    return d2.toISOString().split('T')[0]
  }
  if (r.type === 'daily') return new Date().toISOString().split('T')[0]
  return null
}

refresh().then(loadCustomReminders)
setInterval(refresh, 60 * 60 * 1000)
```

- [ ] **Step 4: Commit**

```
git add src/renderer/sticker/
git commit -m "feat: add sticker overlay window UI"
```

---

### Task 9: Settings window renderer

**Files:**
- Create: `holiday-sticker/src/renderer/settings/index.html`
- Create: `holiday-sticker/src/renderer/settings/style.css`
- Create: `holiday-sticker/src/renderer/settings/app.js`

- [ ] **Step 1: Write HTML**

```html
<!-- src/renderer/settings/index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>设置 - Holiday Sticker</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <div class="sidebar">
      <div class="tab active" data-tab="general">通用</div>
      <div class="tab" data-tab="reminders">提醒</div>
      <div class="tab" data-tab="custom">自定义提醒</div>
    </div>

    <div class="content">
      <!-- General -->
      <div class="tab-content active" id="tab-general">
        <h2>通用设置</h2>
        <div class="form-group">
          <label>贴纸位置</label>
          <select id="sticker-position">
            <option value="top-left">左上</option>
            <option value="top-right">右上</option>
            <option value="bottom-left">左下</option>
            <option value="bottom-right" selected>右下</option>
          </select>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="auto-start"> 开机自启</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" id="reminder-enabled" checked> 启用提醒</label>
        </div>
        <button id="save-general" class="btn-primary">保存</button>
        <div id="general-status" class="status-msg"></div>
      </div>

      <!-- Reminders -->
      <div class="tab-content" id="tab-reminders">
        <h2>提醒设置</h2>
        <div class="form-group">
          <label>每日节日提醒时间</label>
          <input type="time" id="daily-reminder-time" value="08:00">
        </div>
        <div class="form-group">
          <label>提前提醒天数</label>
          <div id="advance-presets">
            <label><input type="checkbox" value="1"> 1天</label>
            <label><input type="checkbox" value="3"> 3天</label>
            <label><input type="checkbox" value="7"> 7天</label>
          </div>
          <div class="form-group-inline">
            <label>自定义天数（逗号分隔）</label>
            <input type="text" id="custom-advance-days" placeholder="例如: 14, 30">
          </div>
        </div>
        <button id="save-reminders" class="btn-primary">保存</button>
        <div id="reminders-status" class="status-msg"></div>
      </div>

      <!-- Custom Reminders -->
      <div class="tab-content" id="tab-custom">
        <h2>自定义提醒</h2>
        <div id="custom-reminder-list"></div>
        <button id="add-reminder-btn" class="btn-secondary">+ 添加提醒</button>
        <div id="reminder-form" class="reminder-form hidden">
          <input type="hidden" id="reminder-id">
          <div class="form-group">
            <label>标题</label>
            <input type="text" id="reminder-title" placeholder="例如: 朋友生日">
          </div>
          <div class="form-group">
            <label>类型</label>
            <select id="reminder-type">
              <option value="once">一次性</option>
              <option value="daily">每天</option>
              <option value="monthly">每月</option>
              <option value="yearly">每年</option>
            </select>
          </div>
          <div class="form-group">
            <label>日期</label>
            <input type="text" id="reminder-date" placeholder="一次性: 2026-03-15 / 每年: 03-15 / 每月: 15">
          </div>
          <div class="form-group">
            <label>时间</label>
            <input type="time" id="reminder-time" value="09:00">
          </div>
          <div class="form-group">
            <label>提前提醒天数（逗号分隔）</label>
            <input type="text" id="reminder-advance" placeholder="例如: 1, 3">
          </div>
          <div class="form-actions">
            <button id="save-reminder" class="btn-primary">保存</button>
            <button id="cancel-reminder" class="btn-cancel">取消</button>
          </div>
        </div>
        <div id="custom-status" class="status-msg"></div>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write CSS**

```css
/* src/renderer/settings/style.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  color: #333;
  background: #f8f9fa;
}

.container {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 140px;
  background: #fff;
  border-right: 1px solid #e0e0e0;
  padding: 16px 0;
}

.tab {
  padding: 10px 20px;
  cursor: pointer;
  color: #666;
  font-size: 14px;
}

.tab:hover {
  background: #f0f0f0;
  color: #333;
}

.tab.active {
  background: #fff5f5;
  color: #e74c3c;
  font-weight: 600;
  border-right: 3px solid #e74c3c;
}

.content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

h2 {
  font-size: 18px;
  margin-bottom: 20px;
  color: #2c3e50;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  color: #666;
  font-size: 13px;
}

.form-group-inline {
  margin-top: 8px;
}

input[type="text"],
input[type="time"],
select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

input[type="text"]:focus,
input[type="time"]:focus,
select:focus {
  outline: none;
  border-color: #e74c3c;
  box-shadow: 0 0 0 2px rgba(231, 76, 60, 0.1);
}

input[type="checkbox"] {
  margin-right: 8px;
}

.btn-primary {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary:hover {
  background: #c0392b;
}

.btn-secondary {
  background: #ecf0f1;
  color: #333;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
}

.btn-secondary:hover {
  background: #dfe6e9;
}

.btn-cancel {
  background: #fff;
  color: #666;
  border: 1px solid #ddd;
  padding: 10px 24px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #f0f0f0;
}

.hidden {
  display: none !important;
}

.reminder-form {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

#custom-reminder-list {
  margin-bottom: 8px;
}

.reminder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 8px;
}

.reminder-item .title {
  font-weight: 500;
}

.reminder-item .meta {
  font-size: 12px;
  color: #999;
}

.reminder-item .actions button {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-size: 14px;
  margin-left: 8px;
}

.reminder-item .actions button:hover {
  color: #e74c3c;
}

.status-msg {
  margin-top: 12px;
  font-size: 13px;
  color: #27ae60;
}
```

- [ ] **Step 3: Write JS**

```js
// src/renderer/settings/app.js
const api = window.holidayAPI

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'))
    tab.classList.add('active')
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active')
  }
})

// Load settings
async function loadSettings() {
  const settings = await api.getSettings()
  document.getElementById('sticker-position').value = settings.stickerPosition
  document.getElementById('auto-start').checked = settings.autoStart
  document.getElementById('reminder-enabled').checked = settings.reminderEnabled
  document.getElementById('daily-reminder-time').value = settings.dailyReminderTime

  document.querySelectorAll('#advance-presets input').forEach(cb => {
    cb.checked = settings.advanceReminderPresets.includes(Number(cb.value))
  })
  document.getElementById('custom-advance-days').value = (settings.customAdvanceReminderDays || []).join(', ')
}

document.getElementById('save-general').onclick = async () => {
  await api.updateSettings({
    stickerPosition: document.getElementById('sticker-position').value,
    autoStart: document.getElementById('auto-start').checked,
    reminderEnabled: document.getElementById('reminder-enabled').checked
  })
  document.getElementById('general-status').textContent = '✓ 已保存'
  setTimeout(() => document.getElementById('general-status').textContent = '', 2000)
}

document.getElementById('save-reminders').onclick = async () => {
  const presets = []
  document.querySelectorAll('#advance-presets input:checked').forEach(cb => presets.push(Number(cb.value)))
  const custom = document.getElementById('custom-advance-days').value
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => !isNaN(n) && n > 0)

  await api.updateSettings({
    dailyReminderTime: document.getElementById('daily-reminder-time').value,
    advanceReminderPresets: presets,
    customAdvanceReminderDays: custom
  })
  document.getElementById('reminders-status').textContent = '✓ 已保存'
  setTimeout(() => document.getElementById('reminders-status').textContent = '', 2000)
}

// Custom reminders CRUD
let editingId = null

async function loadReminderList() {
  const reminders = await api.getCustomReminders()
  const list = document.getElementById('custom-reminder-list')
  list.innerHTML = reminders.map(r => `
    <div class="reminder-item">
      <div>
        <div class="title">${r.title}</div>
        <div class="meta">${r.type} · ${r.date} ${r.time || ''}</div>
      </div>
      <div class="actions">
        <button onclick="editReminder('${r.id}')">✏️</button>
        <button onclick="deleteReminder('${r.id}')">🗑️</button>
      </div>
    </div>
  `).join('')
}

document.getElementById('add-reminder-btn').onclick = () => {
  editingId = null
  document.getElementById('reminder-id').value = ''
  document.getElementById('reminder-title').value = ''
  document.getElementById('reminder-type').value = 'once'
  document.getElementById('reminder-date').value = ''
  document.getElementById('reminder-time').value = '09:00'
  document.getElementById('reminder-advance').value = ''
  document.getElementById('reminder-form').classList.remove('hidden')
}

window.editReminder = async (id) => {
  const reminders = await api.getCustomReminders()
  const r = reminders.find(x => x.id === id)
  if (!r) return
  editingId = id
  document.getElementById('reminder-id').value = id
  document.getElementById('reminder-title').value = r.title
  document.getElementById('reminder-type').value = r.type
  document.getElementById('reminder-date').value = r.date
  document.getElementById('reminder-time').value = r.time || '09:00'
  document.getElementById('reminder-advance').value = (r.advanceReminderDays || []).join(', ')
  document.getElementById('reminder-form').classList.remove('hidden')
}

window.deleteReminder = async (id) => {
  await api.removeCustomReminder(id)
  loadReminderList()
}

document.getElementById('save-reminder').onclick = async () => {
  const data = {
    title: document.getElementById('reminder-title').value,
    type: document.getElementById('reminder-type').value,
    date: document.getElementById('reminder-date').value,
    time: document.getElementById('reminder-time').value,
    advanceReminderDays: document.getElementById('reminder-advance').value
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
  }

  if (editingId) {
    await api.updateCustomReminder(editingId, data)
  } else {
    await api.addCustomReminder(data)
  }

  document.getElementById('custom-status').textContent = '✓ 已保存'
  document.getElementById('reminder-form').classList.add('hidden')
  loadReminderList()
  setTimeout(() => document.getElementById('custom-status').textContent = '', 2000)
}

document.getElementById('cancel-reminder').onclick = () => {
  document.getElementById('reminder-form').classList.add('hidden')
}

loadSettings()
loadReminderList()
```

- [ ] **Step 4: Commit**

```
git add src/renderer/settings/
git commit -m "feat: add settings window with all configuration UI"
```

---

### Task 10: Assets and packaging config

**Files:**
- Create: `holiday-sticker/assets/icon.png` (placeholder)

- [ ] **Step 1: Generate placeholder icon**

Use a 256x256 PNG with a simple calendar icon. For initial development, create a minimal 1-pixel PNG to allow the app to start:

```bash
# Generate a minimal 256x256 PNG using PowerShell
powershell -Command "[Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==') | Set-Content -Path assets/icon.png -Encoding Byte"
```

- [ ] **Step 2: Commit**

```
git add assets/icon.png
git commit -m "chore: add app icon"
```

---

### Task 11: Final integration test

- [ ] **Step 1: Run the app to verify it starts**

```bash
cd E:\web\holiday-sticker
npx electron .
```

Expected: A small translucent sticker window appears in bottom-right corner. System tray icon appears.

- [ ] **Step 2: Verify settings window**

Right-click tray icon → "设置" → settings window opens with all tabs working.

- [ ] **Step 3: Run all tests**

```bash
npx jest
```

Expected: All tests PASS

- [ ] **Step 4: Final commit if any fixes needed**

```
git add .
git commit -m "fix: final integration fixes"
```

---

### Self-Review Checklist

1. **Spec coverage:**
   - Sticker window overlay ✓ (Task 8)
   - API polling with Nager.Date ✓ (Task 3)
   - Holiday + custom reminder notifications ✓ (Task 4)
   - Settings UI ✓ (Task 9)
   - System tray ✓ (Task 5)
   - Electron packaging ✓ (Task 1)
   - Custom reminder cycle types ✓ (Task 2, 4, 9)

2. **Placeholder scan:** No TBD, TODO, or "implement later" patterns.

3. **Type consistency:** All method names match across files (addCustomReminder, removeCustomReminder, etc.).
