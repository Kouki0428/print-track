<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWorksStore } from '@/stores/works'
import { useUiStore } from '@/stores/ui'
import { useToast } from '@/stores/toast'
import {
  STATUS_LABELS,
  STATUS_ORDER,
  KNOWN_TYPES,
  typeLabel,
  listVideos,
  listSchedules,
  type Work,
  type WorkStatus,
  type Video,
  type Schedule,
} from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ColorPalette from '@/components/ColorPalette.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

const works = useWorksStore()
const ui = useUiStore()
const route = useRoute()
const toast = useToast()

// 排期数据：用于卡片上的截止日徽章
const schedules = ref<Schedule[]>([])

// 支持 ?new=1（直接打开新建）与 ?work=ID（直接打开详情）深链
onMounted(async () => {
  await works.fetchAll()
  schedules.value = await listSchedules()
  if (route.query.new) openCreate()
  const qw = Array.isArray(route.query.work) ? route.query.work[0] : route.query.work
  const wid = qw != null ? Number(qw) : NaN
  if (!Number.isNaN(wid)) {
    const w = works.works.find((x) => x.id === wid)
    if (w) openDetail(w)
  }
})

// 每个项目的最近截止日徽章（14 天内或已逾期才显示）
const dueChips = computed(() => {
  const map = new Map<number, { text: string; cls: string }>()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const byWork = new Map<number, string>()
  for (const s of schedules.value) {
    if (!s.planned_end) continue
    const cur = byWork.get(s.work_id)
    if (!cur || s.planned_end < cur) byWork.set(s.work_id, s.planned_end)
  }
  for (const [wid, end] of byWork) {
    const left = Math.round((new Date(end).getTime() - today.getTime()) / 86400000)
    if (left > 14) continue
    map.set(wid, {
      text: left < 0 ? `逾期 ${-left} 天` : left === 0 ? '今天截止' : `剩 ${left} 天`,
      cls: left < 0 ? 'over' : left <= 7 ? 'soon' : 'later',
    })
  }
  return map
})

const keyword = ref('')
const filters: (WorkStatus | 'all')[] = ['all', 'planning', 'designing', 'making', 'done', 'overdue', 'failed']
// 支持从仪表盘图例/统计卡跳转过来时带上 ?status=
const qs = Array.isArray(route.query.status) ? route.query.status[0] : route.query.status
const statusFilter = ref<WorkStatus | 'all'>(
  qs && filters.includes(qs as WorkStatus) ? (qs as WorkStatus) : 'all',
)

// 全局类型过滤 + 关键字 + 状态筛选 + 排序（排序偏好持久化）
type SortKey = 'updated' | 'created' | 'name' | 'status'
const SORT_KEY = 'printtrack-sort'
const savedSort = localStorage.getItem(SORT_KEY) as SortKey | null
const sortBy = ref<SortKey>(
  savedSort && ['updated', 'created', 'name', 'status'].includes(savedSort) ? savedSort : 'updated',
)
watch(sortBy, (v) => localStorage.setItem(SORT_KEY, v))
const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  const list = works.works.filter((w) => {
    const okType = ui.typeFilter === 'all' || w.type === ui.typeFilter
    const okStatus = statusFilter.value === 'all' || w.status === statusFilter.value
    const okKw = !k || w.name.toLowerCase().includes(k) || (w.design_app || '').toLowerCase().includes(k)
    return okType && okStatus && okKw
  })
  return list.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name, 'zh-CN')
      case 'status':
        return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      case 'created':
        return b.created_at.localeCompare(a.created_at)
      default:
        return b.updated_at.localeCompare(a.updated_at)
    }
  })
})

const parentName = (id: number | null) => works.works.find((w) => w.id === id)?.name || '—'

function workColors(w: Work): string[] {
  return w.material_colors || []
}

// ---- 新建表单 ----
const createOpen = ref(false)
const cform = ref({
  type: 'print' as string,
  name: '',
  status: 'planning' as WorkStatus,
  design_app: '',
  source_path: '',
  material_colors: [] as string[],
  material_weight: '',
  print_hours: '',
  for_sale: false,
  sale_price: '',
  parent_id: '' as string,
})
const customType = ref('')
const nameInvalid = ref(false)
const showPaletteCreate = ref(false)

