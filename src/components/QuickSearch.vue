<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorksStore } from '@/stores/works'
import { typeLabel, type WorkStatus } from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'

const router = useRouter()
const works = useWorksStore()

const open = ref(false)
const q = ref('')
const active = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

const pages = [
  { to: '/dashboard', label: '仪表盘' },
  { to: '/library', label: '作品库' },
  { to: '/board', label: '进度板' },
  { to: '/timeline', label: '时间线' },
  { to: '/videos', label: '视频统计' },
]

type Item =
  | { kind: 'page'; to: string; label: string }
  | { kind: 'work'; id: number; label: string; status: WorkStatus; type: string }

// 页面命中：按名称过滤；无关键字时全部展示
const pageHits = computed(() => {
  const k = q.value.trim()
  return k ? pages.filter((p) => p.label.includes(k)) : pages
})

// 项目命中：按名称过滤；无关键字时展示最近更新的 5 个
const workHits = computed(() => {
  const k = q.value.trim().toLowerCase()
  const list = k
    ? works.works.filter((w) => w.name.toLowerCase().includes(k))
    : [...works.works].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5)
  return list.slice(0, 8)
})

// 扁平化的可选项列表（方向键索引基于它）
const items = computed<Item[]>(() => [
  ...pageHits.value.map((p) => ({ kind: 'page' as const, to: p.to, label: p.label })),
  ...workHits.value.map((w) => ({
    kind: 'work' as const,
    id: w.id,
    label: w.name,
    status: w.status,
    type: w.type,
  })),
])

watch([q, open], () => {
  active.value = 0
})
watch(open, async (v) => {
  if (v) {
    q.value = ''
    await nextTick()
    inputEl.value?.focus()
  }
})

function close() {
  open.value = false
}

function go(it: Item) {
  if (it.kind === 'page') router.push(it.to)
  else router.push(`/library?work=${it.id}`)
  close()
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    // 其他弹窗打开时不再叠加呼出
    if (!open.value && document.querySelector('.overlay')) return
    e.preventDefault()
    open.value = !open.value
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(items.value.length - 1, active.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(0, active.value - 1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const it = items.value[active.value]
    if (it) go(it)
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="overlay" @click.self="close">
        <div class="dialog qs-panel">
          <div class="qs-input-row">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input
              ref="inputEl"
              v-model="q"
              class="qs-input"
              placeholder="搜索项目，或输入页面名跳转…"
              spellcheck="false"
            />
            <span class="qs-esc">Esc</span>
          </div>

          <div class="qs-list">
            <template v-if="pageHits.length">
              <div class="qs-group">页面</div>
              <button
                v-for="(p, i) in pageHits"
                :key="'p-' + p.to"
                class="qs-item"
                :class="{ on: active === i }"
                @click="go(items[i]!)"
                @mousemove="active = i"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                <span>{{ p.label }}</span>
              </button>
            </template>

            <template v-if="workHits.length">
              <div class="qs-group">项目</div>
              <button
                v-for="(w, j) in workHits"
                :key="'w-' + w.id"
                class="qs-item"
                :class="{ on: active === pageHits.length + j }"
                @click="go(items[pageHits.length + j]!)"
                @mousemove="active = pageHits.length + j"
              >
                <StatusBadge :status="w.status" />
                <span class="qs-name">{{ w.name }}</span>
                <span class="qs-type">{{ typeLabel(w.type) }}</span>
              </button>
            </template>

            <div v-if="!items.length" class="qs-empty">没有匹配的项目</div>
          </div>

          <div class="qs-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
            <span><kbd>Enter</kbd> 打开</span>
            <span><kbd>Ctrl</kbd>+<kbd>K</kbd> 呼出/关闭</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(16, 24, 40, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1300;
  backdrop-filter: blur(2px);
  padding-top: 12vh;
}
.qs-panel {
  width: 540px;
  max-width: calc(100vw - 40px);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  text-align: left;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}
.qs-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
}
.qs-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
}
.qs-input::placeholder { color: var(--muted); }
.qs-esc {
  font-size: 10px;
  color: var(--muted);
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  padding: 2px 6px;
}
.qs-list { overflow-y: auto; padding: 6px; flex: 1; }
.qs-group {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.4px;
  padding: 8px 10px 4px;
}
.qs-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
.qs-item.on { background: var(--accent-weak); }
.qs-item.on .qs-name { color: var(--accent); }
.qs-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qs-type { font-size: 12px; color: var(--muted); }
.qs-empty { padding: 26px 0; text-align: center; color: var(--muted); font-size: 13px; }
.qs-foot {
  display: flex;
  gap: 16px;
  padding: 9px 16px;
  border-top: 1px solid var(--line);
  font-size: 11px;
  color: var(--muted);
}
.qs-foot kbd {
  display: inline-block;
  min-width: 14px;
  padding: 1px 4px;
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--panel-2);
  font-family: inherit;
  font-size: 10px;
  text-align: center;
  margin-right: 2px;
}
</style>
