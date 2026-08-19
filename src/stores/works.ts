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

  async function patch(id: number, p: Partial<Work>) {
    await updateWork(id, p)
    await fetchAll()
  }

  async function remove(id: number) {
    await deleteWork(id)
    await fetchAll()
  }

  const byStatus = computed(() => {
    const map: Record<WorkStatus, Work[]> = {
      designing: [],
      slicing: [],
      printing: [],
      done: [],
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
