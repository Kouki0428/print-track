<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  listWorks,
  listVideos,
  createVideo,
  deleteVideo,
  type Work,
  type Video,
} from '@/db/api'

const works = ref<Work[]>([])
const videos = ref<Video[]>([])
const showForm = ref(false)
const form = ref({ work_id: '', platform: 'B站', url: '', published_at: '', views: '', likes: '', comments: '' })

async function reload() {
  works.value = await listWorks()
  videos.value = await listVideos()
}
onMounted(reload)

const stats = computed(() => ({
  views: videos.value.reduce((s, v) => s + (v.views || 0), 0),
  likes: videos.value.reduce((s, v) => s + (v.likes || 0), 0),
  comments: videos.value.reduce((s, v) => s + (v.comments || 0), 0),
}))

function workName(id: number): string {
  return works.value.find((w) => w.id === id)?.name || `#${id}`
}

async function addVideo() {
  if (!form.value.work_id || !form.value.url) return
  await createVideo({
    work_id: Number(form.value.work_id),
    platform: form.value.platform,
    url: form.value.url,
    published_at: form.value.published_at || null,
    views: Number(form.value.views) || 0,
    likes: Number(form.value.likes) || 0,
    comments: Number(form.value.comments) || 0,
  })
  form.value = { work_id: '', platform: 'B站', url: '', published_at: '', views: '', likes: '', comments: '' }
  showForm.value = false
  await reload()
}

async function remove(id: number) {
  await deleteVideo(id)
  await reload()
}
</script>

<template>
  <div>
    <div class="page-head">
      <h2 class="page-title">视频统计</h2>
      <button class="btn" @click="showForm = true">+ 新增视频</button>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat-num">{{ stats.views }}</div><div class="stat-label">总播放</div></div>
      <div class="stat"><div class="stat-num">{{ stats.likes }}</div><div class="stat-label">总点赞</div></div>
      <div class="stat"><div class="stat-num">{{ stats.comments }}</div><div class="stat-label">总评论</div></div>
    </div>

    <div v-if="showForm" class="card form">
      <div class="row">
        <label>关联作品
          <select v-model="form.work_id">
            <option value="">选择作品</option>
            <option v-for="w in works" :key="w.id" :value="w.id">{{ w.name }}</option>
          </select>
        </label>
        <label>平台<input v-model="form.platform" /></label>
        <label>链接<input v-model="form.url" placeholder="https://" /></label>
        <label>发布日期<input v-model="form.published_at" type="date" /></label>
        <label>播放<input v-model="form.views" type="number" /></label>
        <label>点赞<input v-model="form.likes" type="number" /></label>
        <label>评论<input v-model="form.comments" type="number" /></label>
      </div>
      <div class="actions">
        <button class="btn" @click="addVideo">保存</button>
        <button class="btn ghost" @click="showForm = false">取消</button>
      </div>
    </div>

    <table class="tbl">
      <thead>
        <tr><th>作品</th><th>平台</th><th>日期</th><th>播放</th><th>点赞</th><th>评论</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="v in videos" :key="v.id">
          <td>{{ workName(v.work_id) }}</td>
          <td>{{ v.platform || '—' }}</td>
          <td>{{ v.published_at || '—' }}</td>
          <td>{{ v.views ?? 0 }}</td>
          <td>{{ v.likes ?? 0 }}</td>
          <td>{{ v.comments ?? 0 }}</td>
          <td>
            <a v-if="v.url" :href="v.url" target="_blank" class="link">打开</a>
            <button class="mini danger" @click="remove(v.id)">删除</button>
          </td>
        </tr>
        <tr v-if="!videos.length"><td colspan="7" class="empty">暂无视频，点击「新增视频」记录发布数据。</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; }
.stats { display: flex; gap: 14px; margin-bottom: 18px; }
.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; min-width: 110px; }
.stat-num { font-size: 22px; font-weight: 700; }
.stat-label { color: var(--muted); font-size: 12px; margin-top: 2px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.form .row { display: flex; gap: 14px; flex-wrap: wrap; }
.form label { display: flex; flex-direction: column; font-size: 12px; color: var(--muted); gap: 4px; }
.form input, .form select { padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
.actions { margin-top: 12px; display: flex; gap: 10px; }
.btn { padding: 8px 14px; border: none; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; font-size: 14px; }
.btn.ghost { background: #e9ebef; color: var(--text); }
.tbl { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.tbl th, .tbl td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--line); font-size: 14px; }
.tbl th { background: #f3f4f6; color: var(--muted); font-weight: 600; }
.link { color: var(--accent); text-decoration: none; margin-right: 8px; }
.mini { border: 1px solid var(--line); background: #fff; border-radius: 7px; padding: 5px 9px; font-size: 12px; cursor: pointer; }
.mini.danger { color: #d23f3f; border-color: #f0c5c5; }
.empty { color: var(--muted); text-align: center; padding: 18px; }
</style>
