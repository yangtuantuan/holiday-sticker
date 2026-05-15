<script setup lang="ts">
function getToday(): string {
  const today = new Date().toISOString().split('T')[0]
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `今日: ${today} ${days[new Date().getDay()]}`
}
</script>

<template>
  <div class="footer">
    <span id="today-date">{{ getToday() }}</span>
  </div>
</template>
