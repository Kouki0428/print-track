import { defineStore } from 'pinia'
import { ref } from 'vue'

// 全局项目类型过滤器：全部 / 3D 打印 / 3D 建模 / 其它（用户自定义类型统一归入「其它」）
// 侧边栏统一切换，各全局视图（仪表盘 / 作品库 / 进度板 / 时间线）据此过滤
const STORE_KEY = 'printtrack_type_filter'
const ALLOWED = ['all', 'print', 'model', 'other']

function load(): string {
  const v = localStorage.getItem(STORE_KEY)
  // 仅允许内置 4 个值；旧数据里残留的自定义类型名回退为全部
  return v && ALLOWED.includes(v) ? v : 'all'
}

export const useUiStore = defineStore('ui', () => {
  const typeFilter = ref<string>(load())

  function setTypeFilter(t: string) {
    const v = t.trim()
    typeFilter.value = ALLOWED.includes(v) ? v : 'all'
    localStorage.setItem(STORE_KEY, typeFilter.value)
  }

  return { typeFilter, setTypeFilter }
})
