<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWorksStore } from '@/stores/works'
import { recentJobs, type RecentJob, type WorkStatus } from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'

const works = useWorksStore()
const recent = ref<RecentJob[]>([])

onMounted(async () => {
  await works.fetchAll()
  recent.value = await recentJobs(6)
})

const total = computed(() => works.totalCount)

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
    count: works.byStatus[s].length,
    pct: total.value ? (works.byStatus[s].length / total.value) * 100 : 0,
  })),
)

const recentWorks = computed(() =>
  [...works.works].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5),
)

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
        <p class="subtitle">本地数据总览 · 共 {{ total }} 件作品</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <div class="stat-value">{{ total }}</div>
        <div class="stat-label">作品总数</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ works.byStatus.making.length }}</div>
        <div class="stat-label">制作中</div>
      </div>
      <div class="stat">
        <div class="stat-value">{{ works.byStatus.done.length }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat accent">
        <div class="stat-value">¥{{ works.estimatedRevenue.toFixed(0) }}</div>
        <div class="stat-label">预估收益（标记售卖）</div>
      </div>
    </div>

    <div class="cols">
      <div class="card">
        <h2 class="section-title">状态分布</h2>
        <div v-if="total" class="bar">
          <div
            v-for="d in distribution"
            :key="d.status"
            class="seg"
            :style="{ width: d.pct + '%', background: colorVar[d.status] }"
            :title="`${d.count} 件`"
          ></div>
        </div>
        <div v-else class="bar"><div class="seg" style="width:100%;background:var(--line-strong)"></div></div>
        <ul class="legend">
          <li v-for="d in distribution" :key="d.status">
            <span class="dot" :style="{ background: colorVar[d.status] }"></span>
            <span class="lg-label"><StatusBadge :status="d.status" /></span>
            <span class="lg-count">{{ d.count }}</span>
          </li>
        </ul>
      </div>

      <div class="card">
        <h2 class="section-title">最近打印</h2>
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
    </div>

    <div class="card">
      <h2 class="section-title">最近更新作品</h2>
      <div v-if="recentWorks.length" class="rw-list">
        <div v-for="w in recentWorks" :key="w.id" class="rw">
          <div class="rw-thumb">{{ w.name.slice(0, 1) }}</div>
          <div class="rw-info">
            <div class="rw-name">{{ w.name }}</div>
            <div class="muted" style="font-size:12px">{{ shortDate(w.updated_at) }} 更新</div>
          </div>
          <StatusBadge :status="w.status" />
        </div>
      </div>
      <p v-else class="muted" style="font-size:13px">还没有作品，去「作品库」新建吧。</p>
    </div>
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }

.bar { display: flex; height: 14px; border-radius: 8px; overflow: hidden; background: var(--bg-soft); }
.seg { height: 100%; transition: width 0.4s ease; }
.legend { list-style: none; padding: 0; margin: 16px 0 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
.legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.lg-label { flex: 1; }
.lg-count { font-weight: 700; }

.feed { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.feed li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.feed-name { flex: 1; font-weight: 500; }
.feed-time { color: var(--muted); font-size: 12px; }
.badge.ok { color: var(--green); background: var(--green-bg); }
.badge.bad { color: var(--red); background: var(--red-bg); }

.rw-list { display: flex; flex-direction: column; gap: 10px; }
.rw { display: flex; align-items: center; gap: 12px; }
.rw-thumb {
  width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--accent-weak), var(--accent));
  color: #fff; font-weight: 700; font-size: 16px;
  display: flex; align-items: center; justify-content: center;
}
.rw-info { flex: 1; }
.rw-name { font-weight: 600; }
</style>
