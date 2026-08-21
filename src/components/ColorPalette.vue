<script setup lang="ts">
// 调色盘：常见 3D 打印线材色 + 原生取色，选中即 emit(hex)
// 用于「+」弹层，内嵌于 3D 打印项目关联耗材颜色
const props = defineProps<{ current?: string[] }>()
const emit = defineEmits<{ (e: 'pick', hex: string): void }>()

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

function pick(hex: string) {
  emit('pick', hex)
}
function onNative(e: Event) {
  emit('pick', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="palette">
    <div class="swatch-row">
      <span class="current">
        <input class="native" type="color" value="#cccccc" @input="onNative" title="自定义颜色" />
      </span>
      <span class="hint">点击色块或取色器添加</span>
    </div>
    <div class="presets">
      <button
        v-for="c in presets"
        :key="c"
        class="preset"
        :class="{ on: current?.some((x) => x.toLowerCase() === c.toLowerCase()) }"
        :style="{ background: c }"
        @click="pick(c)"
        :title="c"
      ></button>
    </div>
  </div>
</template>

<style scoped>
.palette { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; }
.swatch-row { display: flex; align-items: center; gap: 10px; }
.current {
  width: 36px; height: 36px; border-radius: 9px; position: relative;
  border: 1px solid var(--line-strong); box-shadow: var(--shadow-sm); overflow: hidden;
  background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
}
.native { position: absolute; inset: 0; opacity: 0; cursor: pointer; border: none; padding: 0; }
.hint { font-size: 12px; color: var(--muted); }
.presets { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.preset {
  aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--line); cursor: pointer;
  padding: 0; transition: var(--transition); position: relative;
}
.preset:hover { transform: scale(1.12); }
.preset.on { box-shadow: 0 0 0 2px var(--panel-2), 0 0 0 4px var(--accent); }
</style>
