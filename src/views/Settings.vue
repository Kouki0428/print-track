<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listWorks, listFilaments, listVideos, listSchedules, db } from '@/db/api'
import { theme, setTheme, type Theme } from '@/theme'

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

function openFolder() {
  ;(window as any).app?.openDataFolder?.()
}
</script>

<template>
  <div>
    <h1 class="page-title">设置</h1>

    <div class="card">
      <div class="sec-title">外观</div>
      <div class="row" style="justify-content:space-between">
        <span class="muted">主题</span>
        <div class="seg">
          <button :class="{ on: theme === 'light' }" @click="setTheme('light' as Theme)">浅色</button>
          <button :class="{ on: theme === 'dark' }" @click="setTheme('dark' as Theme)">深色</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">数据存储</div>
      <p class="line"><span class="k">存储方式</span><span>本地 SQLite（better-sqlite3）</span></p>
      <p class="line"><span class="k">数据库位置</span><span>应用用户数据目录下，自动管理、离线可用</span></p>
      <button class="btn ghost" style="margin-top:8px" @click="openFolder">打开数据目录</button>
    </div>

    <div class="card">
      <div class="sec-title">数据概览</div>
      <div class="grid">
        <div class="kv" v-for="(val, label) in { 作品: counts.works, '打印记录': counts.prints, 耗材: counts.filaments, 视频: counts.videos, 排期: counts.schedules }" :key="label">
          <b>{{ val }}</b><span>{{ label }}</span>
        </div>
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
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow-sm); }
.card + .card { margin-top: 16px; }
.sec-title { font-weight: 700; margin-bottom: 12px; font-size: 15px; }
.line { display: flex; gap: 12px; font-size: 14px; margin: 8px 0; }
.k { color: var(--muted); width: 120px; flex-shrink: 0; }
.grid { display: flex; gap: 14px; flex-wrap: wrap; }
.kv { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px 18px; min-width: 90px; text-align: center; }
.kv b { display: block; font-size: 22px; }
.kv span { font-size: 12px; color: var(--muted); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; }
.seg button { border: none; background: var(--panel); color: var(--text-2); padding: 7px 16px; font-size: 13px; cursor: pointer; }
.seg button.on { background: var(--accent); color: #fff; }
</style>
