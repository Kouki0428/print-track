<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  listWorks,
  listSchedules,
  createSchedule,
  deleteSchedule,
  recomputeOverdue,
  type Work,
  type Schedule,
} from '@/db/api'
import { useUiStore } from '@/stores/ui'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const ui = useUiStore()
const works = ref<Work[]>([])
const schedules = ref<Schedule[]>([])
const showModal = ref(false)
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

function openCreate() {
  form.value = { work_id: '', planned_start: todayIso, planned_end: '', priority: '0', note: '' }
  showModal.value = true
}
async function addSchedule() {
  if (!form.value.work_id || !form.value.planned_start) return
  await createSchedule({
    work_id: Number(form.value.work_id),
    planned_start: form.value.planned_start,
    planned_end: form.value.planned_end || null,
    priority: Number(form.value.priority),
    note: form.value.note,
  })
  await recomputeOverdue() // 新建排期后立即重算一次逾期，保证看板/列表实时标红
  showModal.value = false
  await reload()
}
async function remove(id: number) {
  if (!window.confirm('确定删除这条排期？')) return
  await deleteSchedule(id)
  await recomputeOverdue()
  await reload()
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">时间线 / 排期</h1>
        <p class="subtitle">按周视图排期，超期项目自动标红（逾期态实时同步至看板 / 列表）</p>
      </div>
      <button class="btn" @click="openCreate">+ 新增排期</button>
    </div>

    <div v-if="visibleSchedules.length" class="card timeline">
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
          <div class="sname" :class="{ overdue: workIsOverdue(s.work_id) }">{{ workName(s.work_id) }}</div>
          <div class="track" :style="{ width: totalDays * COL_W + 'px' }">
            <div
              v-if="s.planned_start"
              class="bar"
              :class="[ 'p' + (s.priority ?? 0), { overdue: scheduleOverdue(s) } ]"
              :style="{ left: dayIndex(s.planned_start) * COL_W + 'px', width: spanDays(s) * COL_W - 3 + 'px' }"
            >
              <span class="bar-text">{{ workName(s.work_id) }}</span>
            </div>
            <div v-else class="bar-note">未设日期 · {{ s.note || '' }}</div>
          </div>
          <button class="mini danger" @click="remove(s.id)">删</button>
        </div>
      </div>
    </div>

    <EmptyState v-else emoji="🗓️" title="还没有排期" desc="规划你的项目队列，按周视图排期，今天会以高亮显示。">
      <button class="btn" @click="openCreate">+ 新增排期</button>
    </EmptyState>

    <BaseModal :open="showModal" title="新增排期" width="520px" @close="showModal = false">
      <div class="form-grid">
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
            <option :value="2">高</option>
            <option :value="1">中</option>
            <option :value="0">低</option>
          </select>
        </label>
        <label class="field">备注
          <input v-model="form.note" class="input" placeholder="可选" />
        </label>
      </div>
      <template #footer>
        <button class="btn ghost" @click="showModal = false">取消</button>
        <button class="btn" @click="addSchedule">保存</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.timeline { overflow-x: auto; }
.axis { display: flex; border-bottom: 1px solid var(--line); margin-bottom: 8px; }
.axis-corner { width: 140px; flex-shrink: 0; font-weight: 700; font-size: 13px; color: var(--muted); }
.axis-weeks { display: flex; }
.week { border-left: 1px solid var(--line); }
.week-month { font-size: 11px; color: var(--muted); padding: 2px 0 4px; text-align: center; font-weight: 600; }
.week-days { display: flex; }
.day { width: 38px; text-align: center; font-size: 11px; color: var(--muted); padding: 3px 0; }
.day.today { color: var(--accent); font-weight: 700; background: var(--accent-weak); border-radius: 6px; }
.rows { display: flex; flex-direction: column; gap: 6px; }
.srow { display: flex; align-items: center; gap: 0; }
.sname { width: 140px; flex-shrink: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sname.overdue { color: var(--red); }
.track { position: relative; height: 32px; flex-shrink: 0; }
.bar { position: absolute; top: 4px; height: 24px; border-radius: 7px; display: flex; align-items: center; padding: 0 8px; color: #fff; font-size: 12px; overflow: hidden; white-space: nowrap; box-shadow: var(--shadow-sm); }
.p2 { background: linear-gradient(135deg, #e23c3c, #f06464); }
.p1 { background: linear-gradient(135deg, #e8912f, #f0a44f); }
.p0 { background: linear-gradient(135deg, #3b6fe0, #6f9bff); }
.bar.overdue { background: linear-gradient(135deg, #c01f1f, #e23c3c) !important; box-shadow: 0 0 0 2px var(--red-bg); }
.bar-note { font-size: 12px; color: var(--muted); line-height: 32px; }
.mini { margin-left: 8px; border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px; padding: 4px 9px; font-size: 12px; cursor: pointer; flex-shrink: 0; }
.mini.danger { color: var(--red); border-color: var(--red-bg); }
.mini.danger:hover { background: var(--red-bg); }
</style>
