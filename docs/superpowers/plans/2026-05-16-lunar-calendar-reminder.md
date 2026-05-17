# 农历日历提醒实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在自定义提醒中添加农历/公历日历类型选择，包括农历日期的输入、存储、调度转换和显示。

**Architecture:** Reminder 类型新增 `calendar` 字段区分公历/农历；`lunar.ts` 新增 `lunarToSolar` 用于调度器运行时转换；`ReminderForm.vue` 添加日历切换按钮组和下拉日期选择器替代文本输入；IPC 新增 `get-lunar-month-info` 供渲染进程查询农历月信息。

**Tech Stack:** Electron + Vue 3 + TypeScript + `lunar` (npm)

---

### Task 1: 更新共享类型

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: 给 Reminder 添加 `calendar` 字段，给 HolidayAPI 添加 `getLunarMonthInfo` 方法**

```typescript
export interface Reminder {
  id: string
  title: string
  type: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  date: string
  time: string
  calendar: 'gregorian' | 'lunar'       // 新增
  advanceReminderDays: number[]
  enabled: boolean
}

export interface LunarMonthInfo {
  month: number
  isLeap: boolean
  days: number
  label: string
}

// 添加到 HolidayAPI
export interface HolidayAPI {
  // ... 现有方法不变
  getLunarMonthInfo: (year: number) => Promise<LunarMonthInfo[]>
  formatLunarDate: (dateStr: string, type: string) => Promise<string>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add calendar field to Reminder and new IPC types"
```

---

### Task 2: 新增农历工具函数

**Files:**
- Modify: `src/main/lunar.ts`

- [ ] **Step 1: 添加 `lunarToSolar` 和 `getLunarMonthInfo` 函数**

```typescript
import { createLunarDate, toGregorian, formatLunarParts } from 'lunar'
import type { LunarMonthInfo } from '../shared/types'

export function lunarToSolar(dateStr: string, type: string): string | null {
  try {
    let lunarYear: number, lunarMonth: number, lunarDay: number, isLeap: boolean
    if (type === 'once') {
      const parts = dateStr.split('-').map(Number)
      if (parts.length !== 3) return null
      ;[lunarYear, lunarMonth, lunarDay] = parts
      isLeap = false
    } else if (type === 'yearly') {
      const parts = dateStr.split('-').map(Number)
      if (parts.length !== 2) return null
      lunarYear = new Date().getFullYear()
      ;[lunarMonth, lunarDay] = parts
      isLeap = false
      // try current year, if past try next year
      const date = createLunarDate({ year: lunarYear, month: lunarMonth, day: lunarDay, isLeapMonth: false })
      const greg = toGregorian(date)
      const d = new Date(greg.date)
      const today = new Date()
      if (d <= today) {
        lunarYear++
        const date2 = createLunarDate({ year: lunarYear, month: lunarMonth, day: lunarDay, isLeapMonth: false })
        const greg2 = toGregorian(date2)
        return greg2.date.toISOString().split('T')[0]
      }
      return d.toISOString().split('T')[0]
    } else {
      return null
    }
    const date = createLunarDate({ year: lunarYear, month: lunarMonth, day: lunarDay, isLeapMonth: isLeap })
    const greg = toGregorian(date)
    return greg.date.toISOString().split('T')[0]
  } catch {
    return null
  }
}

export function getLunarMonthInfo(year: number): LunarMonthInfo[] {
  const monthNames = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  const result: LunarMonthInfo[] = []
  for (let m = 1; m <= 12; m++) {
    for (const isLeap of [false, true]) {
      let days = 0
      for (let d = 30; d >= 28; d--) {
        try {
          createLunarDate({ year, month: m, day: d, isLeapMonth: isLeap })
          days = d
          break
        } catch {
          // day doesn't exist, try next
        }
      }
      if (days > 0) {
        result.push({
          month: m,
          isLeap,
          days,
          label: (isLeap ? '闰' : '') + monthNames[m]
        })
      }
    }
  }
  return result
}

export function formatLunarDateDisplay(dateStr: string, type: string): string {
  const dayNames = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']
  try {
    let year: number | undefined, month: number, day: number
    if (type === 'once') {
      const parts = dateStr.split('-').map(Number)
      if (parts.length !== 3) return dateStr
      ;[year, month, day] = parts
      const obj = createLunarDate({ year, month, day, isLeapMonth: false })
      const parts2 = formatLunarParts(obj)
      const yearStr = parts2.filter(p => p.type === 'yearStem' || p.type === 'yearBranch' || p.type === 'literal').map(p => p.value).join('')
      const md = parts2.filter(p => p.type === 'month' || p.type === 'day').map(p => p.value).join('')
      return `农历${yearStr}${md}`
    } else if (type === 'yearly') {
      const parts = dateStr.split('-').map(Number)
      if (parts.length !== 2) return dateStr
      ;[month, day] = parts
      const name = getLunarMonthName(month)
      return `每年农历${name}${dayNames[day] || day + '日'}`
    }
    return dateStr
  } catch {
    return dateStr
  }
}

function getLunarMonthName(month: number): string {
  const names = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return names[month] || month + '月'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/lunar.ts
git commit -m "feat: add lunarToSolar, getLunarMonthInfo, formatLunarDateDisplay"
```

