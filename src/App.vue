<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import { useWorksStore } from '@/stores/works'
import { useUiStore } from '@/stores/ui'
import { typeLabel } from '@/db/api'
import { theme, toggleTheme } from '@/theme'
import ToastHost from '@/components/ToastHost.vue'
import QuickSearch from '@/components/QuickSearch.vue'

const route = useRoute()
const router = useRouter()
const works = useWorksStore()
const ui = useUiStore()
onMounted(() => works.fetchAll())

const isDark = computed(() => theme.value === 'dark')

// 窗口标题跟随当前页面
const pageTitle: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/library': '作品库',
  '/board': '进度板',
  '/timeline': '时间线',
  '/videos': '视频统计',
  '/settings': '设置',
}
watch(
  () => route.path,
  (p) => {
    const key = Object.keys(pageTitle).find((k) => p.startsWith(k))
    document.title = key ? `${pageTitle[key]} · PrintTrack` : 'PrintTrack'
  },
  { immediate: true },
)

const appVersion = __APP_VERSION__

const nav = [
  { to: '/dashboard', label: '仪表盘', icon: 'grid' },
  { to: '/library', label: '作品库', icon: 'layers' },
  { to: '/board', label: '进度板', icon: 'kanban' },
  { to: '/timeline', label: '时间线', icon: 'calendar' },
  { to: '/videos', label: '视频统计', icon: 'play' },
]

// ---- 全局快捷键：1-5 切换页面、N 新建（输入框/弹窗打开时忽略）----
const shortcutPaths = ['/dashboard', '/library', '/board', '/timeline', '/videos']
function onGlobalKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
  if (document.querySelector('.overlay')) return
  const idx = ['1', '2', '3', '4', '5'].indexOf(e.key)
  if (idx >= 0 && route.path !== shortcutPaths[idx]) router.push(shortcutPaths[idx])
  if (e.key.toLowerCase() === 'n') ui.newSignal++
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))

// 滑动高亮指示条：当前激活项索引（含末尾的设置齿轮）
const navOrder = [...nav.map((n) => n.to), '/settings']
const activeIdx = computed(() => {
  const i = navOrder.findIndex((p) => route.path.startsWith(p))
  return i < 0 ? 0 : i
})

// 作品库导航项附带项目总数徽标
const navItems = computed(() =>
  nav.map((n) => ({
    ...n,
    count: n.to === '/library' ? works.totalCount : null,
  })),
)

// 侧边栏类型段控：固定 4 项；自定义类型统一归入「其它」，不单独建按钮
const typeOptions = ['all', 'print', 'model', 'other']

function typeName(t: string): string {
  return t === 'all' ? '全部项目' : typeLabel(t)
}

