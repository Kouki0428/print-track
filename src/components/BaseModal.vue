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
    if (v) {
      window.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    } else {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="overlay" @click.self="close">
        <div class="modal" :style="{ width: width || '520px' }">
          <div class="modal-head">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="x" @click="close" aria-label="关闭">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
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
  color: var(--muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}
.x:hover { color: var(--text); background: var(--hover); }
.modal-body { padding: 18px; overflow-y: auto; }
.modal-foot {
  padding: 14px 18px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
