<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

// 预设色板（常见 3D 打印线材色）
const presets = [
  '#e23c3c', // 红
  '#f06464', // 粉红
  '#e8912f', // 橙
  '#f0c33c', // 黄
  '#1f9d57', // 绿
  '#3b6fe0', // 蓝
  '#5b8cff', // 天蓝
  '#8b5cf6', // 紫
  '#2b2b2b', // 黑
  '#f4f4f4', // 白
  '#c9a06a', // 木色
  '#9aa0a6', // 灰
]

const current = computed(() => props.modelValue || '#cccccc')

function pick(hex: string) {
  emit('update:modelValue', hex)
}
function onNative(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
function clear() {
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="color-picker">
    <div class="swatch-row">
      <span class="current" :style="{ background: current }">
        <input class="native" type="color" :value="current" @input="onNative" title="自定义颜色" />
      </span>
      <button class="clear" :class="{ on: !modelValue }" @click="clear" title="清除关联">无</button>
    </div>
    <div class="presets">
      <button
        v-for="c in presets"
        :key="c"
        class="preset"
        :class="{ on: modelValue && modelValue.toLowerCase() === c.toLowerCase() }"
        :style="{ background: c }"
        @click="pick(c)"
        :title="c"
      ></button>
    </div>
  </div>
</template>

<style scoped>
.color-picker { display: flex; flex-direction: column; gap: 10px; }
.swatch-row { display: flex; align-items: center; gap: 10px; }
.current {
  width: 40px; height: 40px; border-radius: 10px; position: relative;
  border: 1px solid var(--line-strong); box-shadow: var(--shadow-sm); overflow: hidden;
}
.native { position: absolute; inset: 0; opacity: 0; cursor: pointer; border: none; padding: 0; }
.clear {
  border: 1px solid var(--line-strong); background: var(--panel); color: var(--text-2);
  border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; transition: var(--transition);
}
.clear:hover { background: var(--hover); }
.clear.on { background: var(--gray-bg); color: var(--text); border-color: var(--accent); }
.presets { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; }
.preset {
  aspect-ratio: 1; border-radius: 7px; border: 1px solid var(--line); cursor: pointer;
  padding: 0; transition: var(--transition); position: relative;
}
.preset:hover { transform: scale(1.12); }
.preset.on { box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--accent); }
</style>
