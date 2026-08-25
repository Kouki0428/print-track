<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorksStore } from '@/stores/works'
import { useUiStore } from '@/stores/ui'
import { useToast } from '@/stores/toast'
import { createPrintJob, listPrintJobs, deletePrintJob, typeLabel, STATUS_LABELS, type PrintJob, type Work, type WorkStatus } from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const works = useWorksStore()
const ui = useUiStore()
const toast = useToast()
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
const colBg: Record<WorkStatus, string> = {
  planning: 'var(--purple-bg)',
  designing: 'var(--blue-bg)',
  making: 'var(--orange-bg)',
  done: 'var(--green-bg)',
  overdue: 'var(--red-bg)',
  failed: 'var(--gray-bg)',
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

// 根据起止时间自动计算时长（小时）
const jobDuration = computed(() => {
  const { started_at, ended_at } = jobForm.value
  if (!started_at || !ended_at) return ''
  const h = (new Date(ended_at).getTime() - new Date(started_at).getTime()) / 3600000
  return h > 0 ? h.toFixed(1) : ''
})

// ---- 拖拽换列：拖动卡片到目标状态列即可改状态 ----
const dragId = ref<number | null>(null)
const overCol = ref<WorkStatus | null>(null)

function onDragStart(w: Work, e: DragEvent) {
  dragId.value = w.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(w.id))
  }
}
function onDragEnd() {
  dragId.value = null
  overCol.value = null
}
function onDragOver(col: WorkStatus, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  overCol.value = col
}
function onDragLeave(col: WorkStatus) {
  if (overCol.value === col) overCol.value = null
}
async function onDrop(col: WorkStatus, e: DragEvent) {
  e.preventDefault()
  const raw = e.dataTransfer?.getData('text/plain')
  const id = raw ? Number(raw) : dragId.value
  overCol.value = null
  dragId.value = null
  if (id == null || Number.isNaN(id)) return
  const w = works.works.find((x) => x.id === id)
  if (!w || w.status === col) return
  await works.patch(id, { status: col })
  toast.success(`「${w.name}」已移动到「${STATUS_LABELS[col]}」`)
}

function firstColor(w: Work): string | undefined {
  return w.material_colors?.[0]
}

// datetime-local 本地格式（YYYY-MM-DDTHH:mm）
function nowLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(async () => {
  await works.fetchAll()
})

async function selectWork(id: number) {
  selectedId.value = id
  // 开始时间默认填当前时刻，减少手动输入
  if (!jobForm.value.started_at) jobForm.value.started_at = nowLocal()
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
  const { started_at, ended_at } = jobForm.value
  if (started_at && ended_at && ended_at < started_at) {
    toast.error('结束时间不能早于开始时间')
    return
  }
  await createPrintJob({
    work_id: selectedId.value,
    result: jobForm.value.result,
    filament_used: jobForm.value.filament_used ? Number(jobForm.value.filament_used) : null,
    note: jobForm.value.note.trim() || null,
    started_at: started_at || null,
    ended_at: ended_at || null,
  })
  jobForm.value = { result: 'success', filament_used: '', note: '', started_at: nowLocal(), ended_at: '' }
  await reloadJobs()
  toast.success('已新增打印记录')
}