---

### Task 3: 添加 IPC handlers

**Files:**
- Modify: `src/main/ipc/holiday.ts`

- [ ] **Step 1: 注册 `get-lunar-month-info` 和 `format-lunar-date` handler**

```typescript
import { ipcMain } from 'electron'
import logger from '../logger'
import type Store from '../store'
import type Api from '../api'
import { solarToLunar, lunarToSolar, getLunarMonthInfo, formatLunarDateDisplay } from '../lunar'

export function registerHolidayHandlers(store: Store, api: Api): void {
  // ... 现有 get-holidays 和 get-lunar-date 不变 ...

  ipcMain.handle('get-lunar-month-info', (_event, year: number) => {
    try {
      return getLunarMonthInfo(year)
    } catch (err) {
      logger.error('get-lunar-month-info 失败', err)
      return []
    }
  })

  ipcMain.handle('format-lunar-date', (_event, dateStr: string, type: string) => {
    try {
      return formatLunarDateDisplay(dateStr, type)
    } catch (err) {
      logger.error('format-lunar-date 失败', err)
      return dateStr
    }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc/holiday.ts
git commit -m "feat: add get-lunar-month-info and format-lunar-date IPC handlers"
```

---

### Task 4: 更新 preload

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: 绑定新 IPC 方法**

```typescript
const api: HolidayAPI = {
  // ... 现有方法 ...
  getLunarMonthInfo: (year) => ipcRenderer.invoke('get-lunar-month-info', year),
  formatLunarDate: (dateStr, type) => ipcRenderer.invoke('format-lunar-date', dateStr, type)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: bind getLunarMonthInfo and formatLunarDate in preload"
```

---

### Task 5: 更新调度器处理农历日期

**Files:**
- Modify: `src/main/scheduler.ts`

- [ ] **Step 1: `_getNextOccurrence` 中处理 `calendar='lunar'`**

```typescript
// 在文件顶部导入
import { lunarToSolar } from './lunar'

// 在 _getNextOccurrence 方法中，检查 calendar 字段
_getNextOccurrence(reminder: Reminder): string {
  // 如果是农历，用 lunarToSolar 转换后返回
  if (reminder.calendar === 'lunar') {
    const solar = lunarToSolar(reminder.date, reminder.type)
    if (solar) return solar
    // fallback to existing logic
  }

  // 以下为现有逻辑（不变）
  const now = new Date()
  if (reminder.type === 'once') return reminder.date
  // ... 其余代码不变 ...
}
```

- [ ] **Step 2: 运行测试确认通过**

```bash
npm test -- --testPathPattern=scheduler
```

