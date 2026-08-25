<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWorksStore } from '@/stores/works'
import { useUiStore } from '@/stores/ui'
import {
  typeLabel,
  recentJobs,
  listSchedules,
  monthPrintStats,
  weeklyPrintTrend,
  type RecentJob,
  type Schedule,
  type WorkStatus,
} from '@/db/api'
import { useCountUp } from '@/composables/useCountUp'
import StatusBadge from '@/components/StatusBadge.vue'

const works = useWorksStore()
const ui = useUiStore()
const router = useRouter()
const recent = ref<RecentJob[]>([])
const schedules = ref<Schedule[]>([])
const mStats = ref({ total: 0, success: 0 })
const trend = ref<{ label: string; total: number; success: number }[]>([])

onMounted(async () => {
  await works.fetchAll()
  recent.value = await recentJobs(6)
  schedules.value = await listSchedules()
  mStats.value = await monthPrintStats()
  trend.value = await weeklyPrintTrend(8)
})

// 趋势柱高（最大值为基准）
const maxWeek = computed(() => Math.max(1, ...trend.value.map((t) => t.total)))

// 本月打印成功率（无记录时为 null 不显示）
const successRate = computed(() =>
  mStats.value.total ? Math.round((mStats.value.success / mStats.value.total) * 100) : null,
)

// 仅统计当前类型过滤下的作品
const scoped = computed(() =>
  works.works.filter((w) => ui.typeFilter === 'all' || w.type === ui.typeFilter),
)
const total = computed(() => scoped.value.length)

// 按类型过滤后的状态分布
const byStatusScoped = computed(() => {
  const map: Record<WorkStatus, typeof scoped.value> = {
    planning: [], designing: [], making: [], done: [], overdue: [], failed: [],
  }
  for (const w of scoped.value) map[w.status].push(w)
  return map
})

const statusOrder: WorkStatus[] = ['planning', 'designing', 'making', 'done', 'overdue', 'failed']
const colorVar: Record<WorkStatus, string> = {
  planning: 'var(--purple)',
  designing: 'var(--blue)',
  making: 'var(--orange)',
  done: 'var(--green)',
  overdue: 'var(--red)',
  failed: 'var(--gray)',
}
const distribution = computed(() =>
  statusOrder.map((s) => ({
    status: s,
    count: byStatusScoped.value[s].length,
    pct: total.value ? (byStatusScoped.value[s].length / total.value) * 100 : 0,
  })),
)

const recentWorks = computed(() =>
  [...scoped.value].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5),
)

// ---- 即将截止（14 天内到期或已逾期，按截止日升序）----
const todayIso = new Date().toISOString().slice(0, 10)
function daysLeft(end: string): number {
  return Math.round((new Date(end).getTime() - new Date(todayIso).getTime()) / 86400000)
}
const upcoming = computed(() => {
  const ids = new Set(scoped.value.map((w) => w.id))
  return schedules.value
    .filter((s) => s.planned_end && ids.has(s.work_id))
    .map((s) => ({ ...s, left: daysLeft(s.planned_end!) }))
    .filter((s) => s.left <= 14)
    .sort((a, b) => (a.planned_end! < b.planned_end! ? -1 : 1))
    .slice(0, 6)
})
function dueLabel(left: number): { text: string; cls: string } {
  if (left < 0) return { text: `逾期 ${-left} 天`, cls: 'overdue' }
  if (left === 0) return { text: '今天截止', cls: 'today' }
  if (left <= 3) return { text: `剩 ${left} 天`, cls: 'soon' }
  return { text: `剩 ${left} 天`, cls: 'normal' }
}

// 数字滚动
const cTotal = useCountUp(() => total.value)
const cMaking = useCountUp(() => byStatusScoped.value.making.length)
const cDone = useCountUp(() => byStatusScoped.value.done.length)
const cOverdue = useCountUp(() => byStatusScoped.value.overdue.length)

function fmt(n: number): string {
  return n.toLocaleString()
}

// 图例 / 统计卡点击 → 跳转作品库并带上状态筛选
function goLibrary(status?: WorkStatus) {
  router.push(status ? `/library?status=${status}` : '/library')
}

function workTitle(id: number): string {
  return works.works.find((w) => w.id === id)?.name || `#${id}`
}

