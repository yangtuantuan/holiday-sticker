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
