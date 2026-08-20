<script setup lang="ts">
defineProps<{
  emoji?: string
  title: string
  desc?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div class="emoji">{{ emoji || '📭' }}</div>
    <div class="title">{{ title }}</div>
    <div v-if="desc" class="desc">{{ desc }}</div>
    <slot />
  </div>
</template>
