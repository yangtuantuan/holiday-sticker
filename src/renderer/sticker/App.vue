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
