<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import {
  listWorks,
  listVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  fetchVideoStats,
  refreshAllVideos,
  type Work,
  type Video,
} from '@/db/api'
import { useUiStore } from '@/stores/ui'
import { useToast } from '@/stores/toast'
import { useCountUp } from '@/composables/useCountUp'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const ui = useUiStore()
const toast = useToast()
const works = ref<Work[]>([])
const videos = ref<Video[]>([])
const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ work_id: '', url: '', published_at: '', views: '', likes: '', comments: '' })

const fetchingId = ref<number | null>(null)
const fetchingForm = ref(false)
const refreshingAll = ref(false)
const fetchProgress = ref<{ done: number; total: number } | null>(null)
const lastRefresh = ref<string>('')
// 可见的抓取状态（成功/失败原因），避免自动抓取静默吞错、手动抓取只弹一次 alert
const fetchStatus = ref<{ kind: 'ok' | 'err' | 'idle'; text: string }>({ kind: 'idle', text: '' })
let statusTimer: ReturnType<typeof setTimeout> | null = null
function setStatus(kind: 'ok' | 'err' | 'idle', text = '') {
  fetchStatus.value = { kind, text }
  if (statusTimer) {
    clearTimeout(statusTimer)
    statusTimer = null
  }
  // 成功提示 6s 后自动收起；失败保留给用户查看原因
  if (kind === 'ok') statusTimer = setTimeout(() => setStatus('idle'), 6000)
}

async function reload() {
  works.value = await listWorks()
  videos.value = await listVideos()
}
onMounted(reload)

// 仅显示当前类型过滤下的作品关联视频
const scopedWorks = computed(() =>
  works.value.filter((w) => ui.typeFilter === 'all' || w.type === ui.typeFilter),
)
const scopedVideos = computed(() =>
  videos.value.filter((v) => scopedWorks.value.some((w) => w.id === v.work_id)),
)

const stats = computed(() => ({
  views: scopedVideos.value.reduce((s, v) => s + (v.views || 0), 0),
  likes: scopedVideos.value.reduce((s, v) => s + (v.likes || 0), 0),
  comments: scopedVideos.value.reduce((s, v) => s + (v.comments || 0), 0),
}))

// 数字滚动
const cViews = useCountUp(() => stats.value.views)
const cLikes = useCountUp(() => stats.value.likes)
const cComments = useCountUp(() => stats.value.comments)
function fmt(n: number): string {
  return n.toLocaleString()
}

