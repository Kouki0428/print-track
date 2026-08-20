<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorksStore } from '@/stores/works'
import {
  createPrintJob,
  listPrintJobs,
  listFilaments,
  type PrintJob,
  type WorkStatus,
  type Filament,
} from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'

const works = useWorksStore()
const columns: WorkStatus[] = ['planning', 'designing', 'making', 'done', 'overdue', 'failed']

// 列头色条（与状态语义色对应）
const colColor: Record<WorkStatus, string> = {
  planning: 'var(--purple)',
  designing: 'var(--blue)',
  making: 'var(--orange)',
  done: 'var(--green)',
  overdue: 'var(--red)',
  failed: 'var(--gray)',
}

const selectedId = ref<number | null>(null)
const jobs = ref<PrintJob[]>([])
const filaments = ref<Filament[]>([])

const selected = computed(() => works.works.find((w) => w.id === selectedId.value) || null)
const filamentName = (id: number | null) =>
  id == null ? '—' : filaments.value.find((f) => f.id === id)?.brand || `#${id}`

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
  <div>
    <div class="page-head">
      <h1 class="page-title">进度板</h1>
      <span class="muted" style="font-size:13px">点击作品卡片查看 / 新增打印记录</span>
    </div>

    <div class="board">
      <div v-for="col in columns" :key="col" class="col" :style="{ borderTopColor: colColor[col] }">
        <div class="col-head">
          <StatusBadge :status="col" />
          <span class="count">{{ works.byStatus[col].length }}</span>
        </div>
        <div
          v-for="w in works.byStatus[col]"
          :key="w.id"
          class="item"
          :class="{ active: selectedId === w.id }"
          @click="selectWork(w.id)"
        >
          <span class="item-name">{{ w.name }}</span>
          <span v-if="w.for_sale" class="sale-dot" title="售卖中">¥</span>
        </div>
        <div v-if="works.byStatus[col].length === 0" class="item empty">拖拽或点击添加</div>
      </div>
    </div>

    <div v-if="selected" class="card detail">
      <div class="detail-head">
        <h2 class="detail-title">打印记录 · <span style="color:var(--text)">{{ selected.name }}</span></h2>
        <StatusBadge :status="selected.status" />
      </div>

      <div class="job-form">
        <label class="field">耗材
          <select v-model="jobForm.filament_id" class="select">
            <option value="">未关联</option>
            <option v-for="f in filaments" :key="f.id" :value="f.id">
              {{ f.brand || '耗材' }} {{ f.color || '' }} (余{{ f.remaining_g ?? 0 }}g)
            </option>
          </select>
        </label>
        <label class="field">结果
          <select v-model="jobForm.result" class="select">
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
        </label>
        <label class="field">用量(g)
          <input v-model="jobForm.filament_used" class="input" placeholder="如 120" inputmode="decimal" />
        </label>
        <label class="field">开始
          <input v-model="jobForm.started_at" class="input" type="datetime-local" />
        </label>
        <label class="field">结束
          <input v-model="jobForm.ended_at" class="input" type="datetime-local" />
        </label>
        <label class="field">备注
          <input v-model="jobForm.note" class="input" placeholder="可选" />
        </label>
        <button class="btn" style="align-self:flex-end" @click="addJob">+ 新增记录</button>
      </div>

      <table v-if="jobs.length" class="table jobs">
        <thead>
          <tr><th>耗材</th><th>结果</th><th>用量(g)</th><th>开始</th><th>结束</th><th>备注</th></tr>
        </thead>
        <tbody>
          <tr v-for="j in jobs" :key="j.id">
            <td>{{ filamentName(j.filament_id) }}</td>
            <td>
              <span class="badge" :class="j.result === 'success' ? 'ok' : 'bad'">
                {{ j.result === 'success' ? '成功' : '失败' }}
              </span>
            </td>
            <td>{{ j.filament_used ?? '—' }}</td>
            <td class="mono">{{ (j.started_at || '—').replace('T', ' ') }}</td>
            <td class="mono">{{ (j.ended_at || '—').replace('T', ' ') }}</td>
            <td>{{ j.note ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted" style="font-size:13px">该作品暂无打印记录。</p>
    </div>
  </div>
</template>

<style scoped>
.board { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: 14px; }
@media (max-width: 1200px) { .board { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 720px) { .board { grid-template-columns: repeat(2, 1fr); } }
.col { background: var(--panel); border: 1px solid var(--line); border-top: 3px solid var(--line); border-radius: var(--radius); padding: 12px; min-height: 240px; transition: var(--transition); }
.col-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.count {
  font-size: 12px; color: var(--muted); background: var(--bg-soft);
  border-radius: 999px; padding: 1px 9px; font-weight: 600;
}
.item {
  background: var(--bg-soft); border: 1px solid var(--line); border-radius: 9px;
  padding: 9px 11px; font-size: 13px; margin-bottom: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  transition: var(--transition);
}
.item:hover { border-color: var(--accent); background: var(--accent-weak); }
.item.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: var(--accent-weak); }
.item.empty { color: var(--muted); text-align: center; justify-content: center; cursor: default; border-style: dashed; }
.item-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sale-dot { color: var(--red); font-weight: 700; font-size: 12px; }
.detail { margin-top: 22px; }
.detail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.detail-title { font-size: 16px; margin: 0; }
.job-form { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.job-form .field { min-width: 130px; }
.badge.ok { color: var(--green); background: var(--green-bg); }
.badge.bad { color: var(--red); background: var(--red-bg); }
.mono { font-variant-numeric: tabular-nums; font-size: 13px; }
</style>
