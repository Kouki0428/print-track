<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  listWorks,
  listSchedules,
  createSchedule,
  deleteSchedule,
  type Work,
  type Schedule,
} from '@/db/api'

const works = ref<Work[]>([])
const schedules = ref<Schedule[]>([])
const showForm = ref(false)
const form = ref({ work_id: '', planned_start: '', planned_end: '', priority: '0', note: '' })

const COL_W = 38 // px/天

async function reload() {
  works.value = await listWorks()
  schedules.value = await listSchedules()
}
onMounted(reload)

const workName = (id: number) => works.value.find((w) => w.id === id)?.name || `#${id}`

// 计算时间轴范围：以最早排期起点或今天为基准，至少覆盖 28 天
const base = computed<Date>(() => {
  const starts = schedules.value.filter((s) => s.planned_start).map((s) => new Date(s.planned_start!))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const seed = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : today
  seed.setHours(0, 0, 0, 0)
  return seed
})

const totalDays = computed<number>(() => {
  const ends = schedules.value.filter((s) => s.planned_end).map((s) => new Date(s.planned_end!))
  const maxEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : new Date(base.value.getTime() + 27 * 86400000)
  const span = Math.ceil((maxEnd.getTime() - base.value.getTime()) / 86400000) + 1
  return Math.max(span, 28)
})

const weeks = computed(() => {
  const arr: { label: string; days: { idx: number; date: string }[] }[] = []
  for (let i = 0; i < totalDays.value; i += 7) {
    const days = []
    for (let j = 0; j < 7 && i + j < totalDays.value; j++) {
      const d = new Date(base.value.getTime() + (i + j) * 86400000)
      days.push({ idx: i + j, date: `${d.getMonth() + 1}/${d.getDate()}` })
    }
    arr.push({ label: `第${arr.length + 1}周`, days })
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

async function addSchedule() {
  if (!form.value.work_id || !form.value.planned_start) return
  await createSchedule({
    work_id: Number(form.value.work_id),
    planned_start: form.value.planned_start,
    planned_end: form.value.planned_end || null,
    priority: Number(form.value.priority),
    note: form.value.note,
  })
  form.value = { work_id: '', planned_start: '', planned_end: '', priority: '0', note: '' }
  showForm.value = false
  await reload()
}

async function remove(id: number) {
  await deleteSchedule(id)
  await reload()
}
</script>

<template>
  <div>
    <div class="page-head">
      <h2 class="page-title">时间线 / 排期</h2>
      <button class="btn" @click="showForm = true">+ 新增排期</button>
    </div>

    <div v-if="showForm" class="card form">
      <div class="row">
        <label>作品
          <select v-model="form.work_id">
            <option value="">选择作品</option>
            <option v-for="w in works" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label>开始<input v-model="form.planned_start" type="date" /></label>
        <label>结束<input v-model="form.planned_end" type="date" /></label>
        <label>优先级
          <select v-model="form.priority">
            <option :value="2">高</option>
            <option :value="1">中</option>
            <option :value="0">低</option>
          </select>
        </label>
        <label>备注<input v-model="form.note" /></label>
      </div>
      <div class="actions">
        <button class="btn" @click="addSchedule">保存</button>
        <button class="btn ghost" @click="showForm = false">取消</button>
      </div>
    </div>

    <div class="timeline">
      <div class="axis">
        <div class="axis-corner">作品</div>
        <div class="axis-weeks">
          <div v-for="w in weeks" :key="w.label" class="week">
            <div class="week-label">{{ w.label }}</div>
            <div class="week-days">
              <span v-for="d in w.days" :key="d.idx" class="day">{{ d.date }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="rows">
        <div v-for="s in schedules" :key="s.id" class="srow">
          <div class="sname">{{ workName(s.work_id) }}</div>
          <div class="track" :style="{ width: totalDays * COL_W + 'px' }">
            <div
              v-if="s.planned_start"
              class="bar"
              :class="'p' + (s.priority ?? 0)"
              :style="{ left: dayIndex(s.planned_start) * COL_W + 'px', width: spanDays(s) * COL_W - 2 + 'px' }"
            >
              <span class="bar-text">{{ workName(s.work_id) }}</span>
            </div>
            <div class="bar-note" v-if="!s.planned_start">未设日期 · {{ s.note || '' }}</div>
          </div>
          <button class="mini danger" @click="remove(s.id)">删</button>
        </div>
        <div v-if="!schedules.length" class="empty">暂无排期，点击「新增排期」规划打印队列。</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.form .row { display: flex; gap: 14px; flex-wrap: wrap; }
.form label { display: flex; flex-direction: column; font-size: 12px; color: var(--muted); gap: 4px; }
.form input, .form select { padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
.actions { margin-top: 12px; display: flex; gap: 10px; }
.btn { padding: 8px 14px; border: none; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; font-size: 14px; }
.btn.ghost { background: #e9ebef; color: var(--text); }
.timeline { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px; overflow-x: auto; }
.axis { display: flex; border-bottom: 1px solid var(--line); margin-bottom: 8px; }
.axis-corner { width: 130px; flex-shrink: 0; font-weight: 600; font-size: 13px; color: var(--muted); }
.axis-weeks { display: flex; }
.week { border-left: 1px solid var(--line); }
.week-label { font-size: 11px; color: var(--muted); padding: 4px 0; text-align: center; }
.week-days { display: flex; }
.day { width: 38px; text-align: center; font-size: 11px; color: var(--muted); padding: 2px 0; }
.rows { display: flex; flex-direction: column; gap: 6px; }
.srow { display: flex; align-items: center; gap: 0; }
.sname { width: 130px; flex-shrink: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track { position: relative; height: 30px; flex-shrink: 0; }
.bar { position: absolute; top: 3px; height: 24px; border-radius: 6px; display: flex; align-items: center; padding: 0 8px; color: #fff; font-size: 12px; overflow: hidden; white-space: nowrap; }
.p2 { background: #d23f3f; }
.p1 { background: #e8912f; }
.p0 { background: #2f6fed; }
.bar-note { font-size: 12px; color: var(--muted); line-height: 30px; }
.mini { margin-left: 8px; border: 1px solid var(--line); background: #fff; border-radius: 7px; padding: 4px 8px; font-size: 12px; cursor: pointer; flex-shrink: 0; }
.mini.danger { color: #d23f3f; border-color: #f0c5c5; }
.empty { color: var(--muted); text-align: center; padding: 18px; }
</style>