function shortDate(d: string): string {
  if (!d) return '—'
  return d.slice(0, 10)
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">仪表盘</h1>
        <p class="subtitle">
          本地数据总览
          <template v-if="ui.typeFilter !== 'all'"> · {{ typeLabel(ui.typeFilter) }}项目</template>
          · 共 {{ total }} 件
        </p>
      </div>
      <button class="btn" @click="router.push('/library?new=1')">+ 新建项目</button>
    </div>

    <!-- 首次加载骨架屏 -->
    <template v-if="works.loading && !works.works.length">
      <div class="stat-grid">
        <div v-for="i in 4" :key="i" class="stat">
          <div class="skeleton sk-num"></div>
          <div class="skeleton sk-label"></div>
        </div>
      </div>
      <div class="cols">
        <div v-for="i in 2" :key="i" class="card">
          <div class="skeleton sk-line"></div>
          <div class="skeleton sk-line short"></div>
          <div class="skeleton sk-line"></div>
        </div>
      </div>
    </template>

    <template v-else>

    <div class="stat-grid stagger">
      <div class="stat clickable" title="查看全部项目" @click="goLibrary()">
        <div class="stat-value">{{ fmt(cTotal) }}</div>
        <div class="stat-label">项目总数</div>
      </div>
      <div class="stat clickable" title="查看制作中的项目" @click="goLibrary('making')">
        <div class="stat-value">{{ fmt(cMaking) }}</div>
        <div class="stat-label">制作中</div>
      </div>
      <div class="stat clickable" title="查看已完成的项目" @click="goLibrary('done')">
        <div class="stat-value">{{ fmt(cDone) }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div
        class="stat clickable"
        :class="{ accent: byStatusScoped.overdue.length === 0 }"
        title="查看逾期的项目"
        @click="goLibrary('overdue')"
      >
        <div class="stat-value" :style="byStatusScoped.overdue.length ? 'color:var(--red)' : ''">{{ fmt(cOverdue) }}</div>
        <div class="stat-label">逾期</div>
      </div>
    </div>

    <div class="cols">
      <div class="card rise">
        <h2 class="section-title">状态分布</h2>
        <div v-if="total" class="bar">
          <div
            v-for="d in distribution"
            :key="d.status"
            class="seg grow-x"
            :style="{ width: d.pct + '%', background: colorVar[d.status] }"
            :title="`${d.count} 件`"
          ></div>
        </div>
        <div v-else class="bar"><div class="seg" style="width:100%;background:var(--line-strong)"></div></div>
        <ul class="legend">
          <li v-for="d in distribution" :key="d.status" class="clickable" title="筛选查看该状态" @click="goLibrary(d.status)">
            <span class="dot" :style="{ background: colorVar[d.status] }"></span>
            <span class="lg-label"><StatusBadge :status="d.status" /></span>
            <span class="lg-count">{{ d.count }}</span>
          </li>
        </ul>
      </div>

      <div class="card rise">
        <h2 class="section-title">即将截止</h2>
        <ul v-if="upcoming.length" class="feed due-list">
          <li v-for="s in upcoming" :key="s.id" class="due-row" title="打开该项目详情" @click="router.push(`/library?work=${s.work_id}`)">
            <span class="feed-name">{{ workTitle(s.work_id) }}</span>
            <span class="feed-time">{{ s.planned_end }}</span>
            <span class="due-badge" :class="dueLabel(s.left).cls">{{ dueLabel(s.left).text }}</span>
          </li>
        </ul>
        <p v-else class="muted" style="font-size:13px">
          近两周没有截止任务，
          <a href="#" @click.prevent="router.push('/timeline')">去排期 →</a>
        </p>
      </div>
    </div>

    <div class="cols">
      <div class="card rise">
        <h2 class="section-title">最近打印</h2>
        <div v-if="successRate != null" class="month-line">
          本月打印 <b>{{ mStats.total }}</b> 次 · 成功率
          <b :style="{ color: successRate >= 80 ? 'var(--green)' : successRate >= 50 ? 'var(--orange)' : 'var(--red)' }">{{ successRate }}%</b>
        </div>
        <!-- 近 8 周打印趋势 -->
        <div v-if="trend.some((t) => t.total)" class="trend">
          <div
            v-for="(t, i) in trend"
            :key="i"
            class="trend-col"
            :title="`周(${t.label}) 打印 ${t.total} 次 · 成功 ${t.success}`"
          >
            <div class="trend-bar" :style="{ height: (t.total / maxWeek) * 100 + '%' }">
              <div class="trend-fill" :style="{ height: t.total ? (t.success / t.total) * 100 + '%' : '0' }"></div>
            </div>
            <span class="trend-label">{{ t.label }}</span>
          </div>
        </div>
        <ul v-if="recent.length" class="feed">
          <li v-for="j in recent" :key="j.id">
            <span class="feed-name">{{ j.work_name }}</span>
            <span class="badge" :class="j.result === 'success' ? 'ok' : 'bad'">
              {{ j.result === 'success' ? '成功' : '失败' }}
            </span>
            <span class="feed-time">{{ shortDate(j.ended_at || j.started_at || '') }}</span>
          </li>
        </ul>
        <p v-else class="muted" style="font-size:13px">暂无打印记录。</p>
      </div>

      <div class="card rise">
        <h2 class="section-title">最近更新项目</h2>
        <div v-if="recentWorks.length" class="rw-list">
          <div v-for="w in recentWorks" :key="w.id" class="rw" title="打开作品库" @click="goLibrary()">
            <div class="rw-thumb" :style="w.material_colors && w.material_colors.length ? { background: w.material_colors[0], color: '#fff' } : {}">{{ w.name.slice(0, 1) }}</div>
            <div class="rw-info">
              <div class="rw-name">{{ w.name }}</div>
              <div class="muted" style="font-size:12px">{{ shortDate(w.updated_at) }} 更新 · {{ typeLabel(w.type) }}</div>
            </div>
            <StatusBadge :status="w.status" />
          </div>
        </div>
        <p v-else class="muted" style="font-size:13px">
          还没有项目，
          <a href="#" @click.prevent="goLibrary()">去「作品库」新建 →</a>
        </p>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }

.stat.clickable { cursor: pointer; }
.stat.clickable:hover { border-color: var(--accent); }

.bar { display: flex; height: 14px; border-radius: 8px; overflow: hidden; background: var(--bg-soft); }
.seg { height: 100%; transition: width 0.4s var(--ease-out); }
.legend { list-style: none; padding: 0; margin: 14px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
.legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 3px 8px; border-radius: 8px; cursor: pointer; transition: var(--transition); }
.legend li:hover { background: var(--hover); }
.dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.lg-label { flex: 1; }
.lg-count { font-weight: 700; font-variant-numeric: tabular-nums; }

.feed { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.feed li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.feed-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feed-time { color: var(--muted); font-size: 12px; }
.badge.ok { color: var(--green); background: var(--green-bg); }
.badge.bad { color: var(--red); background: var(--red-bg); }

/* 即将截止 */
.month-line { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
.month-line b { font-variant-numeric: tabular-nums; }

/* 近 8 周打印趋势 */
.trend {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 72px;
  margin-bottom: 14px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
}
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
.trend-bar {
  width: 70%;
  max-width: 26px;
  min-height: 3px;
  background: var(--bg-soft);
  border-radius: 5px 5px 0 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.trend-fill { background: linear-gradient(180deg, var(--green), var(--accent)); border-radius: 0; transition: height 0.4s var(--ease-out); }
.trend-label { font-size: 10px; color: var(--muted); white-space: nowrap; }
.due-list { gap: 6px; }
.due-row { padding: 5px 8px; margin: 0 -8px; border-radius: 9px; cursor: pointer; transition: var(--transition); }
.due-row:hover { background: var(--hover); }
.due-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.due-badge.overdue { color: var(--red); background: var(--red-bg); }
.due-badge.today { color: #fff; background: var(--orange); }
.due-badge.soon { color: var(--orange); background: var(--orange-bg); }
.due-badge.normal { color: var(--text-2); background: var(--gray-bg); }

/* 骨架屏尺寸 */
.sk-num { width: 64px; height: 30px; margin-bottom: 8px; }
.sk-label { width: 90px; height: 13px; }
.sk-line { height: 14px; margin-bottom: 12px; border-radius: 7px; }
.sk-line.short { width: 55%; }

.rw-list { display: flex; flex-direction: column; gap: 6px; }
.rw { display: flex; align-items: center; gap: 12px; padding: 5px 8px; border-radius: 10px; cursor: pointer; transition: var(--transition); }
.rw:hover { background: var(--hover); }
.rw-thumb {
  width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent-weak), var(--accent));
  color: #fff; font-weight: 700; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
}
.rw-info { flex: 1; }
.rw-name { font-weight: 600; }
</style>