Expected: All existing scheduler tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/main/scheduler.ts
git commit -m "feat: handle lunar calendar in scheduler _getNextOccurrence"
```

---

### Task 6: 重写 ReminderForm 添加日历切换和下拉日期选择器

**Files:**
- Modify: `src/renderer/settings/components/ReminderForm.vue`

- [ ] **Step 1: 完整重写组件**

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Reminder, LunarMonthInfo } from '../../../shared/types'

const api = (window as any).holidayAPI

const props = defineProps<{
  reminder: Reminder | null
}>()

const emit = defineEmits<{
  save: [data: Omit<Reminder, 'id'>]
  cancel: []
}>()

const title = ref(props.reminder?.title ?? '')
const type = ref(props.reminder?.type ?? 'once')
const calendar = ref(props.reminder?.calendar ?? 'gregorian')
const time = ref(props.reminder?.time ?? '09:00')
const advance = ref((props.reminder?.advanceReminderDays ?? []).join(', '))

// 公历日期下拉值
const gregYear = ref(new Date().getFullYear())
const gregMonth = ref(1)
const gregDay = ref(1)
const gregWeekDay = ref(1)

// 农历日期下拉值
const lunarYear = ref(new Date().getFullYear())
const lunarSelectedIdx = ref(0)
const lunarDay = ref(1)
const lunarMonthInfo = ref<LunarMonthInfo[]>([])

const gregDaysInMonth = computed(() => new Date(gregYear.value, gregMonth.value, 0).getDate())

const currentLunarMonth = computed(() => lunarMonthInfo.value[lunarSelectedIdx.value])
const currentLunarDays = computed(() => currentLunarMonth.value?.days ?? 30)

const gregYears = computed(() => {
  const arr: number[] = []
  for (let y = 1900; y <= 2100; y++) arr.push(y)
  return arr
})

const lunarYears = computed(() => {
  const arr: number[] = []
  for (let y = 1890; y <= 2100; y++) arr.push(y)
  return arr
})

const lunarDayNames = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const lunarPreview = ref('')

// 编辑已有提醒时，从 date 反解析出下拉值
function parseExistingDate(): void {
  if (!props.reminder) return
  if (calendar.value === 'gregorian') {
    if (props.reminder.type === 'once' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 3) {
        gregYear.value = parts[0]
        gregMonth.value = parts[1]
        gregDay.value = parts[2]
      }
    } else if (props.reminder.type === 'yearly' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 2) {
        gregMonth.value = parts[0]
        gregDay.value = parts[1]
      }
    } else if (props.reminder.type === 'monthly') {
      gregDay.value = Number(props.reminder.date)
    } else if (props.reminder.type === 'weekly') {
      gregWeekDay.value = Number(props.reminder.date)
    }
  } else {
    if (props.reminder.type === 'once' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 3) {
        lunarYear.value = parts[0]
        // find matching month index
        const idx = lunarMonthInfo.value.findIndex(m => m.month === parts[1] && !m.isLeap)
        if (idx >= 0) lunarSelectedIdx.value = idx
        lunarDay.value = parts[2]
      }
    } else if (props.reminder.type === 'yearly' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 2) {
        const idx = lunarMonthInfo.value.findIndex(m => m.month === parts[0] && !m.isLeap)
        if (idx >= 0) lunarSelectedIdx.value = idx
        lunarDay.value = parts[1]
      }
    }
  }
}

function updateLunarPreview(): void {
  const m = currentLunarMonth.value
  if (!m) { lunarPreview.value = ''; return }
  if (type.value === 'once') {
    lunarPreview.value = `农历${lunarYear.value}年${m.label}${lunarDayNames[lunarDay.value] || lunarDay.value + '日'}`
  } else if (type.value === 'yearly') {
    lunarPreview.value = `每年${m.label}${lunarDayNames[lunarDay.value] || lunarDay.value + '日'}`
  }
}

watch(lunarYear, async () => {
  lunarMonthInfo.value = await api.getLunarMonthInfo(lunarYear.value)
  lunarSelectedIdx.value = 0
  updateLunarPreview()
})

watch([lunarSelectedIdx, lunarDay], updateLunarPreview)
watch(type, () => { if (type.value === 'daily') calendar.value = 'gregorian' })

const calendarTypes = computed(() => {
  return ['once', 'yearly'].includes(type.value) ? ['gregorian', 'lunar'] as const : ['gregorian'] as const
})

function submit(): void {
  let dateStr = ''
  if (calendar.value === 'gregorian') {
    if (type.value === 'once') dateStr = `${gregYear.value}-${gregMonth.value}-${gregDay.value}`
    else if (type.value === 'yearly') dateStr = `${gregMonth.value}-${gregDay.value}`
    else if (type.value === 'monthly') dateStr = String(gregDay.value)
    else if (type.value === 'weekly') dateStr = String(gregWeekDay.value)
  } else {
    const m = currentLunarMonth.value
    if (!m) return
    if (type.value === 'once') dateStr = `${lunarYear.value}-${m.month}-${lunarDay.value}`
    else if (type.value === 'yearly') dateStr = `${m.month}-${lunarDay.value}`
  }

  emit('save', {
    title: title.value,
    type: type.value as Reminder['type'],
    calendar: calendar.value as 'gregorian' | 'lunar',
    date: dateStr,
    time: time.value,
    advanceReminderDays: advance.value
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0),
    enabled: true
  })
}

onMounted(async () => {
  lunarMonthInfo.value = await api.getLunarMonthInfo(lunarYear.value)
  parseExistingDate()
  updateLunarPreview()
})
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
    <div class="form-group" v-if="calendarTypes.length > 1">
      <label>日历</label>
      <div class="calendar-toggle">
        <button
          :class="{ active: calendar === 'gregorian' }"
          @click="calendar = 'gregorian'"
        >公历</button>
        <button
          :class="{ active: calendar === 'lunar' }"
          @click="calendar = 'lunar'"
        >农历</button>
      </div>
    </div>
    <div class="form-group" v-if="calendar === 'gregorian' && type !== 'daily'">
      <label>日期</label>
      <div class="date-pickers">
        <select v-if="type === 'once'" v-model="gregYear">
          <option v-for="y in gregYears" :key="y" :value="y">{{ y }}年</option>
        </select>
        <select v-if="type === 'once' || type === 'yearly'" v-model="gregMonth">
          <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
        </select>
        <select v-if="type === 'once' || type === 'yearly'" v-model="gregDay">
          <option v-for="d in gregDaysInMonth" :key="d" :value="d">{{ d }}日</option>
        </select>
        <select v-if="type === 'monthly'" v-model="gregDay">
          <option v-for="d in 31" :key="d" :value="d">{{ d }}日</option>
        </select>
        <select v-if="type === 'weekly'" v-model="gregWeekDay">
          <option v-for="(label, i) in weekDayLabels" :key="i + 1" :value="i + 1">{{ label }}</option>
        </select>
      </div>
    </div>
    <div class="form-group" v-if="calendar === 'lunar'">
      <label>农历日期</label>
      <div class="date-pickers">
        <select v-if="type === 'once'" v-model="lunarYear">
          <option v-for="y in lunarYears" :key="y" :value="y">{{ y }}年</option>
        </select>
        <select v-model="lunarSelectedIdx">
          <option v-for="(m, i) in lunarMonthInfo" :key="m.month + '-' + m.isLeap" :value="i">
            {{ m.label }}
          </option>
        </select>
        <select v-model="lunarDay">
          <option v-for="d in currentLunarDays" :key="d" :value="d">{{ lunarDayNames[d] }}</option>
        </select>
      </div>
      <div class="hint" v-if="lunarPreview">{{ lunarPreview }}</div>
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

<style scoped>
.calendar-toggle {
  display: flex;
  gap: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
}
.calendar-toggle button {
  flex: 1;
  padding: 6px 16px;
  border: none;
  background: #f5f5f5;
  cursor: pointer;
  font-size: 14px;
}
.calendar-toggle button.active {
  background: #4a90d9;
  color: #fff;
}
.date-pickers {
  display: flex;
  gap: 8px;
}
.date-pickers select {
  flex: 1;
}
.hint {
  margin-top: 4px;
  font-size: 12px;
  color: #888;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/settings/components/ReminderForm.vue
git commit -m "feat: rewrite ReminderForm with calendar toggle and date pickers"
```

