<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    message?: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
  }>(),
  { title: '确认操作', message: '', confirmText: '确定', cancelText: '取消', danger: false },
)
const emit = defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()

function onKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') emit('confirm')
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
    <Transition name="modal">
      <div v-if="open" class="overlay" @click.self="emit('cancel')">
        <div class="dialog" role="alertdialog">
          <div class="dlg-icon" :class="{ danger }">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.7 18.3-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-2.7Z" />
              <path d="M12 9v4M12 17h.01" />
            </svg>
          </div>
          <h3 class="dlg-title">{{ title }}</h3>
          <p v-if="message" class="dlg-msg">{{ message }}</p>
          <div class="dlg-actions">
            <button class="btn ghost" @click="emit('cancel')">{{ cancelText }}</button>
            <button class="btn" :class="{ danger }" @click="emit('confirm')">{{ confirmText }}</button>
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
  z-index: 1100;
}
.dialog {
  width: 380px;
  max-width: calc(100vw - 40px);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 22px 20px 18px;
  text-align: center;
}
.dlg-icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: var(--accent-weak);
}
.dlg-icon.danger { color: var(--red); background: var(--red-bg); }
.dlg-title { margin: 0 0 6px; font-size: 16px; font-weight: 700; }
.dlg-msg { margin: 0; font-size: 13px; color: var(--text-2); line-height: 1.6; word-break: break-all; }
.dlg-actions { display: flex; gap: 10px; justify-content: center; margin-top: 18px; }
</style>
