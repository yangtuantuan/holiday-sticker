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
