<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Reminder } from '../../../shared/types'
import ReminderForm from './ReminderForm.vue'

const api = (window as any).holidayAPI

const reminders = ref<Reminder[]>([])
const editingId = ref<string | null>(null)
const showForm = ref(false)
const editingReminder = ref<Reminder | null>(null)
const lunarTexts = ref<Record<string, string>>({})

async function loadReminders(): Promise<void> {
  reminders.value = await api.getCustomReminders()
  const texts: Record<string, string> = {}
  for (const r of reminders.value) {
    if (r.calendar === 'lunar') {
      try {
        texts[r.id] = await api.formatLunarDate(r.date, r.type)
      } catch {
        texts[r.id] = r.date
      }
    }
  }
  lunarTexts.value = texts
}

function startAdd(): void {
  editingId.value = null
  editingReminder.value = null
  showForm.value = true
}

async function startEdit(id: string): Promise<void> {
  editingId.value = id
  const r = (await api.getCustomReminders()).find((x: Reminder) => x.id === id)
  if (r) {
    editingReminder.value = { ...r }
    showForm.value = true
  }
}

async function deleteReminder(id: string): Promise<void> {
  await api.removeCustomReminder(id)
  await loadReminders()
}

async function onSave(data: Omit<Reminder, 'id'>): Promise<void> {
  if (editingId.value) {
    await api.updateCustomReminder(editingId.value, data)
  } else {
    await api.addCustomReminder(data)
  }
  showForm.value = false
  editingReminder.value = null
  await loadReminders()
}

function onCancel(): void {
  showForm.value = false
  editingReminder.value = null
}

const typeLabels: Record<string, string> = {
  once: '一次性',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年'
}

onMounted(loadReminders)
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
            <template v-if="r.calendar === 'lunar'">{{ lunarTexts[r.id] || r.date }} <span class="lunar-badge">农历</span></template>
            <template v-else>{{ r.date }}</template>
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
