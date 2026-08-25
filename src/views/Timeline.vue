<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  listWorks,
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  recomputeOverdue,
  type Work,
  type Schedule,
} from '@/db/api'
import { useUiStore } from '@/stores/ui'
import { useToast } from '@/stores/toast'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const ui = useUiStore()
const toast = useToast()
const router = useRouter()
const works = ref<Work[]>([])
const schedules = ref<Schedule[]>([])
const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ work_id: '', planned_start: '', planned_end: '', priority: '0', note: '' })

const COL_W = 38 // px/天
const todayIso = new Date().toISOString().slice(0, 10)

// 仅当前类型过滤下的作品 / 排期
const visibleWorks = computed(() =>
  works.value.filter((w) => ui.typeFilter === 'all' || w.type === ui.typeFilter),
)
const visibleSchedules = computed(() =>
  schedules.value.filter((s) => visibleWorks.value.some((w) => w.id === s.work_id)),
)

async function reload() {
  works.value = await listWorks()
  schedules.value = await listSchedules()
}
onMounted(reload)

const workName = (id: number) => works.value.find((w) => w.id === id)?.name || `#${id}`
const workIsOverdue = (id: number) => works.value.find((w) => w.id === id)?.status === 'overdue'

const base = computed<Date>(() => {
  const starts = visibleSchedules.value.filter((s) => s.planned_start).map((s) => new Date(s.planned_start!))
  const t = new Date(); t.setHours(0, 0, 0, 0)
  const seed = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : t
  seed.setHours(0, 0, 0, 0)
  // 周一对齐
  seed.setDate(seed.getDate() - ((seed.getDay() + 6) % 7))
  return seed
})

const totalDays = computed<number>(() => {
  const ends = visibleSchedules.value.filter((s) => s.planned_end).map((s) => new Date(s.planned_end!))
  const maxEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : new Date(base.value.getTime() + 27 * 86400000)
  const span = Math.ceil((maxEnd.getTime() - base.value.getTime()) / 86400000) + 1
  return Math.max(span, 28)
})

const weeks = computed(() => {
  const arr: { month: string; days: { idx: number; date: string; iso: string; today: boolean }[] }[] = []
  for (let i = 0; i < totalDays.value; i += 7) {
    const days = []
    let month = ''
    for (let j = 0; j < 7 && i + j < totalDays.value; j++) {
      const d = new Date(base.value.getTime() + (i + j) * 86400000)
      const iso = d.toISOString().slice(0, 10)
      if (!month) month = `${d.getFullYear()}年${d.getMonth() + 1}月`
      days.push({ idx: i + j, date: `${d.getMonth() + 1}/${d.getDate()}`, iso, today: iso === todayIso })
    }
    arr.push({ month, days })
  }
  return arr
})

function dayIndex(dateStr: string | null): number {
  if (!dateStr) return 0
  return Math.round((new Date(dateStr).getTime() - base.value.getTime()) / 86400000)
}
function spanDays(s: Schedule): number {
  if (!s.planned_start || !s.planned_end) return 1
  return Math.max(1, Math.round((new Date(s.planned_end).getTime() - new Date(s.planned_start).getTime()) / 86400000) + 1)
}
// 排期是否超期（结束日早于今天）：在时间线画布上直接标红，与项目的 overdue 态一致
function scheduleOverdue(s: Schedule): boolean {
  return !!s.planned_end && s.planned_end < todayIso
}

// 「今天」竖线位置（对齐表头日格中心）
const tlEl = ref<HTMLElement | null>(null)
const todayIdx = computed(() => {
  const idx = dayIndex(todayIso)
  return idx >= 0 && idx < totalDays.value ? idx : -1
})