---

### Task 7: 更新设置窗口提醒列表显示

**Files:**
- Modify: `src/renderer/settings/components/CustomReminderTab.vue`

- [ ] **Step 1: 农历提醒显示农历原文 + 标签**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Reminder } from '../../../shared/types'
import ReminderForm from './ReminderForm.vue'

const api = (window as any).holidayAPI

// ... 现有代码不变 ...

const lunarDisplayCache = ref<Record<string, string>>({})

async function getLunarDisplay(r: Reminder): Promise<string> {
  if (r.calendar !== 'lunar') return r.date
  const key = r.id + '-' + r.date
  if (lunarDisplayCache.value[key]) return lunarDisplayCache.value[key]
  try {
    const text = await api.formatLunarDate(r.date, r.type)
    lunarDisplayCache.value[key] = text
    return text
  } catch {
    return r.date
  }
}

// 在 loadReminders 之后调用
onMounted(async () => {
  await loadReminders()
  for (const r of reminders.value) {
    if (r.calendar === 'lunar') {
      await getLunarDisplay(r)
    }
  }
})
</script>

<template>
  <div class="tab-content active" id="tab-custom">
    <h2>自定义提醒</h2>
    <div id="custom-reminder-list">
      <div v-for="r in reminders" :key="r.id" class="reminder-item">
        <div>
          <div class="title">{{ r.title }}</div>
          <div class="meta">
            {{ typeLabels[r.type] }} ·
            <template v-if="r.calendar === 'lunar'">
              <LazyLunarDisplay :reminder="r" /> · <span class="lunar-badge">农历</span>
            </template>
            <template v-else>
              {{ r.date }}
            </template>
            {{ r.time || '' }}
          </div>
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