// Lucide 风格描边图标（currentColor）
const icons: Record<string, string> = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/>',
  kanban: '<g transform="rotate(-90 12 12)"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/></g>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  play: '<path d="m6 4 14 8-14 8V4Z"/>',
}
function iconSvg(name: string): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`
}
// 类型小图标（用于段控按钮）
const typeIcon: Record<string, string> = {
  all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/>',
  model: '<path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  other: '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
}
function typeSvg(t: string): string {
  return `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${typeIcon[t] || typeIcon.other}</svg>`
}

// ---- 设置齿轮动画（参考 acgn-records 的 6 齿齿轮 + 旋转动画）----
// 6 齿齿轮（描边风格）：以 (12,12) 为中心，齿根 r=6.5 / 齿顶 r=9，严格同心
const gearIcon =
  'M 17.63 8.75 20.8 10.13 20.8 13.87 17.63 15.25 18.02 18.69 14.78 20.56 12.0 18.5 9.22 20.56 5.98 18.69 6.37 15.25 3.2 13.87 3.2 10.13 6.37 8.75 5.98 5.31 9.22 3.44 12.0 5.5 14.78 3.44 18.02 5.31 Z'
const isSpinning = ref(false)
const isPressed = ref(false)
function press() {
  isPressed.value = true
}
function release() {
  isPressed.value = false
}
function spinGear() {
  isPressed.value = false
  isSpinning.value = false
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      isSpinning.value = true
    })
  })
}
function onSpinEnd() {
  isSpinning.value = false
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="logo">⬢</span>
        <span class="brand-name">PrintTrack</span>
      </div>

      <!-- 项目类型统一切换（自定义类型归入「其它」） -->
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
          <span>{{ typeName(t) }}</span>
        </button>
      </div>

      <nav class="nav">
        <div class="nav-indicator" :style="{ top: activeIdx * 40 + 'px' }"></div>
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path.startsWith(item.to) }"
        >
          <span class="nav-icon" v-html="iconSvg(item.icon)"></span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.count != null" class="nav-count">{{ item.count }}</span>
        </RouterLink>
        <!-- 设置入口：6 齿齿轮，点击旋转 -->
        <RouterLink
          to="/settings"
          class="nav-item settings-gear"
          :class="{ active: route.path.startsWith('/settings'), spinning: isSpinning, pressed: isPressed }"
          @mousedown="press"
          @mouseup="release"
          @mouseleave="release"
          @click="spinGear"
        >
          <span class="nav-icon gear" @animationend="onSpinEnd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path :d="gearIcon" />
            </svg>
          </span>
          <span class="nav-label">设置</span>
        </RouterLink>
      </nav>
      <div class="sidebar-foot">
        <div class="kbd-hints"><kbd>Ctrl</kbd>+<kbd>K</kbd> 搜索 · <kbd>N</kbd> 新建 · <kbd>1</kbd>–<kbd>5</kbd> 切页</div>
        <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换到浅色' : '切换到深色'">
          <span v-html="isDark
            ? '<svg viewBox=\'0 0 24 24\' width=\'16\' height=\'16\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'12\' cy=\'12\' r=\'4\'/><path d=\'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\'/></svg>'
            : '<svg viewBox=\'0 0 24 24\' width=\'16\' height=\'16\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><path d=\'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z\'/></svg>'"></span>
          <span>{{ isDark ? '浅色' : '深色' }}</span>
          <span class="version">{{ appVersion }}</span>
        </button>
      </div>
    </aside>
    <main class="content">
      <div class="content-inner">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>
    <ToastHost />
    <QuickSearch />
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
  transition: transform 0.25s var(--ease-spring);
}
.brand:hover .logo { transform: rotate(-8deg) scale(1.08); }
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

.nav { display: flex; flex-direction: column; gap: 2px; flex: 1; position: relative; }
/* 滑动高亮指示条：随激活项平滑移动 */
.nav-indicator {
  position: absolute;
  left: 0; right: 0;
  height: 38px;
  border-radius: 10px;
  background: var(--accent-weak);
  transition: top 0.28s var(--ease-spring);
  z-index: 0;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  color: var(--text-2);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  position: relative;
  z-index: 1;
  transition: color var(--transition);
}
.nav-item:hover { background: var(--hover); color: var(--text); }
.nav-item.active {
  background: transparent;
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
.nav-icon { display: inline-flex; opacity: 0.9; transition: transform 0.2s var(--ease-spring); }
.nav-item:hover .nav-icon { transform: scale(1.12); }
.nav-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  background: var(--bg-soft);
  border-radius: 999px;
  padding: 1px 7px;
  min-width: 20px;
  text-align: center;
}
.nav-item.active .nav-count { background: var(--accent); color: #fff; }
.sidebar-foot { padding-top: 12px; border-top: 1px solid var(--line); }

.kbd-hints {
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  margin-bottom: 8px;
}
.kbd-hints kbd {
  display: inline-block;
  min-width: 16px;
  padding: 1px 4px;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--panel-2);
  font-family: inherit;
  font-size: 10px;
  text-align: center;
}
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
.version { margin-left: auto; font-size: 10px; opacity: 0.7; }

.content { flex: 1; overflow: auto; padding: 24px 28px; }
.content-inner { max-width: 1560px; margin: 0 auto; }

.page-enter-active { transition: opacity 0.22s var(--ease-out), transform 0.22s var(--ease-out); }
.page-leave-active { transition: opacity 0.14s ease, transform 0.14s ease; }
.page-enter-from { opacity: 0; transform: translateY(10px); }
.page-leave-to { opacity: 0; transform: translateY(-6px); }

/* 设置齿轮（参考 acgn-records） */
.gear { width: 18px; height: 18px; flex-shrink: 0; opacity: 0.85; transform-box: fill-box; transform-origin: center; transform: rotate(30deg); transition: transform 0.18s ease; }
.settings-gear.pressed .gear { transform: rotate(10deg); transition: transform 0.12s ease; }
.settings-gear.spinning .gear { animation: gearSpin 0.6s linear both; }
@keyframes gearSpin {
  0%   { transform: rotate(30deg)  scale(1); }
  25%  { transform: rotate(120deg) scale(1.03); }
  55%  { transform: rotate(300deg) scale(1.05); }
  80%  { transform: rotate(360deg) scale(1.03); }
  100% { transform: rotate(390deg) scale(1); }
}
</style>
