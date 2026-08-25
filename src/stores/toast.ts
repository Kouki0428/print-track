import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'
export interface ToastAction {
  label: string
  run: () => void
}
export interface ToastItem {
  id: number
  kind: ToastKind
  text: string
  action?: ToastAction
}

let seq = 0

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])

  function push(kind: ToastKind, text: string, duration = 3200, action?: ToastAction) {
    const id = ++seq
    items.value.push({ id, kind, text, action })
    if (items.value.length > 5) items.value.shift()
    window.setTimeout(() => dismiss(id), duration)
    return id
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return { items, push, dismiss }
})

// 组件内快捷用法：const toast = useToast(); toast.success('已保存')
// 带 action 的成功提示（如「撤销」）自动延长展示时间
export function useToast() {
  const store = useToastStore()
  return {
    success: (text: string, action?: ToastAction) => store.push('success', text, action ? 6000 : 3200, action),
    error: (text: string) => store.push('error', text, 4500),
    info: (text: string) => store.push('info', text),
  }
}
