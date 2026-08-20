<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorksStore } from '@/stores/works'
import { useUiStore } from '@/stores/ui'
import { createPrintJob, listPrintJobs, type PrintJob, type WorkStatus } from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'

const works = useWorksStore()
const ui = useUiStore()
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
const jobForm = ref({ result: 'success', filament_used: '', note: '', started_at: '', ended_at: '' })

// 仅展示当前类型过滤下的项目
const visibleWorks = computed(() =>
  works.works.filter((w) => ui.typeFilter === 'all' || w.type === ui.typeFilter),
)
const byStatusVisible = computed(() => {
  const map: Record<WorkStatus, typeof visibleWorks.value> = {
    planning: [], designing: [], making: [], done: [], overdue: [], failed: [],
  }
  for (const w of visibleWorks.value) map[w.status].push(w)
  return map
})
const countOf = (s: WorkStatus) => byStatusVisible.value[s].length

const selected = computed(() => visibleWorks.value.find((w) => w.id === selectedId.value) || null)

onMounted(async () => {
  await works.fetchAll()
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
    result: jobForm.value.result,
    filament_used: jobForm.value.filament_used ? Number(jobForm.value.filament_used) : null,
    note: jobForm.value.note.trim() || null,
    started_at: jobForm.value.started_at || null,
    ended_at: jobForm.value.ended_at || null,
  })
  jobForm.value = { result: 'success', filament_used: '', note: '', started_at: '', ended_at: '' }
  await reloadJobs()
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">进度板</h1>
        <p class="subtitle">
          点击作品卡片查看 / 新增打印记录
          <template v-if="ui.typeFilter !== 'all'"> · 仅显示{{ ui.typeFilter === 'print' ? '3D 打印' : ui.typeFilter === 'model' ? '3D 建模' : '单机游戏' }}项目</template>
        </p>
      </div>
    </div>

    <div class="board">
      <div v-for="col in columns" :key="col" class="col" :style="{ borderTopColor: colColor[col] }">
        <div class="col-head">
          <StatusBadge :status="col" />
          <span class="count">{{ countOf(col) }}</span>
        </div>
        <div
          v-for="w in byStatusVisible[col]"
          :key="w.id"
          class="item"
          :class="{ active: selectedId === w.id }"
          @click="selectWork(w.id)"
        >
          <span class="item-name">{{ w.name }}</span>
          <span v-if="w.material_color" class="color-chip" :style="{ background: w.material_color }" :title="w.material_color"></span>
          <span v-if="w.for_sale" class="sale-dot" title="售卖中">¥</span>
        </div>
        <div v-if="countOf(col) === 0" class="item empty">暂无</div>
      </div>
    </div>

    <div v-if="selected" class="card detail">
      <div class="detail-head">
        <h2 class="detail-title">打印记录 · <span style="color:var(--text)">{{ selected.name }}</span></h2>
        <StatusBadge :status="selected.status" />
      </div>

      <div v-if="selected.material_color" class="material-line">
        <span class="material-dot" :style="{ background: selected.material_color }"></span>
        关联线材：<b>{{ selected.material_color.toUpperCase() }}</b>
        <span v-if="selected.material_weight"> · {{ selected.material_weight }}g</span>
      </div>

      <div class="job-form">
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
          <tr><th>结果</th><th>用量(g)</th><th>开始</th><th>结束</th><th>备注</th></tr>
        </thead>
        <tbody>
          <tr v-for="j in jobs" :key="j.id">
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
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.board { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: 14px; }
@media (max-width: 1200px) { .board { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 720px) { .board { grid-template-columns: repeat(2, 1fr); } }
.col { background: var(--panel); border: 1px solid var(--line); border-top: 3px solid var(--line); border-radius: var(--radius); padding: 12px; min-height: 240px; transition: var(--transition); }
.col-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.count { font-size: 12px; color: var(--muted); background: var(--bg-soft); border-radius: 999px; padding: 1px 9px; font-weight: 600; }
.item {
  background: var(--bg-soft); border: 1px solid var(--line); border-radius: 9px;
  padding: 9px 11px; font-size: 13px; margin-bottom: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  transition: var(--transition);
}
.item:hover { border-color: var(--accent); background: var(--accent-weak); }
.item.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: var(--accent-weak); }
.item.empty { color: var(--muted); text-align: center; justify-content: center; cursor: default; border-style: dashed; }
.item-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.color-chip { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; border: 1px solid var(--line); }
.sale-dot { color: var(--red); font-weight: 700; font-size: 12px; }
.detail { margin-top: 22px; }
.detail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.detail-title { font-size: 16px; margin: 0; }
.material-line { font-size: 13px; color: var(--text-2); margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
.material-dot { width: 16px; height: 16px; border-radius: 5px; border: 1px solid var(--line-strong); }
.job-form { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.job-form .field { min-width: 130px; }
.badge.ok { color: var(--green); background: var(--green-bg); }
.badge.bad { color: var(--red); background: var(--red-bg); }
.mono { font-variant-numeric: tabular-nums; font-size: 13px; }
</style>