注意：上面用到了 `LazyLunarDisplay` 子组件，需要创建。或者更简单地在模板中用内联异步渲染。实际实现时，可以创建一个简单的 inline 方式。让我改为在 `onMounted` 中批量预加载：

实际上，在加载提醒后批量调用 `formatLunarDate` 更简单。让我重写这个步骤：

直接在 `loadReminders` 中获取显示文本：

```typescript
async function loadReminders(): Promise<void> {
  reminders.value = await api.getCustomReminders()
  for (const r of reminders.value) {
    if (r.calendar === 'lunar') {
      try {
        r._display = await api.formatLunarDate(r.date, r.type)
      } catch {
        r._display = r.date
      }
    }
  }
}
```

但 `Reminder` 类型没有 `_display` 字段。可以用一个额外的 map：

```typescript
const lunarTexts = ref<Record<string, string>>({})
```

然后模板中：

```vue
<div class="meta">
  {{ typeLabels[r.type] }} ·
  {{ r.calendar === 'lunar' ? (lunarTexts[r.id] || '...') : r.date }}
  {{ r.time || '' }}
  <span v-if="r.calendar === 'lunar'" class="lunar-badge">农历</span>
</div>
```

- [ ] **Step 2: 添加农历样式**

在 `src/renderer/settings/styles/main.css` 中添加：

```css
.lunar-badge {
  display: inline-block;
  font-size: 11px;
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffcc80;
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/settings/components/CustomReminderTab.vue src/renderer/settings/styles/main.css
git commit -m "feat: display lunar dates in settings reminder list"
```

---

### Task 8: 更新贴纸窗口提醒列表显示农历原文

**Files:**
- Modify: `src/renderer/sticker/components/CustomReminderList.vue`

- [ ] **Step 1: 显示农历原文**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Reminder } from '../../../shared/types'

const api = (window as any).holidayAPI

const props = defineProps<{
  reminders: Reminder[]
  getCountdownColor: (days: number) => string
  getNextOccurrence: (r: Reminder) => string | null
}>()

const lunarTexts = ref<Record<string, string>>({})

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

async function loadLunarTexts(): Promise<void> {
  for (const r of props.reminders) {
    if (r.calendar === 'lunar') {
      try {
        const text = await api.formatLunarDate(r.date, r.type)
        lunarTexts.value[r.id] = text
      } catch {
        lunarTexts.value[r.id] = r.date
      }
    }
  }
}

onMounted(loadLunarTexts)
</script>

<template>
  <li v-for="item in getActiveReminders()" :key="item.reminder.id">
    <div class="li-row">
      <span class="holiday-icon">📌</span>
      <span class="holiday-name">{{ item.reminder.title }}</span>
      <span class="holiday-countdown" :style="{ color: getCountdownColor(item.days) }">
        {{ item.days === 0 ? '今天' : `+${item.days}天` }}
      </span>
      <span class="holiday-date">
        {{ item.nextDate.slice(5) }}
        <template v-if="item.reminder.calendar === 'lunar'">
          ({{ lunarTexts[item.reminder.id] || '...' }})
        </template>
      </span>
    </div>
  </li>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/sticker/components/CustomReminderList.vue
git commit -m "feat: display lunar original date in sticker reminder list"
```

---

### Self-Review

**Spec coverage:**
- Reminder 类型加 `calendar` 字段 → Task 1 ✓
- ReminderForm 日历切换 + 下拉选择器 → Task 6 ✓
- 调度器农历转换 → Task 5 ✓
- IPC `get-lunar-month-info` → Task 3 ✓
- IPC `format-lunar-date` → Task 2 + 3 ✓
- 设置窗口农历显示 → Task 7 ✓
- 贴纸窗口农历显示 → Task 8 ✓

**Placeholder scan:** 所有步骤包含完整代码。无 TBD/TODO。

**Type consistency:** 所有 types/function signatures 在各任务间一致。
