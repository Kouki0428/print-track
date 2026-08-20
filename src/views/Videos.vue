<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  listWorks,
  listVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  type Work,
  type Video,
} from '@/db/api'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const works = ref<Work[]>([])
const videos = ref<Video[]>([])
const showModal = ref(false)
const editingId = ref<number | null>(null)
const platformFilter = ref<string>('all')
const form = ref({ work_id: '', platform: 'B站', url: '', published_at: '', views: '', likes: '', comments: '' })

async function reload() {
  works.value = await listWorks()
  videos.value = await listVideos()
}
onMounted(reload)

const platforms = computed(() => Array.from(new Set(videos.value.map((v) => v.platform || '未命名'))))

const stats = computed(() => ({
  views: videos.value.reduce((s, v) => s + (v.views || 0), 0),
  likes: videos.value.reduce((s, v) => s + (v.likes || 0), 0),
  comments: videos.value.reduce((s, v) => s + (v.comments || 0), 0),
}))

const filteredVideos = computed(() =>
  platformFilter.value === 'all' ? videos.value : videos.value.filter((v) => (v.platform || '未命名') === platformFilter.value),
)

// 按作品聚合
const byWork = computed(() => {
  const map = new Map<number, { name: string; views: number; likes: number; comments: number; count: number }>()
  for (const v of videos.value) {
    const cur = map.get(v.work_id) || { name: workName(v.work_id), views: 0, likes: 0, comments: 0, count: 0 }
    cur.views += v.views || 0
    cur.likes += v.likes || 0
    cur.comments += v.comments || 0
    cur.count += 1
    map.set(v.work_id, cur)
  }
  return Array.from(map.values()).sort((a, b) => b.views - a.views)
})

function workName(id: number): string {
  return works.value.find((w) => w.id === id)?.name || `#${id}`
}

function openCreate() {
  editingId.value = null
  form.value = { work_id: '', platform: 'B站', url: '', published_at: '', views: '', likes: '', comments: '' }
  showModal.value = true
}
function openEdit(v: Video) {
  editingId.value = v.id
  form.value = {
    work_id: String(v.work_id),
    platform: v.platform || 'B站',
    url: v.url || '',
    published_at: v.published_at || '',
    views: v.views != null ? String(v.views) : '',
    likes: v.likes != null ? String(v.likes) : '',
    comments: v.comments != null ? String(v.comments) : '',
  }
  showModal.value = true
}
async function submit() {
  if (!form.value.work_id || !form.value.url) return
  const payload = {
    work_id: Number(form.value.work_id),
    platform: form.value.platform,
    url: form.value.url,
    published_at: form.value.published_at || null,
    views: Number(form.value.views) || 0,
    likes: Number(form.value.likes) || 0,
    comments: Number(form.value.comments) || 0,
  }
  if (editingId.value != null) await updateVideo(editingId.value, payload)
  else await createVideo(payload)
  showModal.value = false
  await reload()
}
async function remove(v: Video) {
  if (!window.confirm('确定删除这条视频记录？')) return
  await deleteVideo(v.id)
  await reload()
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">视频统计</h1>
      <button class="btn" @click="openCreate">+ 新增视频</button>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="stat-value">{{ stats.views }}</div><div class="stat-label">总播放</div></div>
      <div class="stat"><div class="stat-value">{{ stats.likes }}</div><div class="stat-label">总点赞</div></div>
      <div class="stat"><div class="stat-value">{{ stats.comments }}</div><div class="stat-label">总评论</div></div>
    </div>

    <div v-if="byWork.length" class="card">
      <h2 class="section-title">按作品汇总</h2>
      <div class="agg">
        <div v-for="a in byWork" :key="a.name" class="agg-card">
          <div class="agg-name">{{ a.name }}</div>
          <div class="agg-row"><span>播放</span><b>{{ a.views }}</b></div>
          <div class="agg-row"><span>点赞</span><b>{{ a.likes }}</b></div>
          <div class="agg-row"><span>评论</span><b>{{ a.comments }}</b></div>
          <div class="agg-foot">{{ a.count }} 条视频</div>
        </div>
      </div>
    </div>

    <div v-if="videos.length" class="mt">
      <div class="toolbar">
        <div class="chips">
          <button class="chip" :class="{ on: platformFilter === 'all' }" @click="platformFilter = 'all'">全部</button>
          <button v-for="p in platforms" :key="p" class="chip" :class="{ on: platformFilter === p }" @click="platformFilter = p">{{ p }}</button>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr><th>作品</th><th>平台</th><th>日期</th><th>播放</th><th>点赞</th><th>评论</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="v in filteredVideos" :key="v.id">
            <td>{{ workName(v.work_id) }}</td>
            <td><span class="tag">{{ v.platform || '—' }}</span></td>
            <td class="mono">{{ v.published_at || '—' }}</td>
            <td>{{ v.views ?? 0 }}</td>
            <td>{{ v.likes ?? 0 }}</td>
            <td>{{ v.comments ?? 0 }}</td>
            <td class="ops">
              <a v-if="v.url" :href="v.url" target="_blank" class="mini">打开</a>
              <button class="mini" @click="openEdit(v)">编辑</button>
              <button class="mini danger" @click="remove(v)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState v-else emoji="📹" title="还没有视频数据" desc="记录各平台发布视频的播放与互动，自动按作品汇总。" />

    <BaseModal :open="showModal" :title="editingId != null ? '编辑视频' : '新增视频'" width="560px" @close="showModal = false">
      <div class="form-grid">
        <label class="field">关联作品
          <select v-model="form.work_id" class="select">
            <option value="">选择作品</option>
            <option v-for="w in works" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label class="field">平台
          <input v-model="form.platform" class="input" placeholder="B站 / 抖音 / YouTube" />
        </label>
        <label class="field">链接
          <input v-model="form.url" class="input" placeholder="https://" />
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
  </div>
</template>

<style scoped>
.mt { margin-top: 16px; }
.toolbar { margin-bottom: 12px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--panel); color: var(--text-2); font-size: 13px; cursor: pointer; transition: var(--transition); }
.chip:hover { background: var(--hover); }
.chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.agg { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.agg-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.agg-name { font-weight: 700; margin-bottom: 8px; }
.agg-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2); padding: 2px 0; }
.agg-row b { color: var(--text); }
.agg-foot { font-size: 12px; color: var(--muted); margin-top: 6px; }
.tag { font-size: 12px; color: var(--text-2); background: var(--gray-bg); padding: 2px 8px; border-radius: 6px; }
.mono { font-variant-numeric: tabular-nums; font-size: 13px; }
.ops { display: flex; gap: 6px; align-items: center; white-space: nowrap; }
.mini { border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px; padding: 4px 9px; font-size: 12px; cursor: pointer; transition: var(--transition); }
.mini:hover { background: var(--hover); }
.mini.danger { color: var(--red); border-color: var(--red-bg); }
.mini.danger:hover { background: var(--red-bg); }
</style>
