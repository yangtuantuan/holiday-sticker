<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings } from '../../../shared/types'

const api = (window as any).holidayAPI

const settings = ref<Settings | null>(null)
const customDays = ref('')
const statusMsg = ref('')

async function load(): Promise<void> {
  settings.value = await api.getSettings()
  if (settings.value) {
    customDays.value = (settings.value.customAdvanceReminderDays || []).join(', ')
  }
}

async function save(): Promise<void> {
  if (!settings.value) return
  await api.updateSettings({
    dailyReminderTime: settings.value.dailyReminderTime,
    advanceReminderPresets: settings.value.advanceReminderPresets,
    customAdvanceReminderDays: customDays.value
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => !isNaN(n) && n > 0)
  })
  statusMsg.value = '✓ 已保存'
  setTimeout(() => { statusMsg.value = '' }, 2000)
}

function togglePreset(days: number): void {
  if (!settings.value) return
  const idx = settings.value.advanceReminderPresets.indexOf(days)
  if (idx === -1) {
    settings.value.advanceReminderPresets.push(days)
  } else {
    settings.value.advanceReminderPresets.splice(idx, 1)
  }
}

onMounted(load)
</script>

<template>
  <div class="tab-content active" id="tab-reminders">
    <h2>提醒设置</h2>
    <div v-if="settings" class="form-group">
      <label>每日节日提醒时间</label>
      <input type="time" v-model="settings.dailyReminderTime">
    </div>
    <div class="form-group">
      <label>提前提醒天数</label>
      <div id="advance-presets">
        <label>
          <input type="checkbox" :checked="settings.advanceReminderPresets.includes(1)" @change="togglePreset(1)"> 1天
        </label>
        <label>
          <input type="checkbox" :checked="settings.advanceReminderPresets.includes(3)" @change="togglePreset(3)"> 3天
        </label>
        <label>
          <input type="checkbox" :checked="settings.advanceReminderPresets.includes(7)" @change="togglePreset(7)"> 7天
        </label>
      </div>
      <div class="form-group-inline">
        <label>自定义天数（逗号分隔，如 14, 30）</label>
        <input type="text" v-model="customDays" placeholder="例如: 14, 30">
      </div>
    </div>
    <button class="btn-primary" @click="save">保存</button>
    <div class="status-msg">{{ statusMsg }}</div>
  </div>
</template>