// 按作品聚合
const byWork = computed(() => {
  const map = new Map<number, { name: string; views: number; likes: number; comments: number; count: number; last: string | null }>()
  for (const v of scopedVideos.value) {
    const cur = map.get(v.work_id) || { name: workName(v.work_id), views: 0, likes: 0, comments: 0, count: 0, last: null }
    cur.views += v.views || 0
    cur.likes += v.likes || 0
    cur.comments += v.comments || 0
    cur.count += 1
    cur.last = v.last_fetched && (!cur.last || v.last_fetched > cur.last) ? v.last_fetched : cur.last
    map.set(v.work_id, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.views - a.views)
})

// ---- 表格点列排序（播放/点赞/评论，点击切换升/降序）----
type NumKey = 'views' | 'likes' | 'comments'
const sortKey = ref<NumKey | null>(null)
const sortDir = ref<1 | -1>(-1)
function setSort(k: NumKey) {
  if (sortKey.value === k) sortDir.value = (sortDir.value * -1) as 1 | -1
  else {
    sortKey.value = k
    sortDir.value = -1
  }
}
const displayVideos = computed(() => {
  if (!sortKey.value) return scopedVideos.value
  const k = sortKey.value
  return [...scopedVideos.value].sort((a, b) => ((a[k] ?? 0) - (b[k] ?? 0)) * sortDir.value)
})

function workName(id: number): string {
  return works.value.find((w) => w.id === id)?.name || `#${id}`
}

// 手动抓取单条（全量刷新进行中时禁止重复触发）
async function refreshOne(v: Video) {
  if (!v.url || refreshingAll.value) return
  fetchingId.value = v.id
  try {
    const s = await fetchVideoStats(v.url)
    await updateVideo(v.id, {
      platform: 'bilibili',
      views: s.views,
      likes: s.likes,
      comments: s.comments,
      published_at: s.published_at || v.published_at,
      url: v.url,
      last_fetched: new Date().toISOString(),
    })
    setStatus('ok', `已更新《${s.title || v.url}》：播放 ${s.views} · 点赞 ${s.likes} · 评论 ${s.comments}`)
    await reload()
  } catch (e: any) {
    setStatus('err', '抓取失败：' + (e?.message || e))
  } finally {
    fetchingId.value = null
  }
}

// 弹窗内：粘贴 B 站链接自动识别并填充
async function fetchIntoForm() {
  if (!form.value.url.trim()) return
  fetchingForm.value = true
  try {
    const s = await fetchVideoStats(form.value.url.trim())
    form.value.views = String(s.views)
    form.value.likes = String(s.likes)
    form.value.comments = String(s.comments)
    if (s.published_at) form.value.published_at = s.published_at
    setStatus('ok', `识别成功《${s.title || ''}》：播放 ${s.views} · 点赞 ${s.likes} · 评论 ${s.comments}`)
  } catch (e: any) {
    setStatus('err', '抓取失败：' + (e?.message || e))
  } finally {
    fetchingForm.value = false
  }
}

// 手动触发「每日自动抓取」全量刷新（带进度）
async function refreshAll() {
  refreshingAll.value = true
  fetchProgress.value = { done: 0, total: 0 }
  try {
    const n = await refreshAllVideos((done, total) => {
      fetchProgress.value = { done, total }
    })
    lastRefresh.value = `${new Date().toLocaleString('zh-CN')}（更新 ${n} 条）`
    setStatus(n > 0 ? 'ok' : 'ok', n > 0 ? `已刷新 ${n} 条视频数据` : '没有需要更新的视频（或链接全部抓取失败，见下方状态）')
    await reload()
  } catch (e: any) {
    setStatus('err', '刷新失败：' + (e?.message || e))
  } finally {
    refreshingAll.value = false
    fetchProgress.value = null
  }
}

function openCreate() {
  editingId.value = null
  form.value = { work_id: '', url: '', published_at: '', views: '', likes: '', comments: '' }
  showModal.value = true
}

// 快捷键 N：打开新增视频弹窗（App 层广播）
watch(
  () => ui.newSignal,
  () => {
    if (!showModal.value) openCreate()
  },
)
function openEdit(v: Video) {
  editingId.value = v.id
  form.value = {
    work_id: String(v.work_id),
    url: v.url || '',
    published_at: v.published_at || '',
    views: v.views != null ? String(v.views) : '',
    likes: v.likes != null ? String(v.likes) : '',
    comments: v.comments != null ? String(v.comments) : '',
  }
  showModal.value = true
}
// 表单内按 Enter 直接保存（仅对输入框生效）
function onFormEnter(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t.tagName === 'INPUT') {
    e.preventDefault()
    submit()
  }
}

async function submit() {
  if (!form.value.work_id || !form.value.url) {
    toast.error('请选择关联作品并填写 B 站链接')
    return
  }
  const payload = {
    work_id: Number(form.value.work_id),
    url: form.value.url,
    published_at: form.value.published_at || null,
    views: Number(form.value.views) || 0,
    likes: Number(form.value.likes) || 0,
    comments: Number(form.value.comments) || 0,
  }
  const editId = editingId.value
  const isEdit = editId != null
  if (isEdit) await updateVideo(editId, payload)
  else await createVideo(payload)
  showModal.value = false
  await reload()
  toast.success(isEdit ? '视频已更新' : '视频已添加')
}