const createTypeOptions = computed<{ value: string; label: string }[]>(() => {
  const opts: { value: string; label: string }[] = KNOWN_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))
  opts.push({ value: '__custom__', label: '自定义' })
  return opts
})
function onTypeChange(e: Event) {
  cform.value.type = (e.target as HTMLSelectElement).value
}
function openCreate() {
  cform.value = {
    type: ui.typeFilter === 'all' || !KNOWN_TYPES.includes(ui.typeFilter as any) ? ui.typeFilter === 'all' ? 'print' : ui.typeFilter : 'print',
    name: '', status: 'planning', design_app: '', source_path: '',
    material_colors: [], material_weight: '', print_hours: '',
    for_sale: false, sale_price: '', parent_id: '',
  }
  customType.value = ''
  showPaletteCreate.value = false
  createOpen.value = true
}

// 快捷键 N：打开新建弹窗（App 层广播）
watch(
  () => ui.newSignal,
  () => {
    if (!createOpen.value && !detailId.value) openCreate()
  },
)
// 新建表单内按 Enter 直接提交（仅对输入框生效）
function onFormEnter(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t.tagName === 'INPUT' && !(t as HTMLInputElement).type?.includes('color')) {
    e.preventDefault()
    submitCreate()
  }
}

async function submitCreate() {
  const f = cform.value
  if (!f.name.trim()) {
    nameInvalid.value = true
    toast.error('请填写项目名称')
    return
  }
  if (works.works.some((w) => w.name === f.name.trim())) {
    nameInvalid.value = true
    toast.error('已存在同名项目，请换一个名称')
    return
  }
  // 选中「自定义」时，以手填内容作为类型；为空则归入「其它」
  const finalType =
    f.type === '__custom__' ? (customType.value.trim() || 'other') : f.type
  await works.add({
    type: finalType,
    name: f.name.trim(),
    status: f.status,
    design_app: f.design_app.trim() || null,
    source_path: f.source_path.trim() || null,
    material_colors: f.material_colors,
    material_weight: f.material_weight ? Number(f.material_weight) : null,
    print_hours: f.print_hours ? Number(f.print_hours) : null,
    for_sale: f.for_sale ? 1 : 0,
    sale_price: f.for_sale && f.sale_price ? Number(f.sale_price) : null,
    parent_id: f.parent_id ? Number(f.parent_id) : null,
  })
  createOpen.value = false
  toast.success(`项目「${f.name.trim()}」已创建`)
}

// 卡片悬停快捷操作：直接改状态
async function quickStatus(w: Work, e: Event) {
  const s = (e.target as HTMLSelectElement).value as WorkStatus
  if (s === w.status) return
  await works.patch(w.id, { status: s })
  toast.success(`「${w.name}」已标记为「${STATUS_LABELS[s]}」`)
}
function addColorCreate(hex: string) {
  if (!cform.value.material_colors.includes(hex)) cform.value.material_colors.push(hex)
}
function removeColorCreate(hex: string) {
  cform.value.material_colors = cform.value.material_colors.filter((c) => c !== hex)
}

// ---- 详情抽屉 ----
const detailId = ref<number | null>(null)
const detail = computed(() => works.works.find((w) => w.id === detailId.value) || null)
const showPalette = ref(false)

// 该项目关联的视频（详情内只读展示，编辑在「视频统计」页）
const allVideos = ref<Video[]>([])
const detailVideos = computed(() =>
  detail.value ? allVideos.value.filter((v) => v.work_id === detail.value!.id) : [],
)
async function refreshVideos() {
  allVideos.value = await listVideos()
}

// 子项目完成进度
const subWorks = computed(() =>
  works.works.filter((w) => w.parent_id === detail.value?.id),
)
const subDoneCount = computed(() => subWorks.value.filter((w) => w.status === 'done').length)
const subPct = computed(() =>
  subWorks.value.length ? Math.round((subDoneCount.value / subWorks.value.length) * 100) : 0,
)

