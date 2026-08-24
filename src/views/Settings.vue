<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listWorks, listVideos, listSchedules, db, typeLabel, KNOWN_TYPES, STATUS_LABELS } from '@/db/api'
import { themePref, setThemePref, type ThemePref } from '@/theme'
import { useToast } from '@/stores/toast'

const toast = useToast()
const counts = ref({ works: 0, prints: 0, videos: 0, schedules: 0, byType: {} as Record<string, number> })
const backingUp = ref(false)

async function reload() {
  const w = await listWorks()
  const v = await listVideos()
  const s = await listSchedules()
  const p = await db.get<{ c: number }>('SELECT COUNT(*) AS c FROM print_jobs')
  const byType: Record<string, number> = {}
  for (const t of KNOWN_TYPES as readonly string[]) {
    byType[t] = w.filter((x) => x.type === t).length
  }
  counts.value = {
    works: w.length,
    prints: p?.c ?? 0,
    videos: v.length,
    schedules: s.length,
    byType,
  }
}
onMounted(reload)

function openFolder() {
  ;(window as any).app?.openDataFolder?.()
}

// 备份数据库文件到用户选择的位置
async function backupDb() {
  backingUp.value = true
  try {
    const r = await (window as any).app?.backupDatabase?.()
    if (r?.ok) toast.success(`已备份到：${r.path}`)
  } catch (e: any) {
    toast.error('备份失败：' + (e?.message || e))
  } finally {
    backingUp.value = false
  }
}

// 导出项目清单 CSV（含 BOM，Excel 直接打开中文不乱码）
const exporting = ref(false)
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
async function exportCsv() {
  exporting.value = true
  try {
    const ws = await listWorks()
    const header = [
      '名称', '类型', '状态', '软件', '源文件路径', '耗材颜色',
      '重量(g)', '打印时长(h)', '售卖', '价格(¥)', '创建时间', '更新时间',
    ]
    const rows = ws.map((w) =>
      [
        w.name,
        typeLabel(w.type),
        STATUS_LABELS[w.status],
        w.design_app ?? '',
        w.source_path ?? '',
        (w.material_colors ?? []).join(' '),
        w.material_weight ?? '',
        w.print_hours ?? '',
        w.for_sale ? '是' : '否',
        w.sale_price ?? '',
        (w.created_at || '').slice(0, 19),
        (w.updated_at || '').slice(0, 19),
      ]
        .map(csvCell)
        .join(','),
    )
    const csv = [header.join(','), ...rows].join('\r\n')
    const r = await (window as any).app?.exportCsv?.(
      `print-track-项目-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    )
    if (r?.ok) toast.success('已导出到：' + r.path)
  } catch (e: any) {
    toast.error('导出失败：' + (e?.message || e))
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="page-title">设置</h1>

    <div class="stagger">
    <div class="card">
      <div class="sec-title">外观</div>
      <div class="row" style="justify-content:space-between">
        <span class="muted">主题</span>
        <div class="seg">
          <button :class="{ on: themePref === 'light' }" @click="setThemePref('light' as ThemePref)">浅色</button>
          <button :class="{ on: themePref === 'dark' }" @click="setThemePref('dark' as ThemePref)">深色</button>
          <button :class="{ on: themePref === 'system' }" @click="setThemePref('system' as ThemePref)">跟随系统</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">数据存储</div>
      <p class="line"><span class="k">存储方式</span><span>本地 SQLite（better-sqlite3）</span></p>
      <p class="line"><span class="k">数据库位置</span><span>应用用户数据目录下，自动管理、离线可用</span></p>
      <div class="row" style="margin-top:8px">
        <button class="btn ghost" @click="openFolder">打开数据目录</button>
        <button class="btn ghost" :disabled="backingUp" @click="backupDb">{{ backingUp ? '备份中…' : '备份数据库' }}</button>
        <button class="btn ghost" :disabled="exporting" @click="exportCsv">{{ exporting ? '导出中…' : '导出项目 CSV' }}</button>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">数据概览</div>
      <div class="grid">
        <div class="kv" v-for="(val, label) in { 项目: counts.works, '打印记录': counts.prints, 视频: counts.videos, 排期: counts.schedules }" :key="label">
          <b>{{ val }}</b><span>{{ label }}</span>
        </div>
      </div>
      <div class="type-breakdown">
        <span class="tb-label">类型分布</span>
        <span class="tb-chip" v-for="(val, key) in counts.byType" :key="key">{{ typeLabel(key) }} · {{ val }}</span>
      </div>
    </div>

    <div class="card">
      <div class="sec-title">视频抓取</div>
      <p class="line"><span class="k">支持平台</span><span>仅哔哩哔哩（粘贴视频链接自动识别 BV 号）</span></p>
      <p class="line"><span class="k">抓取方式</span><span>应用启动与每 24 小时自动刷新全部视频的播放 / 点赞 / 评论，无需手动维护</span></p>
      <p class="line"><span class="k">手动刷新</span><span>在「视频统计」页点击「立即抓取全部」可随时更新</span></p>
    </div>

    <div class="card">
      <div class="sec-title">耗材与视频关联</div>
      <p class="line"><span class="k">耗材关联</span><span>3D 打印项目的耗材以「项目内调色盘」方式关联线材颜色，无需独立耗材库</span></p>
      <p class="line"><span class="k">视频关联</span><span>视频直接内嵌于对应项目（作品库详情 / 视频统计页），按作品自动汇总</span></p>
    </div>

    <div class="card">
      <div class="sec-title">关于</div>
      <p class="line"><span class="k">应用</span><span>PrintTrack · 3D 打印进度管理与规划</span></p>
      <p class="line"><span class="k">技术栈</span><span>Electron + Vue3 + TypeScript + Vite + Pinia</span></p>
    </div>
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
.kv { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px 18px; min-width: 90px; text-align: center; transition: var(--transition); }
.kv:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--accent); }
.kv b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.kv span { font-size: 12px; color: var(--muted); }
.type-breakdown { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.tb-label { font-size: 12px; color: var(--muted); }
.tb-chip { font-size: 12px; color: var(--accent); background: var(--accent-weak); padding: 3px 10px; border-radius: 999px; font-weight: 600; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; }
.seg button { border: none; background: var(--panel); color: var(--text-2); padding: 7px 16px; font-size: 13px; cursor: pointer; transition: var(--transition); }
.seg button:hover { color: var(--text); background: var(--hover); }
.seg button.on { background: var(--accent); color: #fff; }
</style>
