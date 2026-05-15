<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Settings } from '../../../shared/types'

const api = (window as any).holidayAPI

const settings = ref<Settings | null>(null)
const opacityLabel = ref('100%')
const statusMsg = ref('')
const updateMsg = ref('')

async function load(): Promise<void> {
  settings.value = await api.getSettings()
  if (settings.value) {
    opacityLabel.value = Math.round((settings.value.opacity ?? 1.0) * 100) + '%'
  }
}

async function save(): Promise<void> {
  if (!settings.value) return
  await api.updateSettings({
    stickerPosition: settings.value.stickerPosition,
    autoStart: settings.value.autoStart,
    reminderEnabled: settings.value.reminderEnabled
  })
  statusMsg.value = '✓ 已保存'
  setTimeout(() => { statusMsg.value = '' }, 2000)
}

async function onOpacityChange(e: Event): Promise<void> {
  const v = parseFloat((e.target as HTMLInputElement).value)
  opacityLabel.value = Math.round(v * 100) + '%'
  if (settings.value) settings.value.opacity = v
  await api.setOpacity(v)
}

async function checkUpdate(): Promise<void> {
  const result = await api.checkUpdate()
  updateMsg.value = result.message
  setTimeout(() => { updateMsg.value = '' }, 3000)
}

onMounted(load)
</script>

<template>
  <div class="tab-content active" id="tab-general">
    <h2>通用设置</h2>
    <div v-if="settings" class="form-group">
      <label>贴纸位置</label>
      <select v-model="settings.stickerPosition">
        <option value="top-left">左上</option>
        <option value="top-right">右上</option>
        <option value="bottom-left">左下</option>
        <option value="bottom-right">右下</option>
      </select>
    </div>
    <div class="form-group">
      <label><input type="checkbox" v-model="settings!.autoStart"> 开机自启</label>
    </div>
    <div class="form-group">
      <label><input type="checkbox" v-model="settings!.reminderEnabled"> 启用提醒</label>
    </div>
    <div class="form-group">
      <label>贴纸透明度</label>
      <div class="opacity-row">
        <input
          type="range" min="0.3" max="1.0" step="0.05"
          :value="settings?.opacity ?? 1.0"
          @input="onOpacityChange"
        >
        <span class="opacity-label">{{ opacityLabel }}</span>
      </div>
    </div>
    <div class="form-group">
      <label>检查更新</label>
      <button class="btn-secondary" @click="checkUpdate">检查更新</button>
      <span class="status-msg">{{ updateMsg }}</span>
    </div>
    <button class="btn-primary" @click="save">保存</button>
    <div class="status-msg">{{ statusMsg }}</div>
  </div>
</template>
