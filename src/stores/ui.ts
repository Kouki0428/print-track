import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { WorkType } from '@/db/api'

// 全局项目类型过滤器：全部 / 3D打印 / 3D建模 / 单机游戏
// 侧边栏统一切换，各全局视图（仪表盘 / 作品库 / 进度板 / 时间线）据此过滤
const STORE_KEY = 'printtrack_type_filter'

function load(): WorkType | 'all' {
  const v = localStorage.getItem(STORE_KEY)
  if (v === 'all' || v === 'print' || v === 'model' || v === 'game') return v
  return 'all'
}

export const useUiStore = defineStore('ui', () => {
  const typeFilter = ref<WorkType | 'all'>(load())

  function setTypeFilter(t: WorkType | 'all') {
    typeFilter.value = t
    localStorage.setItem(STORE_KEY, t)
  }

  return { typeFilter, setTypeFilter }
})
