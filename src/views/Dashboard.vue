<script setup lang="ts">
import { computed } from 'vue'
import { useWorksStore } from '@/stores/works'

const works = useWorksStore()

const cards = computed(() => [
  { label: '作品总数', value: works.totalCount },
  { label: '在制 / 完成', value: `${works.byStatus.printing.length} / ${works.byStatus.done.length}` },
  { label: '标记售卖', value: works.saleCount },
  { label: '预估收益', value: `¥${works.estimatedRevenue.toFixed(0)}` },
])
</script>

<template>
  <h1 class="page-title">仪表盘</h1>
  <div class="grid">
    <div v-for="c in cards" :key="c.label" class="stat">
      <div class="stat-value">{{ c.value }}</div>
      <div class="stat-label">{{ c.label }}</div>
    </div>
  </div>
  <p class="hint">数据来自本地 SQLite（用户数据目录下的 print-track.db）。后续将补充：耗材消耗、待排期、视频播放聚合。</p>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 18px; }
.stat-value { font-size: 26px; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 13px; color: var(--muted); margin-top: 6px; }
.hint { color: var(--muted); font-size: 13px; margin-top: 20px; }
</style>
