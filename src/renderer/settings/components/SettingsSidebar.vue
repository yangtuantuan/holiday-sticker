<script setup lang="ts">
defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const tabs = [
  { key: 'general', label: '通用' },
  { key: 'reminders', label: '提醒' },
  { key: 'custom', label: '自定义提醒' }
]
</script>

<template>
  <div class="sidebar">
    <div
      v-for="tab in tabs"
      :key="tab.key"
      class="tab"
      :class="{ active: modelValue === tab.key }"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </div>
  </div>
</template>
