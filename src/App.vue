<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { onMounted, computed } from 'vue'
import { useWorksStore } from '@/stores/works'
import { useUiStore } from '@/stores/ui'
import { WORK_TYPE_LABELS, type WorkType } from '@/db/api'
import { theme, toggleTheme } from '@/theme'

const route = useRoute()
const works = useWorksStore()
const ui = useUiStore()
onMounted(() => works.fetchAll())

const isDark = computed(() => theme.value === 'dark')

const nav = [
  { to: '/dashboard', label: '仪表盘', icon: 'grid' },
  { to: '/library', label: '作品库', icon: 'layers' },
  { to: '/board', label: '进度板', icon: 'kanban' },
  { to: '/timeline', label: '时间线', icon: 'calendar' },
  { to: '/videos', label: '视频统计', icon: 'play' },
  { to: '/settings', label: '设置', icon: 'gear' },
]

const typeOptions: (WorkType | 'all')[] = ['all', 'print', 'model', 'game']

// Lucide 风格描边图标（currentColor）
const icons: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  play: '<path d="m6 4 14 8-14 8V4Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 2.6 14H2.5a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 2.6V2.5a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21.4 10h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
}
function iconSvg(name: string): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`
}
// 类型小图标（用于段控按钮）
const typeIcon: Record<WorkType | 'all', string> = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/>',
  model: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  game: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M7 12h2M8 11v2M16 12h.01M18 14h.01"/>',
}
function typeSvg(t: WorkType | 'all'): string {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${typeIcon[t]}</svg>`
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="logo">⬢</span>
        <span class="brand-name">PrintTrack</span>
      </div>

      <!-- 项目类型统一切换 -->
      <div class="type-switch">
        <div class="type-switch-title">项目管理</div>
        <button
          v-for="t in typeOptions"
          :key="t"
          class="type-btn"
          :class="{ on: ui.typeFilter === t }"
          @click="ui.setTypeFilter(t)"
        >
          <span v-html="typeSvg(t)"></span>
          <span>{{ t === 'all' ? '全部项目' : WORK_TYPE_LABELS[t] }}</span>
        </button>
      </div>

      <nav class="nav">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path.startsWith(item.to) }"
        >
          <span class="nav-icon" v-html="iconSvg(item.icon)"></span>
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-foot">
        <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换到浅色' : '切换到深色'">
          <span v-html="isDark
            ? '<svg viewBox=\'0 0 24 24\' width=\'16\' height=\'16\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'12\' cy=\'12\' r=\'4\'/><path d=\'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\'/></svg>'
            : '<svg viewBox=\'0 0 24 24\' width=\'16\' height=\'16\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z\'/></svg>'"></span>
          <span>{{ isDark ? '浅色' : '深色' }}</span>
        </button>
      </div>
    </aside>
    <main class="content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.app-shell { display: flex; height: 100vh; }
.sidebar {
  width: 210px;
  flex-shrink: 0;
  background: var(--panel);
  border-right: 1px solid var(--line);
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
}
.brand { display: flex; align-items: center; gap: 9px; padding: 6px 10px 14px; }
.logo {
  font-size: 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--accent), #7aa2ff);
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 9px;
  box-shadow: var(--shadow-sm);
}
.brand-name { font-weight: 800; font-size: 17px; letter-spacing: -0.3px; }

.type-switch { padding: 6px 4px 14px; border-bottom: 1px solid var(--line); margin-bottom: 12px; }
.type-switch-title { font-size: 11px; color: var(--muted); letter-spacing: 0.4px; text-transform: uppercase; padding: 0 8px 8px; }
.type-btn {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 7px 10px; border: 1px solid transparent; border-radius: 9px;
  background: transparent; color: var(--text-2); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: var(--transition); text-align: left;
}
.type-btn:hover { background: var(--hover); color: var(--text); }
.type-btn.on { background: var(--accent-weak); color: var(--accent); font-weight: 600; border-color: transparent; }
.type-btn.on svg { color: var(--accent); }
.type-btn svg { opacity: 0.9; }

.nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border-radius: 10px;
  color: var(--text-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  transition: var(--transition);
}
.nav-item:hover { background: var(--hover); color: var(--text); }
.nav-item.active {
  background: var(--accent-weak);
  color: var(--accent);
  font-weight: 600;
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: -12px; top: 8px; bottom: 8px;
  width: 3px; border-radius: 0 3px 3px 0;
  background: var(--accent);
}
.nav-icon { display: inline-flex; opacity: 0.9; }
.sidebar-foot { padding-top: 12px; border-top: 1px solid var(--line); }
.theme-toggle {
  width: 100%;
  display: flex; align-items: center; gap: 9px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: var(--transition);
}
.theme-toggle:hover { background: var(--hover); color: var(--text); }

.content { flex: 1; overflow: auto; padding: 24px 28px; }

.page-enter-active, .page-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.page-enter-from { opacity: 0; transform: translateY(6px); }
.page-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
