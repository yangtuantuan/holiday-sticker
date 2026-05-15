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
