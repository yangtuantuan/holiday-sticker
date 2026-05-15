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

watch(() => props.holidays, async () => {
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
