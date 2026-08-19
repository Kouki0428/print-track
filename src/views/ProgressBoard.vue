<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorksStore } from '@/stores/works'
import {
  createPrintJob,
  listPrintJobs,
  listFilaments,
  STATUS_LABELS,
  type PrintJob,
  type WorkStatus,
  type Filament,
} from '@/db/api'

const works = useWorksStore()
const columns: WorkStatus[] = ['designing', 'slicing', 'printing', 'done', 'failed']

const selectedId = ref<number | null>(null)
const jobs = ref<PrintJob[]>([])
const filaments = ref<Filament[]>([])

const selected = computed(() => works.works.find((w) => w.id === selectedId.value) || null)

const jobForm = ref({ filament_id: '', result: 'success', filament_used: '', note: '', started_at: '', ended_at: '' })

onMounted(async () => {
  filaments.value = await listFilaments()
})

async function selectWork(id: number) {
  selectedId.value = id
  await reloadJobs()
}

async function reloadJobs() {
  if (selectedId.value == null) {
    jobs.value = []
    return
  }
  jobs.value = await listPrintJobs(selectedId.value)
}

async function addJob() {
  if (selectedId.value == null) return
  await createPrintJob({
    work_id: selectedId.value,
    filament_id: jobForm.value.filament_id ? Number(jobForm.value.filament_id) : null,
    result: jobForm.value.result,
    filament_used: jobForm.value.filament_used ? Number(jobForm.value.filament_used) : null,
    note: jobForm.value.note.trim() || null,
    started_at: jobForm.value.started_at || null,
    ended_at: jobForm.value.ended_at || null,
  })
  jobForm.value = { filament_id: '', result: 'success', filament_used: '', note: '', started_at: '', ended_at: '' }
  await reloadJobs()
}
</script>

<template>
  <h1 class="page-title">进度板</h1>
  <div class="board">
    <div v-for="col in columns" :key="col" class="col">
      <div class="col-head">{{ '· ' + columns.indexOf(col) + ' ' }}{{ STATUS_LABELS[col] }} <span class="count">{{ works.byStatus[col].length }}</span></div>
      <div
        v-for="w in works.byStatus[col]"
        :key="w.id"
        class="item"
        :class="{ active: selectedId === w.id }"
        @click="selectWork(w.id)"
      >
        {{ w.name }}
      </div>
      <div v-if="works.byStatus[col].length === 0" class="item empty">—</div>
    </div>
  </div>

  <div v-if="selected" class="detail">
    <h2 class="detail-title">
      打印记录：{{ selected.name }}
      <span class="muted">（{{ STATUS_LABELS[selected.status] }}）</span>
    </h2>

    <div class="job-form">
      <select v-model="jobForm.filament_id">
        <option value="">选择耗材</option>
        <option v-for="f in filaments" :key="f.id" :value="f.id">
          {{ f.brand || '耗材' }} {{ f.color || '' }} (余{{ f.remaining_g ?? 0 }}g)
        </option>
      </select>
      <select v-model="jobForm.result">
        <option value="success">成功</option>
        <option value="failed">失败</option>
      </select>
      <input v-model="jobForm.filament_used" placeholder="耗材用量(g)" inputmode="decimal" />
      <input v-model="jobForm.started_at" placeholder="开始时间" />
      <input v-model="jobForm.ended_at" placeholder="结束时间" />
      <input v-model="jobForm.note" placeholder="备注" />
      <button class="btn" @click="addJob">新增记录</button>
    </div>

    <table class="jobs">
      <thead>
        <tr><th>耗材</th><th>结果</th><th>用量(g)</th><th>开始</th><th>结束</th><th>备注</th></tr>
      </thead>
      <tbody>
        <tr v-for="j in jobs" :key="j.id">
          <td>{{ j.filament_id != null ? (filaments.find((f) => f.id === j.filament_id)?.brand || '#' + j.filament_id) : '-' }}</td>
          <td>{{ j.result === 'success' ? '成功' : '失败' }}</td>
          <td>{{ j.filament_used ?? '-' }}</td>
          <td>{{ j.started_at ?? '-' }}</td>
          <td>{{ j.ended_at ?? '-' }}</td>
          <td>{{ j.note ?? '-' }}</td>
        </tr>
        <tr v-if="jobs.length === 0"><td colspan="6" class="muted">暂无打印记录</td></tr>
      </tbody>
    </table>
  </div>
  <p v-else class="hint">点击上方作品查看 / 新增打印记录。</p>
</template>

<style scoped>
.board { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.col { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; min-height: 220px; }
.col-head { font-weight: 600; font-size: 14px; margin-bottom: 10px; display: flex; justify-content: space-between; }
.count { color: var(--muted); font-weight: 400; }
.item { background: #f6f7f9; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 13px; margin-bottom: 8px; cursor: pointer; }
.item.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.item.empty { color: var(--muted); text-align: center; cursor: default; }
.hint { color: var(--muted); font-size: 13px; margin-top: 16px; }
.detail { margin-top: 22px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
.detail-title { font-size: 16px; margin: 0 0 12px; }
.muted { color: var(--muted); font-weight: 400; font-size: 13px; }
.job-form { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.job-form input, .job-form select { padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; background: #fff; color: var(--text); }
.btn { margin-left: auto; padding: 7px 14px; border: none; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; }
.jobs { width: 100%; border-collapse: collapse; font-size: 13px; }
.jobs th, .jobs td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); }
.jobs th { color: var(--muted); font-weight: 600; }
</style>
