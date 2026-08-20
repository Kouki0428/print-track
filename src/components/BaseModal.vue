<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = defineProps<{
  open: boolean
  title: string
  width?: string
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

function close() {
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.open,
  (v) => {
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="overlay" @click.self="close">
        <div class="modal" :style="{ width: width || '520px' }">
          <div class="modal-head">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="x" @click="close" aria-label="关闭">×</button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-foot">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(16, 24, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}
.modal {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--line);
}
.modal-title { margin: 0; font-size: 16px; font-weight: 700; }
.x {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  color: var(--muted);
  cursor: pointer;
  padding: 0 4px;
}
.x:hover { color: var(--text); }
.modal-body { padding: 18px; overflow-y: auto; }
.modal-foot {
  padding: 14px 18px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
