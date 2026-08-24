import { ref, computed, watch } from 'vue'

export type Theme = 'light' | 'dark'
export type ThemePref = Theme | 'system'

const STORAGE_KEY = 'printtrack-theme'

const mq =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function read(): ThemePref {
  let v: string | null = null
  try {
    v = localStorage.getItem(STORAGE_KEY)
  } catch {
    v = null
  }
  return v === 'dark' || v === 'light' ? v : 'system'
}

// 用户偏好（含 system）；theme 为最终解析出的实际主题
export const themePref = ref<ThemePref>(read())
export const theme = computed<Theme>(() => {
  if (themePref.value === 'system') return mq?.matches ? 'dark' : 'light'
  return themePref.value
})

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

// 初始化：根据当前值应用一次；系统主题变化时联动刷新
apply(theme.value)
watch(theme, (t) => apply(t))

// 同步一份给主进程（决定原生窗口背景色，避免启动闪白）
function persist() {
  ;(window as any).app?.saveTheme?.(theme.value)
}

export function toggleTheme() {
  themePref.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, themePref.value)
  persist()
}

export function setThemePref(p: ThemePref) {
  themePref.value = p
  localStorage.setItem(STORAGE_KEY, p)
  persist()
}

// 兼容旧调用：直接指定浅色/深色
export function setTheme(t: Theme) {
  setThemePref(t)
}
