import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  listWorks,
  createWork,
  updateWork,
  deleteWork,
  type Work,
  type WorkStatus,
} from '@/db/api'

export const useWorksStore = defineStore('works', () => {
  const works = ref<Work[]>([])
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try {
      works.value = await listWorks()
    } finally {
      loading.value = false
    }
  }

  async function add(input: Partial<Work>) {
    await createWork(input)
    await fetchAll()
  }

  // 局部更新：写库后只改内存里对应的一条，避免全量重查导致整列表重渲（拖拽/快捷改状态更跟手）
  async function patch(id: number, p: Partial<Work>) {
    await updateWork(id, p)
    const idx = works.value.findIndex((w) => w.id === id)
    if (idx >= 0) works.value[idx] = { ...works.value[idx], ...p }
  }

  async function remove(id: number) {
    await deleteWork(id)
    works.value = works.value.filter((w) => w.id !== id)
  }

  const byStatus = computed(() => {
    const map: Record<WorkStatus, Work[]> = {
      planning: [],
      designing: [],
      making: [],
      done: [],
      overdue: [],
      failed: [],
    }
    for (const w of works.value) map[w.status].push(w)
    return map
  })

  const totalCount = computed(() => works.value.length)
  const saleCount = computed(() => works.value.filter((w) => w.for_sale).length)
  const estimatedRevenue = computed(() =>
    works.value.reduce((sum, w) => sum + (w.for_sale ? w.sale_price ?? 0 : 0), 0),
  )

  return { works, loading, byStatus, totalCount, saleCount, estimatedRevenue, fetchAll, add, patch, remove }
})
