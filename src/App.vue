<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { onMounted } from 'vue'
import { useWorksStore } from '@/stores/works'

const route = useRoute()
const works = useWorksStore()

onMounted(() => works.fetchAll())

const nav = [
  { to: '/dashboard', label: '仪表盘', icon: '◧' },
  { to: '/library', label: '作品库', icon: '▦' },
  { to: '/board', label: '进度板', icon: '▤' },
  { to: '/timeline', label: '时间线', icon: '☰' },
  { to: '/filaments', label: '耗材', icon: '◍' },
  { to: '/videos', label: '视频统计', icon: '▶' },
  { to: '/settings', label: '设置', icon: '⚙' },
]
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">PrintTrack</div>
      <nav>
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path.startsWith(item.to) }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  --bg: #f6f7f9;
  --panel: #ffffff;
  --line: #e6e8eb;
  --text: #1f2329;
  --muted: #8a9099;
  --accent: #2f6fed;
}
* { box-sizing: border-box; }
html, body, #app { height: 100%; margin: 0; }
body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--text); background: var(--bg); }

.app-shell { display: flex; height: 100vh; }
.sidebar {
  width: 190px; flex-shrink: 0; background: var(--panel);
  border-right: 1px solid var(--line); padding: 16px 10px; display: flex; flex-direction: column;
}
.brand { font-weight: 700; font-size: 18px; padding: 8px 10px 18px; color: var(--accent); }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px;
  color: var(--text); text-decoration: none; font-size: 14px; margin-bottom: 2px;
}
.nav-item:hover { background: #f0f2f5; }
.nav-item.active { background: #e8f0fe; color: var(--accent); font-weight: 600; }
.nav-icon { width: 18px; text-align: center; }
.content { flex: 1; overflow: auto; padding: 22px 26px; }
.page-title { font-size: 20px; font-weight: 700; margin: 0 0 16px; }
</style>
