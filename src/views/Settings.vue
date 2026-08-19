<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  listWorks,
  listFilaments,
  listVideos,
  listSchedules,
  db,
} from '@/db/api'

const counts = ref({ works: 0, prints: 0, filaments: 0, videos: 0, schedules: 0 })

async function reload() {
  const w = await listWorks()
  const f = await listFilaments()
  const v = await listVideos()
  const s = await listSchedules()
  const p = await db.get<{ c: number }>('SELECT COUNT(*) AS c FROM print_jobs')
  counts.value = {
    works: w.length,
    prints: p?.c ?? 0,
    filaments: f.length,
    videos: v.length,
    schedules: s.length,
  }
}
onMounted(reload)
</script>

<template>
  <div>
    <h2 class="page-title">设置</h2>

    <div class="card">
      <div class="sec-title">数据存储</div>
      <p class="line"><span class="k">存储方式</span><span>本地 SQLite（better-sqlite3）</span></p>
      <p class="line"><span class="k">数据库位置</span><span>应用用户数据目录下的 print-track.db（自动管理，离线可用）</span></p>
    </div>

    <div class="card">
      <div class="sec-title">数据概览</div>
      <div class="grid">
        <div class="kv"><b>{{ counts.works }}</b><span>作品</span></div>
        <div class="kv"><b>{{ counts.prints }}</b><span>打印记录</span></div>
        <div class="kv"><b>{{ counts.filaments }}</b><span> 耗材</span></div>
        <div class="kv"><b>{{ counts.videos }}</b><span>视频</span></div>
        <div class="kv"><b>{{ counts.schedules }}</b><span>排期</span></div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">关于</div>
      <p class="line"><span class="k">应用</span><span>PrintTrack · 3D 打印进度管理与规划</span></p>
      <p class="line"><span class="k">技术栈</span><span>Electron + Vue3 + TypeScript + Vite + Pinia</span></p>
    </div>
  </div>
</template>

<style scoped>
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.sec-title { font-weight: 700; margin-bottom: 10px; }
.line { display: flex; gap: 12px; font-size: 14px; margin: 6px 0; }
.k { color: var(--muted); width: 120px; flex-shrink: 0; }
.grid { display: flex; gap: 14px; flex-wrap: wrap; }
.kv { background: #f6f7f9; border-radius: 10px; padding: 12px 16px; min-width: 90px; text-align: center; }
.kv b { display: block; font-size: 20px; }
.kv span { font-size: 12px; color: var(--muted); }
</style>