// 删除：自定义确认弹窗（替代 window.confirm）
const confirmRemove = ref(false)
const removeTarget = ref<Video | null>(null)
function askRemove(v: Video) {
  removeTarget.value = v
  confirmRemove.value = true
}
async function doRemove() {
  const v = removeTarget.value
  if (!v) return
  confirmRemove.value = false
  removeTarget.value = null
  await deleteVideo(v.id)
  await reload()
  toast.success('视频记录已删除')
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">视频统计</h1>
        <p class="subtitle">仅支持哔哩哔哩 · 粘贴视频链接一键抓取播放·点赞·评论</p>
      </div>
      <button class="btn" @click="openCreate">+ 新增视频</button>
    </div>

    <div class="auto-bar card">
      <div class="auto-info">
        <div class="auto-title">每日自动抓取</div>
        <div class="auto-sub">
          应用启动与每 24 小时自动刷新所有 B 站视频数据；无需手动维护播放/点赞/评论。
        </div>
      </div>
      <button class="btn ghost" :disabled="refreshingAll" @click="refreshAll">
        <span v-if="refreshingAll" class="spinner"></span>
        <span v-else>↻</span>
        {{ refreshingAll
          ? `抓取中 ${fetchProgress?.total ? `${fetchProgress.done}/${fetchProgress.total}` : '…'}`
          : '立即抓取全部' }}
      </button>
    </div>
    <div v-if="lastRefresh" class="last-refresh">上次手动刷新：{{ lastRefresh }}</div>
    <div v-if="fetchStatus.kind !== 'idle'" class="fetch-status" :class="fetchStatus.kind">
      <span class="fs-dot"></span>
      <span>{{ fetchStatus.text }}</span>
      <button class="fs-close" @click="setStatus('idle')">×</button>
    </div>
    <p class="hint">提示：应用启动与每 24 小时会自动抓取；若自动抓取无数据，请点「↻ 立即抓取全部」或单条「↻ 抓取」，下方状态条会显示真实失败原因（如 B 站返回 -412 拦截，多为网络/地区限制）。</p>

    <div class="stat-grid stagger">
      <div class="stat"><div class="stat-value">{{ fmt(cViews) }}</div><div class="stat-label">总播放</div></div>
      <div class="stat"><div class="stat-value">{{ fmt(cLikes) }}</div><div class="stat-label">总点赞</div></div>
      <div class="stat"><div class="stat-value">{{ fmt(cComments) }}</div><div class="stat-label">总评论</div></div>
    </div>

    <div v-if="byWork.length" class="card">
      <h2 class="section-title">按作品汇总</h2>
      <div class="agg stagger">
        <div v-for="a in byWork" :key="a.name" class="agg-card">
          <div class="agg-name">{{ a.name }}</div>
          <div class="agg-row"><span>播放</span><b>{{ a.views }}</b></div>
          <div class="agg-row"><span>点赞</span><b>{{ a.likes }}</b></div>
          <div class="agg-row"><span>评论</span><b>{{ a.comments }}</b></div>
          <div class="agg-foot">{{ a.count }} 条视频 · <span v-if="a.last" class="fetched">已抓取</span><span v-else>未抓取</span></div>
        </div>
      </div>
    </div>

    <div v-if="scopedVideos.length" class="mt">
      <table class="table">
        <thead>
          <tr>
            <th>作品</th>
            <th>平台</th>
            <th>日期</th>
            <th class="th-sort" @click="setSort('views')">播放 <span class="arrow" :class="{ on: sortKey === 'views' }">{{ sortKey === 'views' && sortDir === 1 ? '▴' : '▾' }}</span></th>
            <th class="th-sort" @click="setSort('likes')">点赞 <span class="arrow" :class="{ on: sortKey === 'likes' }">{{ sortKey === 'likes' && sortDir === 1 ? '▴' : '▾' }}</span></th>
            <th class="th-sort" @click="setSort('comments')">评论 <span class="arrow" :class="{ on: sortKey === 'comments' }">{{ sortKey === 'comments' && sortDir === 1 ? '▴' : '▾' }}</span></th>
            <th>抓取</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in displayVideos" :key="v.id">
            <td>{{ workName(v.work_id) }}</td>
            <td><span class="tag">B站</span></td>
            <td class="mono">{{ v.published_at || '—' }}</td>
            <td>{{ v.views ?? 0 }}</td>
            <td>{{ v.likes ?? 0 }}</td>
            <td>{{ v.comments ?? 0 }}</td>
            <td class="mono fetched">{{ (v.last_fetched || '—').slice(0, 10) }}</td>
            <td class="ops">
              <button class="mini" :disabled="fetchingId === v.id" @click="refreshOne(v)">
                <span v-if="fetchingId === v.id" class="spinner"></span>
                <span v-else>↻ 抓取</span>
              </button>
              <a v-if="v.url" :href="v.url" target="_blank" class="mini">打开</a>
              <button class="mini" @click="openEdit(v)">编辑</button>
              <button class="mini danger" @click="askRemove(v)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-else emoji="📹" title="还没有视频数据" desc="记录发布的 B 站视频，自动按作品汇总并每日抓取最新数据。" />

    <BaseModal :open="showModal" :title="editingId != null ? '编辑视频' : '新增视频'" width="560px" @close="showModal = false">
      <div class="form-grid" @keydown.enter="onFormEnter">
        <label class="field">关联作品
          <select v-model="form.work_id" class="select">
            <option value="">选择作品</option>
            <option v-for="w in scopedWorks" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label class="field url-field">B站链接
          <div class="url-row">
            <input v-model="form.url" class="input" placeholder="https://www.bilibili.com/video/BV…" />
            <button class="btn sm" :disabled="fetchingForm || !form.url" @click="fetchIntoForm">
              <span v-if="fetchingForm" class="spinner spinner-light"></span>
              {{ fetchingForm ? '抓取中…' : '抓取并填充' }}
            </button>
          </div>
        </label>
        <label class="field">发布日期
          <input v-model="form.published_at" class="input" type="date" />
        </label>
        <label class="field">播放
          <input v-model="form.views" class="input" type="number" />
        </label>
        <label class="field">点赞
          <input v-model="form.likes" class="input" type="number" />
        </label>
        <label class="field">评论
          <input v-model="form.comments" class="input" type="number" />
        </label>
      </div>
      <template #footer>
        <button class="btn ghost" @click="showModal = false">取消</button>
        <button class="btn" @click="submit">保存</button>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="confirmRemove"
      danger
      title="删除视频记录"
      message="确定删除这条视频记录？删除后需重新添加才会恢复统计。"
      confirm-text="删除"
      @cancel="confirmRemove = false"
      @confirm="doRemove"
    />
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.auto-bar { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 8px; flex-wrap: wrap; }
.auto-title { font-weight: 700; font-size: 14px; }
.auto-sub { font-size: 12px; color: var(--muted); margin-top: 3px; max-width: 420px; }
.last-refresh { font-size: 12px; color: var(--muted); margin: 0 0 16px; }
.fetch-status { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; border: 1px solid; }
.fetch-status.ok { background: var(--green-bg); border-color: var(--green); color: var(--green); }
.fetch-status.err { background: var(--red-bg); border-color: var(--red); color: var(--red); }
.fs-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.fs-close { margin-left: auto; background: transparent; border: none; color: inherit; font-size: 16px; cursor: pointer; line-height: 1; opacity: 0.7; }
.fs-close:hover { opacity: 1; }
.hint { font-size: 12px; color: var(--muted); line-height: 1.6; margin: 0 0 16px; }
.mt { margin-top: 16px; }
.tag { font-size: 12px; color: var(--text-2); background: var(--gray-bg); padding: 2px 8px; border-radius: 6px; }
.fetched { color: var(--green); }
.agg { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.agg-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.agg-name { font-weight: 700; margin-bottom: 8px; }
.agg-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2); padding: 2px 0; }
.agg-row b { color: var(--text); }
.agg-foot { font-size: 12px; color: var(--muted); margin-top: 6px; }
.mono { font-variant-numeric: tabular-nums; font-size: 13px; }
.th-sort { cursor: pointer; user-select: none; white-space: nowrap; }
.th-sort:hover { color: var(--accent); }
.th-sort .arrow { opacity: 0.35; font-size: 11px; }
.th-sort .arrow.on { opacity: 1; color: var(--accent); }
.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--line-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  display: inline-block;
  vertical-align: -2px;
  animation: spin 0.7s linear infinite;
}
.spinner-light { border-color: rgba(255, 255, 255, 0.4); border-top-color: #fff; }
.ops { display: flex; gap: 6px; align-items: center; white-space: nowrap; }
.mini { border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px; padding: 4px 9px; font-size: 12px; cursor: pointer; transition: var(--transition); }
.mini:hover { background: var(--hover); }
.mini:disabled { opacity: 0.6; cursor: default; }
.mini.danger { color: var(--red); border-color: var(--red-bg); }
.mini.danger:hover { background: var(--red-bg); }
.url-row { display: flex; gap: 8px; }
.url-row .input { flex: 1; }
</style>
