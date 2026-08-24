<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const store = useToastStore()

const icons: Record<string, string> = {
  success: '<path d="M20 6 9 17l-5-5"/>',
  error: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
}
function iconSvg(kind: string): string {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icons[kind] || icons.info}</svg>`
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-host">
      <TransitionGroup name="toast">
        <div
          v-for="t in store.items"
          :key="t.id"
          class="toast"
          :class="t.kind"
          @click="store.dismiss(t.id)"
        >
          <span class="t-icon" v-html="iconSvg(t.kind)"></span>
          <span class="t-text">{{ t.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  max-width: 380px;
  padding: 11px 14px;
  border-radius: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-lg);
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}
.t-icon { display: inline-flex; margin-top: 1px; flex-shrink: 0; }
.toast.success .t-icon { color: var(--green); }
.toast.error .t-icon { color: var(--red); }
.toast.info .t-icon { color: var(--accent); }

.toast-enter-active { transition: all 0.28s var(--ease-spring); }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(24px); }
.toast-leave-to { opacity: 0; transform: translateY(-8px) scale(0.96); }
</style>
