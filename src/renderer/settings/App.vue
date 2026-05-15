<script setup lang="ts">
import { ref } from 'vue'
import SettingsSidebar from './components/SettingsSidebar.vue'
import GeneralTab from './components/GeneralTab.vue'
import ReminderTab from './components/ReminderTab.vue'
import CustomReminderTab from './components/CustomReminderTab.vue'

const activeTab = ref('general')
</script>

<template>
  <div class="container">
    <SettingsSidebar v-model="activeTab" />
    <div class="content">
      <GeneralTab v-if="activeTab === 'general'" />
      <ReminderTab v-if="activeTab === 'reminders'" />
      <CustomReminderTab v-if="activeTab === 'custom'" />
    </div>
  </div>
</template>
