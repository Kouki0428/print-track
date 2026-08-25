<script setup lang="ts">
import { computed } from 'vue'
import { STATUS_LABELS, type WorkStatus } from '@/db/api'

const props = defineProps<{ status: WorkStatus }>()

// 状态 -> 语义色（与 style.css 的令牌对应）
const colorMap: Record<WorkStatus, string> = {
  planning: 'purple',
  designing: 'blue',
  making: 'orange',
  done: 'green',
  overdue: 'red',
  failed: 'gray',
}

const label = computed(() => STATUS_LABELS[props.status])
const cls = computed(() => `badge--${colorMap[props.status]}`)
</script>

<template>
  <span class="badge" :class="cls">
    <span class="dot"></span>{{ label }}
  </span>
</template>

<style scoped>
.badge { color: var(--c); background: var(--c-bg); }
.badge--blue { --c: var(--blue); --c-bg: var(--blue-bg); }
.badge--purple { --c: var(--purple); --c-bg: var(--purple-bg); }
.badge--orange { --c: var(--orange); --c-bg: var(--orange-bg); }
.badge--green { --c: var(--green); --c-bg: var(--green-bg); }
.badge--red { --c: var(--red); --c-bg: var(--red-bg); }
.badge--gray { --c: var(--gray); --c-bg: var(--gray-bg); }

/* 「制作中」= 活跃状态：圆点呼吸；「逾期」= 紧迫：急促脉冲 */
.badge--orange .dot { animation: dotBreath 1.8s ease-in-out infinite; }
.badge--red .dot { animation: dotUrgent 1.1s ease-in-out infinite; }
@keyframes dotBreath {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
@keyframes dotUrgent {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.3; transform: scale(1.25); }
}
</style>
