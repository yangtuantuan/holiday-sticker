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

const gregYear = ref(new Date().getFullYear())
const gregMonth = ref(1)
const gregDay = ref(1)
const gregWeekDay = ref(1)

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

function parseExistingDate(): void {
  if (!props.reminder) return
  if (calendar.value === 'gregorian') {
    if (props.reminder.type === 'once' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 3) { gregYear.value = parts[0]; gregMonth.value = parts[1]; gregDay.value = parts[2] }
    } else if (props.reminder.type === 'yearly' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 2) { gregMonth.value = parts[0]; gregDay.value = parts[1] }
    } else if (props.reminder.type === 'monthly') { gregDay.value = Number(props.reminder.date) }
    else if (props.reminder.type === 'weekly') { gregWeekDay.value = Number(props.reminder.date) }
  } else {
    if (props.reminder.type === 'once' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 3) {
        lunarYear.value = parts[0]
        const rawMonth = parts[1]
        const isLeap = rawMonth > 100
        const actualMonth = isLeap ? rawMonth - 100 : rawMonth
        const idx = lunarMonthInfo.value.findIndex(m => m.month === actualMonth && m.isLeap === isLeap)
        if (idx >= 0) lunarSelectedIdx.value = idx
        lunarDay.value = parts[2]
      }
    } else if (props.reminder.type === 'yearly' && props.reminder.date.includes('-')) {
      const parts = props.reminder.date.split('-').map(Number)
      if (parts.length === 2) {
        const rawMonth = parts[0]
        const isLeap = rawMonth > 100
        const actualMonth = isLeap ? rawMonth - 100 : rawMonth
        const idx = lunarMonthInfo.value.findIndex(m => m.month === actualMonth && m.isLeap === isLeap)
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

watch(type, () => {
  if (!['once', 'yearly'].includes(type.value)) calendar.value = 'gregorian'
})

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
    if (type.value === 'once') {
      const month = m.isLeap ? m.month + 100 : m.month
      dateStr = `${lunarYear.value}-${month}-${lunarDay.value}`
    } else if (type.value === 'yearly') {
      const month = m.isLeap ? m.month + 100 : m.month
      dateStr = `${month}-${lunarDay.value}`
    }
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
        <button :class="{ active: calendar === 'gregorian' }" @click="calendar = 'gregorian'">公历</button>
        <button :class="{ active: calendar === 'lunar' }" @click="calendar = 'lunar'">农历</button>
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
          <option v-for="(m, i) in lunarMonthInfo" :key="m.month + '-' + m.isLeap" :value="i">{{ m.label }}</option>
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