function openDetail(w: Work) {
  detailId.value = w.id
  showPalette.value = false
  refreshVideos()
}
async function patchDetail(p: Partial<Work>) {
  if (detailId.value == null) return
  await works.patch(detailId.value, p)
}

// 详情内切换状态（带反馈）
async function setDetailStatus(e: Event) {
  const s = (e.target as HTMLSelectElement).value as WorkStatus
  if (!detail.value || s === detail.value.status) return
  const name = detail.value.name
  await patchDetail({ status: s })
  toast.success(`「${name}」已标记为「${STATUS_LABELS[s]}」`)
}

// 详情内改名
async function renameDetail(e: Event) {
  const name = (e.target as HTMLInputElement).value.trim()
  if (!detail.value || !name || name === detail.value.name) return
  if (works.works.some((w) => w.name === name && w.id !== detail.value!.id)) {
    toast.error('已存在同名项目，请换一个名称')
    return
  }
  await patchDetail({ name })
  toast.success('项目名称已更新')
}
function addColor(hex: string) {
  const cur = detail.value?.material_colors || []
  if (!cur.includes(hex)) patchDetail({ material_colors: [...cur, hex] })
}
function removeColor(hex: string) {
  const cur = detail.value?.material_colors || []
  patchDetail({ material_colors: cur.filter((c) => c !== hex) })
}