// 删除单条打印记录（确认弹窗）
const confirmRemoveJob = ref(false)
const removeJobId = ref<number | null>(null)
function askRemoveJob(id: number) {
  removeJobId.value = id
  confirmRemoveJob.value = true
}
async function doRemoveJob() {
  const id = removeJobId.value
  if (id == null) return
  confirmRemoveJob.value = false
  removeJobId.value = null
  await deletePrintJob(id)
  await reloadJobs()
  toast.success('打印记录已删除')
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">进度板</h1>
          <p class="subtitle">
            拖动卡片到目标列即可改状态 · 点击卡片查看 / 新增打印记录
            <template v-if="ui.typeFilter !== 'all'"> · 仅显示{{ typeLabel(ui.typeFilter) }}项目</template>
          </p>
      </div>
    </div>

    <div class="board">
      <div
        v-for="col in columns"
        :key="col"
        class="col"
        :class="{ 'drag-over': overCol === col }"
        :style="{ borderTopColor: colColor[col] }"
        @dragover="onDragOver(col, $event)"
        @dragleave="onDragLeave(col)"
        @drop="onDrop(col, $event)"
      >
        <div class="col-head">
          <StatusBadge :status="col" />
          <span class="count" :style="{ color: colColor[col], background: colBg[col] }">{{ countOf(col) }}</span>
        </div>
        <TransitionGroup tag="div" name="cards" class="col-items">
          <div
            v-for="w in byStatusVisible[col]"
            :key="w.id"
            class="item"
            :class="{ active: selectedId === w.id, dragging: dragId === w.id }"
            draggable="true"
            @dragstart="onDragStart(w, $event)"
            @dragend="onDragEnd"
            @click="selectWork(w.id)"
          >
            <span class="item-name">{{ w.name }}</span>
            <span v-if="firstColor(w)" class="color-chip" :style="{ background: firstColor(w) }" :title="firstColor(w)"></span>
            <span v-if="w.for_sale" class="sale-dot" title="售卖中">¥</span>
          </div>
        </TransitionGroup>
        <div v-if="countOf(col) === 0" class="item empty">{{ overCol === col ? '松开以移动到此' : '暂无 · 可拖入卡片' }}</div>
      </div>
    </div>

    <Transition name="detail">
      <div v-if="selected" class="card detail">
      <div class="detail-head">
        <h2 class="detail-title">打印记录 · <span style="color:var(--text)">{{ selected.name }}</span></h2>
        <StatusBadge :status="selected.status" />
      </div>

      <div v-if="selected.material_colors && selected.material_colors.length" class="material-line">
        关联线材：
        <span
          v-for="c in selected.material_colors"
          :key="c"
          class="material-dot"
          :style="{ background: c }"
          :title="c"
        ></span>
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
        <span v-if="jobDuration" class="dur-hint">时长 {{ jobDuration }} h</span>
        <button class="btn" style="align-self:flex-end" @click="addJob">+ 新增记录</button>
      </div>

      <table v-if="jobs.length" class="table jobs">
        <thead>
          <tr><th>结果</th><th>用量(g)</th><th>开始</th><th>结束</th><th>备注</th><th></th></tr>
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
            <td class="job-ops">
              <button class="mini danger" title="删除记录" @click="askRemoveJob(j.id)">删</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted" style="font-size:13px">该作品暂无打印记录。</p>
      </div>
    </Transition>

    <ConfirmDialog
      :open="confirmRemoveJob"
      danger
      title="删除打印记录"
      message="确定删除这条打印记录？该操作不可撤销。"
      confirm-text="删除"
      @cancel="confirmRemoveJob = false"
      @confirm="doRemoveJob"
    />
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.board { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: 14px; }
@media (max-width: 1200px) { .board { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 720px) { .board { grid-template-columns: repeat(2, 1fr); } }
.col { background: var(--panel); border: 1px solid var(--line); border-top: 3px solid var(--line); border-radius: var(--radius); padding: 12px; min-height: 240px; transition: var(--transition); position: relative; }
.col.drag-over { border-color: var(--accent); background: var(--accent-weak); box-shadow: var(--shadow-md); }
.item.dragging { opacity: 0.45; }
.subtitle .drag-hint { color: var(--muted); }
.col-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.count { font-size: 12px; border-radius: 999px; padding: 1px 9px; font-weight: 700; font-variant-numeric: tabular-nums; }
.col-items { display: flex; flex-direction: column; gap: 8px; }
.item {
  background: var(--bg-soft); border: 1px solid var(--line); border-radius: 9px;
  padding: 9px 11px; font-size: 13px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  transition: var(--transition);
}
.item:hover { border-color: var(--accent); background: var(--accent-weak); transform: translateY(-1px); }
.item.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: var(--accent-weak); }
.item.empty { color: var(--muted); text-align: center; justify-content: center; cursor: default; border-style: dashed; margin-top: 8px; }

/* 卡片在列间移动 / 进出时的过渡 */
.cards-move { transition: transform 0.35s var(--ease-out); }
.cards-enter-active { transition: all 0.3s var(--ease-out); }
.cards-leave-active { transition: all 0.18s ease; position: absolute; width: 100%; }
.cards-enter-from { opacity: 0; transform: translateY(8px) scale(0.97); }
.cards-leave-to { opacity: 0; transform: scale(0.95); }

/* 详情面板展开 */
.detail-enter-active { transition: all 0.3s var(--ease-out); }
.detail-leave-active { transition: all 0.16s ease; }
.detail-enter-from, .detail-leave-to { opacity: 0; transform: translateY(12px); }
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
.job-ops { white-space: nowrap; text-align: right; }
.mini { border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px; padding: 4px 9px; font-size: 12px; cursor: pointer; transition: var(--transition); }
.mini.danger { color: var(--red); border-color: var(--red-bg); }
.mini.danger:hover { background: var(--red-bg); opacity: 1; }
.dur-hint { font-size: 12px; color: var(--accent); background: var(--accent-weak); padding: 6px 10px; border-radius: 8px; font-weight: 600; align-self: flex-end; margin-bottom: 2px; white-space: nowrap; }
</style>