// 横向滚动到「今天」竖线附近（140 = 左侧名称列宽）
function scrollToday() {
  if (todayIdx.value < 0 || !tlEl.value) return
  const left = Math.max(0, 140 + todayIdx.value * COL_W - 260)
  tlEl.value.scrollTo({ left, behavior: 'smooth' })
}
// ---- 拖拽色条：整体平移排期日期（松开即保存）----
const drag = ref<{ id: number; startX: number; days: number } | null>(null)
let justDragged = false

function shiftDate(dateStr: string | null, days: number): string | null {
  if (!dateStr) return null
  return new Date(new Date(dateStr).getTime() + days * 86400000).toISOString().slice(0, 10)
}

function onBarDown(s: Schedule, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag.value = { id: s.id, startX: e.clientX, days: 0 }
}
function onBarMove(e: PointerEvent) {
  const d = drag.value
  if (d) d.days = Math.round((e.clientX - d.startX) / COL_W)
}
async function onBarUp(s: Schedule) {
  const d = drag.value
  drag.value = null
  if (!d || !d.days) return // 未移动视为点击 → 走 click 打开编辑
  justDragged = true
  await updateSchedule(s.id, {
    planned_start: shiftDate(s.planned_start, d.days),
    planned_end: shiftDate(s.planned_end, d.days),
  })
  await recomputeOverdue()
  await reload()
  toast.success(`已${d.days > 0 ? '后延' : '前移'} ${Math.abs(d.days)} 天`)
}

// 拖拽中的视觉位移
function dragStyle(s: Schedule): Record<string, string> {
  const d = drag.value
  if (d?.id === s.id && d.days !== 0) return { transform: `translateX(${d.days * COL_W}px)` }
  return {}
}

function openCreate() {
  editingId.value = null
  form.value = { work_id: '', planned_start: todayIso, planned_end: '', priority: '0', note: '' }
  showModal.value = true
}

// 编辑已有排期（点击色条或「编」按钮进入）
function openEdit(s: Schedule) {
  if (justDragged) {
    // 这次 click 是拖拽结束的附带事件，忽略
    justDragged = false
    return
  }
  editingId.value = s.id
  form.value = {
    work_id: String(s.work_id),
    planned_start: s.planned_start || '',
    planned_end: s.planned_end || '',
    priority: String(s.priority ?? 0),
    note: s.note || '',
  }
  showModal.value = true
}

// 快捷键 N：打开新增排期弹窗（App 层广播）
watch(
  () => ui.newSignal,
  () => {
    if (!showModal.value) openCreate()
  },
)

async function submitSchedule() {
  if (!form.value.work_id || !form.value.planned_start) {
    toast.error('请选择作品与开始日期')
    return
  }
  const payload = {
    work_id: Number(form.value.work_id),
    planned_start: form.value.planned_start,
    planned_end: form.value.planned_end || null,
    priority: Number(form.value.priority),
    note: form.value.note,
  }
  const editId = editingId.value
  const isEdit = editId != null
  if (isEdit) await updateSchedule(editId, payload)
  else await createSchedule(payload)
  await recomputeOverdue() // 保存后立即重算逾期，保证看板/列表实时标红
  showModal.value = false
  await reload()
  toast.success(isEdit ? '排期已更新' : '排期已保存')
}

// 表单内按 Enter 直接保存（仅对输入框生效，避免 select 误触）
function onFormEnter(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t.tagName === 'INPUT') {
    e.preventDefault()
    submitSchedule()
  }
}