// 删除：自定义确认弹窗（替代 window.confirm）
const confirmRemove = ref(false)
const removeTarget = ref<Work | null>(null)
function askRemove(w: Work) {
  removeTarget.value = w
  confirmRemove.value = true
}
async function doRemove() {
  const w = removeTarget.value
  if (!w) return
  confirmRemove.value = false
  await works.remove(w.id)
  if (detailId.value === w.id) detailId.value = null
  removeTarget.value = null
  toast.success(`已删除「${w.name}」`)
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="page-title">作品库</h1>
        <p class="subtitle">
          统一管理
          <template v-if="ui.typeFilter === 'all'">全部项目</template>
          <template v-else>{{ typeLabel(ui.typeFilter) }}项目</template>
          · 点击卡片查看详情
        </p>
      </div>
      <button class="btn" @click="openCreate">+ 新建项目</button>
    </div>

    <div class="toolbar">
      <div class="search-wrap">
        <input v-model="keyword" class="input search" placeholder="搜索名称 / 软件…" />
        <button v-if="keyword" class="clear-btn" title="清空搜索" @click="keyword = ''">×</button>
      </div>
      <div class="chips">
        <button
          v-for="f in filters"
          :key="f"
          class="chip"
          :class="{ on: statusFilter === f }"
          @click="statusFilter = f"
        >
          {{ f === 'all' ? '全部状态' : STATUS_LABELS[f] }}
        </button>
      </div>
      <span class="spacer"></span>
      <span class="result-count">共 {{ filtered.length }} 个</span>
      <select v-model="sortBy" class="select sort-select" title="排序方式">
        <option value="updated">最近更新</option>
        <option value="created">创建时间</option>
        <option value="name">名称</option>
        <option value="status">状态</option>
      </select>
    </div>

    <!-- 首次加载骨架屏 -->
    <div v-if="works.loading && !works.works.length" class="grid">
      <div v-for="i in 8" :key="i" class="card sk-card">
        <div class="skeleton sk-thumb"></div>
        <div class="skeleton sk-line"></div>
        <div class="skeleton sk-line short"></div>
      </div>
    </div>

    <div v-else-if="filtered.length" class="grid stagger">
      <div
        v-for="w in filtered"
        :key="w.id"
        class="card work-card"
        :class="'s-' + w.status"
        @click="openDetail(w)"
      >
        <div class="thumb">
          <span>{{ w.name.slice(0, 1) }}</span>
          <span
            v-if="w.type === 'print' && workColors(w).length"
            class="color-dots"
          >
            <span
              v-for="c in workColors(w).slice(0, 3)"
              :key="c"
              class="color-dot"
              :style="{ background: c }"
              :title="c"
            ></span>
          </span>
        </div>
        <div class="meta">
          <div class="name-row">
            <div class="name">{{ w.name }}</div>
            <StatusBadge :status="w.status" />
          </div>
          <div class="tags">
            <span class="tag type">{{ typeLabel(w.type) }}</span>
            <span v-if="w.design_app" class="tag">{{ w.design_app }}</span>
            <span v-if="w.type === 'print' && w.material_weight" class="tag">{{ w.material_weight }}g</span>
            <span v-if="w.type === 'print' && w.print_hours" class="tag">{{ w.print_hours }}h</span>
            <span v-if="w.for_sale" class="tag sale">售 ¥{{ w.sale_price }}</span>
            <span
              v-if="dueChips.get(w.id)"
              class="tag due-chip"
              :class="dueChips.get(w.id)!.cls"
            >{{ dueChips.get(w.id)!.text }}</span>
          </div>
          <div v-if="w.parent_id" class="rel">↳ 子项目 · {{ parentName(w.parent_id) }}</div>
        </div>
        <!-- 悬停快捷操作：改状态 / 详情 / 删除 -->
        <div class="quick" @click.stop>
          <select class="quick-status" :value="w.status" title="修改状态" @change="quickStatus(w, $event)">
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
          <span class="spacer"></span>
          <button class="q-btn" title="详情 / 编辑" @click="openDetail(w)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="q-btn danger" title="删除" @click="askRemove(w)">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      emoji="🗂️"
      title="没有匹配的项目"
      :desc="works.works.length ? '试试调整搜索或筛选条件。' : '点击下方「新建项目」开始记录第一个项目。'"
    >
      <button v-if="!works.works.length" class="btn" @click="openCreate">+ 新建项目</button>
    </EmptyState>    <!-- 新建项目 -->
    <BaseModal :open="createOpen" title="新建项目" width="600px" @close="createOpen = false">
      <div class="form-grid" @keydown.enter="onFormEnter">
        <label class="field">类型
          <select :value="cform.type" class="select" @change="onTypeChange">
            <option v-for="t in createTypeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <input
            v-if="cform.type === '__custom__'"
            v-model="customType"
            class="input"
            style="margin-top:8px"
            placeholder="输入自定义类型名称，如：手办 / 玩具"
          />
        </label>
        <label class="field">名称
          <input
            v-model="cform.name"
            class="input"
            :class="{ invalid: nameInvalid }"
            placeholder="必填"
            @input="nameInvalid = false"
          />
        </label>
        <label class="field">状态
          <select v-model="cform.status" class="select">
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="field">软件 / 引擎
          <input v-model="cform.design_app" class="input" :placeholder="cform.type === 'print' ? 'Blender / Fusion360' : '软件 / 引擎名称'" />
        </label>
        <label class="field">父项目（子项目归属）
          <select v-model="cform.parent_id" class="select">
            <option value="">无</option>
            <option v-for="p in works.works" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="field">源文件 / 路径
          <input v-model="cform.source_path" class="input" placeholder="STL / 工程文件路径" />
        </label>
        <template v-if="cform.type === 'print'">
          <label class="field">耗材关联（项目内调色盘）
            <div class="color-chips">
              <span v-for="c in cform.material_colors" :key="c" class="color-chip" :style="{ background: c }">
                <button class="x" @click="removeColorCreate(c)" title="移除">×</button>
              </span>
              <button class="add-color" @click="showPaletteCreate = !showPaletteCreate" title="添加关联颜色">＋</button>
            </div>
            <Transition name="fade">
              <div v-if="showPaletteCreate" class="palette-pop">
                <ColorPalette :current="cform.material_colors" @pick="addColorCreate" />
              </div>
            </Transition>
          </label>
          <label class="field">耗材重量 (g)
            <input v-model="cform.material_weight" class="input" placeholder="120" inputmode="decimal" />
          </label>
          <label class="field">打印时长 (h)
            <input v-model="cform.print_hours" class="input" placeholder="6.5" inputmode="decimal" />
          </label>
        </template>
        <label class="field check">
          <input type="checkbox" v-model="cform.for_sale" /> 是否售卖
        </label>
        <label v-if="cform.for_sale" class="field">售卖价格 (¥)
          <input v-model="cform.sale_price" class="input" placeholder="39.9" inputmode="decimal" />
        </label>
      </div>
      <template #footer>
        <button class="btn ghost" @click="createOpen = false">取消</button>
        <button class="btn" @click="submitCreate">创建</button>
      </template>
    </BaseModal>

    <!-- 详情抽屉 -->
    <BaseModal
      v-if="detail"
      :open="detailId != null"
      :title="detail.name"
      width="680px"
      @close="detailId = null"
    >
      <div class="detail-head">
        <StatusBadge :status="detail.status" />
        <span class="type-tag">{{ typeLabel(detail.type) }}</span>
      </div>

      <!-- 子项目完成进度 -->
      <div v-if="subWorks.length" class="inline-panel sub-panel">
        <div class="panel-title">子项目进度（{{ subDoneCount }}/{{ subWorks.length }} 完成）</div>
        <div class="panel-body">
          <div class="sub-bar"><div class="sub-bar-fill grow-x" :style="{ width: subPct + '%' }"></div></div>
          <div class="sub-list">
            <button
              v-for="s in subWorks"
              :key="s.id"
              class="tag sub-chip"
              title="查看该子项目"
              @click="openDetail(s)"
            >{{ s.name }}</button>
          </div>
        </div>
      </div>

      <!-- 通用字段 -->
      <div class="form-grid">
        <label class="field">名称
          <input :value="detail.name" class="input" @change="renameDetail" />
        </label>
        <label class="field">状态
          <select :value="detail.status" class="select" @change="setDetailStatus">
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="field">软件 / 引擎
          <input :value="detail.design_app || ''" class="input" @change="patchDetail({ design_app: ($event.target as HTMLInputElement).value || null })" />
        </label>
        <label class="field">源文件路径
          <input :value="detail.source_path || ''" class="input" @change="patchDetail({ source_path: ($event.target as HTMLInputElement).value || null })" />
        </label>
        <label class="field check">
          <input type="checkbox" :checked="!!detail.for_sale" @change="patchDetail({ for_sale: ($event.target as HTMLInputElement).checked ? 1 : 0 })" /> 售卖中
        </label>
        <label v-if="detail.for_sale" class="field">售卖价格 (¥)
          <input :value="detail.sale_price ?? ''" class="input" inputmode="decimal" @change="patchDetail({ sale_price: Number(($event.target as HTMLInputElement).value) || null })" />
        </label>
      </div>

      <!-- 3D 打印专属：调色盘关联耗材颜色（多色）+ 重量/用量 -->
      <div v-if="detail.type === 'print'" class="inline-panel">
        <div class="panel-title">耗材关联（项目内调色盘）</div>
        <div class="panel-body">
          <div class="field">
            <span class="field-label">关联线材颜色</span>
            <div class="color-chips">
              <span v-for="c in (detail.material_colors || [])" :key="c" class="color-chip" :style="{ background: c }">
                <button class="x" @click="removeColor(c)" title="移除">×</button>
              </span>
              <button class="add-color" @click="showPalette = !showPalette" title="添加关联颜色">＋</button>
            </div>
            <Transition name="fade">
              <div v-if="showPalette" class="palette-pop">
                <ColorPalette :current="detail.material_colors || []" @pick="addColor" />
              </div>
            </Transition>
          </div>
          <div class="mini-fields">
            <label class="field">耗材重量 (g)
              <input :value="detail.material_weight ?? ''" class="input" inputmode="decimal" placeholder="120" @change="patchDetail({ material_weight: Number(($event.target as HTMLInputElement).value) || null })" />
            </label>
            <label class="field">打印时长 (h)
              <input :value="detail.print_hours ?? ''" class="input" inputmode="decimal" placeholder="6.5" @change="patchDetail({ print_hours: Number(($event.target as HTMLInputElement).value) || null })" />
            </label>
          </div>
        </div>
      </div>

      <!-- 3D 建模专属 -->
      <div v-else-if="detail.type === 'model'" class="inline-panel">
        <div class="panel-title">建模信息</div>
        <div class="panel-body">
          <label class="field">模型分类
            <input :value="detail.category || ''" class="input" placeholder="角色 / 场景 / 道具" @change="patchDetail({ category: ($event.target as HTMLInputElement).value || null })" />
          </label>
          <label class="field">标签
            <input :value="detail.tags || ''" class="input" placeholder="写实 / 低模" @change="patchDetail({ tags: ($event.target as HTMLInputElement).value || null })" />
          </label>
        </div>
      </div>

      <!-- 其它 / 自定义类型：通用信息面板 -->
      <div v-else class="inline-panel">
        <div class="panel-title">项目信息</div>
        <div class="panel-body">
          <label class="field">分类
            <input :value="detail.category || ''" class="input" placeholder="可选分类" @change="patchDetail({ category: ($event.target as HTMLInputElement).value || null })" />
          </label>
          <label class="field">标签
            <input :value="detail.tags || ''" class="input" placeholder="可选标签" @change="patchDetail({ tags: ($event.target as HTMLInputElement).value || null })" />
          </label>
        </div>
      </div>

      <!-- 关联视频（只读展示，编辑在「视频统计」页） -->
      <div class="inline-panel">
        <div class="panel-title">关联视频（{{ detailVideos.length }}）</div>
        <div class="panel-body">
          <div v-if="detailVideos.length" class="vid-list">
            <div v-for="v in detailVideos" :key="v.id" class="vid-row">
              <span class="tag">B站</span>
              <span class="vid-date">{{ v.published_at || '日期未知' }}</span>
              <span class="vid-stats">播 {{ (v.views ?? 0).toLocaleString() }} · 赞 {{ (v.likes ?? 0).toLocaleString() }} · 评 {{ (v.comments ?? 0).toLocaleString() }}</span>
              <span class="spacer"></span>
              <a v-if="v.url" :href="v.url" target="_blank" class="mini-link">打开</a>
            </div>
          </div>
          <p v-else class="muted vid-empty">暂无关联视频，去「视频统计」页添加。</p>
        </div>
      </div>

      <p class="meta-line">创建于 {{ detail.created_at?.slice(0, 10) }} · 更新于 {{ detail.updated_at?.slice(0, 10) }}</p>

      <template #footer>
        <button class="btn danger ghost" @click="askRemove(detail)">删除项目</button>
        <button class="btn ghost" @click="detailId = null">关闭</button>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="confirmRemove"
      danger
      title="删除项目"
      :message="`确定删除「${removeTarget?.name ?? ''}」？该操作不可撤销。`"
      confirm-text="删除"
      @cancel="confirmRemove = false"
      @confirm="doRemove"
    />
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.search-wrap { position: relative; flex: 1; max-width: 320px; }
.search-wrap .search { width: 100%; padding-right: 30px; }
.clear-btn {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  border: none; background: transparent; color: var(--muted);
  font-size: 17px; line-height: 1; cursor: pointer; padding: 2px;
}
.clear-btn:hover { color: var(--text); }
.result-count { font-size: 12px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.sort-select { width: auto; padding: 6px 10px; font-size: 13px; }

/* 骨架屏卡片 */
.sk-card { cursor: default; pointer-events: none; }
.sk-thumb { height: 104px; border-radius: 10px; margin-bottom: 4px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--panel); color: var(--text-2); font-size: 13px; cursor: pointer;
  transition: var(--transition);
}
.chip:hover { background: var(--hover); }
.chip.on { background: var(--accent); color: #fff; border-color: var(--accent); }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.card {
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 14px; display: flex; flex-direction: column; gap: 10px; cursor: pointer;
  box-shadow: var(--shadow-sm); transition: var(--transition);
}
.card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--accent); }

