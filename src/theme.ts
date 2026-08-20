import { ref } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'printtrack-theme'

function read(): Theme {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'dark' ? 'dark' : 'light'
}

export const theme = ref<Theme>(read())

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

// 初始化：根据当前值应用一次
apply(theme.value)

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, theme.value)
  apply(theme.value)
}

export function setTheme(t: Theme) {
  theme.value = t
  localStorage.setItem(STORAGE_KEY, t)
  apply(t)
}
