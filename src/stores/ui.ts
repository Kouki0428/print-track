import { defineStore } from 'pinia'
import { ref } from 'vue'

// 全局项目类型过滤器：全部 / 任意具体类型（含内置 print/model/other 与用户自定义类型名）
// 侧边栏统一切换，各全局视图（仪表盘 / 作品库 / 进度板 / 时间线）据此过滤
const STORE_KEY = 'printtrack_type_filter'

function load(): string {
  const v = localStorage.getItem(STORE_KEY)
  // 'all' 或任意非空自定义类型串都合法
  return v && v.trim() ? v : 'all'
}

export const useUiStore = defineStore('ui', () => {
  const typeFilter = ref<string>(load())

  function setTypeFilter(t: string) {
    const v = t.trim()
    typeFilter.value = v || 'all'
    localStorage.setItem(STORE_KEY, typeFilter.value)
  }

  return { typeFilter, setTypeFilter }
})