/* 悬停快捷操作条 */
.quick { display: flex; align-items: center; gap: 6px; opacity: 0; transform: translateY(4px); transition: var(--transition); }
.card:hover .quick, .card:focus-within .quick { opacity: 1; transform: none; }
.quick .spacer { flex: 1; }
.quick-status {
  padding: 4px 6px; font-size: 12px;
  border: 1px solid var(--line-strong); border-radius: 7px;
  background: var(--panel-2); color: var(--text-2); cursor: pointer;
}
.q-btn {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px;
  color: var(--text-2); cursor: pointer; transition: var(--transition); padding: 0;
}
.q-btn:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-weak); }
.q-btn.danger:hover { color: var(--red); border-color: var(--red); background: var(--red-bg); }
.card.s-planning { border-top: 3px solid var(--purple); }
.card.s-designing { border-top: 3px solid var(--blue); }
.card.s-making { border-top: 3px solid var(--orange); }
.card.s-done { border-top: 3px solid var(--green); }
.card.s-overdue { border-top: 3px solid var(--red); }
.card.s-failed { border-top: 3px solid var(--gray); }
.thumb {
  height: 104px; border-radius: 10px; position: relative;
  background: linear-gradient(135deg, var(--accent-weak), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: 38px; font-weight: 800; color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 4px rgba(16, 24, 40, 0.25);
}
.color-dots { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 4px; }
.color-dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: var(--shadow-sm); }
.name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.name { font-weight: 700; font-size: 15px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; color: var(--text-2); background: var(--gray-bg); padding: 2px 8px; border-radius: 6px; }
.tag.type { color: var(--accent); background: var(--accent-weak); font-weight: 600; }
.tag.sale { color: var(--red); background: var(--red-bg); }
.due-chip { font-weight: 600; }
.due-chip.over { color: var(--red); background: var(--red-bg); }
.due-chip.soon { color: var(--orange); background: var(--orange-bg); }
.due-chip.later { color: var(--accent); background: var(--accent-weak); }
.rel { font-size: 12px; color: var(--purple); }

