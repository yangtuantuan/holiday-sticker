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
