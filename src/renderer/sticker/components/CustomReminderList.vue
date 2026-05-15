<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Reminder } from '../../../shared/types'

const props = defineProps<{
  reminders: Reminder[]
  getCountdownColor: (days: number) => string
  getNextOccurrence: (r: Reminder) => string | null
}>()

const api = (window as any).holidayAPI
const lunarTexts = ref<Record<string, string>>({})

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