/* 详情抽屉 */
.detail-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.type-tag { font-size: 12px; color: var(--text-2); background: var(--gray-bg); padding: 3px 9px; border-radius: 999px; }
.field-label { font-size: 12px; color: var(--muted); }
.inline-panel { margin-top: 18px; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.panel-title { font-weight: 700; font-size: 13px; padding: 10px 14px; background: var(--panel-2); border-bottom: 1px solid var(--line); }
.panel-body { padding: 14px; display: flex; flex-direction: column; gap: 14px; }
.mini-fields { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
.mini-fields .field { min-width: 140px; }

/* 多色关联 */
.color-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.color-chip {
  width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line-strong);
  position: relative; display: inline-flex; align-items: center; justify-content: center;
}
.color-chip .x {
  position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%;
  background: var(--red); color: #fff; border: 1px solid #fff; font-size: 11px; line-height: 1;
  cursor: pointer; display: none; padding: 0;
}
.color-chip:hover .x { display: inline-flex; align-items: center; justify-content: center; }
.add-color {
  width: 30px; height: 30px; border-radius: 8px; border: 1px dashed var(--line-strong);
  background: var(--panel); color: var(--text-2); font-size: 16px; cursor: pointer; transition: var(--transition);
}
.add-color:hover { border-color: var(--accent); color: var(--accent); }
.palette-pop { margin-top: 4px; }

/* 详情内关联视频 */
.vid-list { display: flex; flex-direction: column; gap: 8px; }

/* 子项目进度 */
.sub-panel { margin-top: 0; margin-bottom: 16px; }
.sub-bar { height: 8px; background: var(--bg-soft); border-radius: 999px; overflow: hidden; }
.sub-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--green)); border-radius: 999px; transition: width 0.4s var(--ease-out); }
.sub-list { display: flex; flex-wrap: wrap; gap: 6px; }
.sub-chip { cursor: pointer; border: none; transition: var(--transition); }
.sub-chip:hover { color: var(--accent); }
.vid-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 6px 8px; border-radius: 8px; transition: var(--transition); }
.vid-row:hover { background: var(--hover); }
.vid-date { color: var(--muted); font-variant-numeric: tabular-nums; }
.vid-stats { font-variant-numeric: tabular-nums; color: var(--text-2); }
.mini-link {
  font-size: 12px; color: var(--accent); border: 1px solid var(--line);
  padding: 3px 9px; border-radius: 7px; text-decoration: none; transition: var(--transition);
}
.mini-link:hover { background: var(--accent-weak); border-color: var(--accent); text-decoration: none; }
.vid-empty { font-size: 13px; margin: 0; }
.meta-line { margin: 14px 2px 0; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

.field.check { flex-direction: row; align-items: center; gap: 8px; }
</style>