// 删除：自定义确认弹窗（替代 window.confirm）
const confirmRemove = ref(false)
const removeId = ref<number | null>(null)
function askRemove(id: number) {
  removeId.value = id
  confirmRemove.value = true
}
async function doRemove() {
  const id = removeId.value
  if (id == null) return
  confirmRemove.value = false
  removeId.value = null
  await deleteSchedule(id)
  await recomputeOverdue()
  await reload()
  toast.success('排期已删除')
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">时间线 / 排期</h1>
        <p class="subtitle">按周视图排期，超期自动标红 · 拖动色条整体平移，点击色条或「编」可修改</p>
      </div>
      <div class="row">
        <button class="btn" @click="openCreate">+ 新增排期</button>
        <button v-if="visibleSchedules.length && todayIdx >= 0" class="btn ghost" title="滚动到今天的位置" @click="scrollToday">回到今天</button>
      </div>
    </div>

    <div v-if="visibleSchedules.length" ref="tlEl" class="card timeline">
      <div class="tl-legend">
        <span class="lg"><i class="sw p2"></i>高优先级</span>
        <span class="lg"><i class="sw p1"></i>中</span>
        <span class="lg"><i class="sw p0"></i>低</span>
        <span class="lg"><i class="sw sw-today"></i>今天</span>
      </div>
      <div class="axis">
        <div class="axis-corner">作品</div>
        <div class="axis-weeks">
          <div v-for="w in weeks" :key="w.month" class="week">
            <div class="week-month">{{ w.month }}</div>
            <div class="week-days">
              <span v-for="d in w.days" :key="d.idx" class="day" :class="{ today: d.today }">{{ d.date }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="rows">
        <div v-for="s in visibleSchedules" :key="s.id" class="srow">
          <div
            class="sname"
            :class="{ overdue: workIsOverdue(s.work_id) }"
            title="打开作品库详情"
            @click="router.push(`/library?work=${s.work_id}`)"
          >{{ workName(s.work_id) }}</div>
          <div class="track" :style="{ width: totalDays * COL_W + 'px' }">
            <div v-if="todayIdx >= 0" class="today-line" :style="{ left: todayIdx * COL_W + COL_W / 2 - 1 + 'px' }"></div>
            <div
              v-if="s.planned_start"
              class="bar grow-x"
              :class="[ 'p' + (s.priority ?? 0), { overdue: scheduleOverdue(s), dragging: drag?.id === s.id && drag.days !== 0 } ]"
              :style="{ left: dayIndex(s.planned_start) * COL_W + 'px', width: spanDays(s) * COL_W - 3 + 'px', ...dragStyle(s) }"
              :title="`${workName(s.work_id)} · ${s.planned_start}${s.planned_end ? ' ~ ' + s.planned_end : ''}${s.note ? ' · ' + s.note : ''}（拖动平移 / 点击编辑）`"
              @pointerdown="onBarDown(s, $event)"
              @pointermove="onBarMove"
              @pointerup="onBarUp(s)"
              @click="openEdit(s)"
            >
              <span class="bar-text">{{ workName(s.work_id) }}</span>
            </div>
            <div v-else class="bar-note">未设日期 · {{ s.note || '' }}</div>
          </div>
          <button class="mini" title="编辑排期" @click.stop="openEdit(s)">编</button>
          <button class="mini danger" title="删除排期" @click="askRemove(s.id)">删</button>
        </div>
      </div>
    </div>

    <EmptyState v-else emoji="🗓️" title="还没有排期" desc="规划你的项目队列，按周视图排期，今天会以高亮显示。">
      <button class="btn" @click="openCreate">+ 新增排期</button>
    </EmptyState>

    <BaseModal :open="showModal" :title="editingId != null ? '编辑排期' : '新增排期'" width="520px" @close="showModal = false">
      <div class="form-grid" @keydown.enter="onFormEnter">
        <label class="field">作品
          <select v-model="form.work_id" class="select">
            <option value="">选择作品</option>
            <option v-for="w in visibleWorks" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label class="field">开始
          <input v-model="form.planned_start" class="input" type="date" />
        </label>
        <label class="field">结束
          <input v-model="form.planned_end" class="input" type="date" />
        </label>
        <label class="field">优先级
          <select v-model="form.priority" class="select">
            <option value="2">高</option>
            <option value="1">中</option>
            <option value="0">低</option>
          </select>
        </label>
        <label class="field">备注
          <input v-model="form.note" class="input" placeholder="可选" />
        </label>
      </div>
      <template #footer>
        <button class="btn ghost" @click="showModal = false">取消</button>
        <button class="btn" @click="submitSchedule">保存</button>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="confirmRemove"
      danger
      title="删除排期"
      message="确定删除这条排期？删除后相关项目的逾期状态会自动重算。"
      confirm-text="删除"
      @cancel="confirmRemove = false"
      @confirm="doRemove"
    />
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.timeline { overflow-x: auto; }
.tl-legend { display: flex; gap: 14px; align-items: center; padding: 0 0 10px; font-size: 12px; color: var(--text-2); }
.tl-legend .lg { display: inline-flex; align-items: center; gap: 6px; }
.tl-legend .sw { width: 14px; height: 8px; border-radius: 4px; display: inline-block; }
.tl-legend .sw.p2 { background: linear-gradient(135deg, #e23c3c, #f06464); }
.tl-legend .sw.p1 { background: linear-gradient(135deg, #e8912f, #f0a44f); }
.tl-legend .sw.p0 { background: linear-gradient(135deg, #3b6fe0, #6f9bff); }
.tl-legend .sw.sw-today { background: var(--red); opacity: 0.4; }
.axis { display: flex; border-bottom: 1px solid var(--line); margin-bottom: 8px; }
.axis-corner { width: 140px; flex-shrink: 0; font-weight: 700; font-size: 13px; color: var(--muted); }
.axis-weeks { display: flex; }
.week { border-left: 1px solid var(--line); }
.week-month { font-size: 11px; color: var(--muted); padding: 2px 0 4px; text-align: center; font-weight: 600; }
.week-days { display: flex; }
.day { width: 38px; text-align: center; font-size: 11px; color: var(--muted); padding: 3px 0; }
.day.today { color: var(--accent); font-weight: 700; background: var(--accent-weak); border-radius: 6px; }
.rows { display: flex; flex-direction: column; gap: 6px; }
.srow { display: flex; align-items: center; gap: 0; border-radius: 8px; transition: var(--transition); }
.srow:hover { background: var(--hover); }
.sname { width: 140px; flex-shrink: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 6px; cursor: pointer; }
.sname:hover { color: var(--accent); text-decoration: underline; }
.sname.overdue { color: var(--red); }
.track { position: relative; height: 32px; flex-shrink: 0; }
.today-line {
  position: absolute;
  top: -24px;
  bottom: -2px;
  width: 2px;
  background: var(--red);
  opacity: 0.35;
  border-radius: 2px;
  pointer-events: none;
}
.bar { position: absolute; top: 4px; height: 24px; border-radius: 7px; display: flex; align-items: center; padding: 0 8px; color: #fff; font-size: 12px; overflow: hidden; white-space: nowrap; box-shadow: var(--shadow-sm); transition: filter 0.2s ease; cursor: grab; touch-action: none; user-select: none; }
.bar.dragging { opacity: 0.75; cursor: grabbing; z-index: 2; box-shadow: var(--shadow-md); }
.srow:hover .bar { filter: brightness(1.08); transform: translateY(-1px); }
.p2 { background: linear-gradient(135deg, #e23c3c, #f06464); }
.p1 { background: linear-gradient(135deg, #e8912f, #f0a44f); }
.p0 { background: linear-gradient(135deg, #3b6fe0, #6f9bff); }
.bar.overdue { background: linear-gradient(135deg, #c01f1f, #e23c3c) !important; box-shadow: 0 0 0 2px var(--red-bg); }
.bar-note { font-size: 12px; color: var(--muted); line-height: 32px; }
.mini { margin-left: 8px; border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px; padding: 4px 9px; font-size: 12px; cursor: pointer; flex-shrink: 0; opacity: 0.55; transition: var(--transition); }
.srow:hover .mini { opacity: 1; }
.mini.danger { color: var(--red); border-color: var(--red-bg); }
.mini.danger:hover { background: var(--red-bg); }
</style>
