<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorksStore } from '@/stores/works'
import { useUiStore } from '@/stores/ui'
import {
  STATUS_LABELS,
  WORK_TYPE_LABELS,
  type Work,
  type WorkStatus,
  type WorkType,
} from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'
import ColorPicker from '@/components/ColorPicker.vue'

const works = useWorksStore()
const ui = useUiStore()
onMounted(() => works.fetchAll())

const keyword = ref('')
const statusFilter = ref<WorkStatus | 'all'>('all')
const filters: (WorkStatus | 'all')[] = ['all', 'planning', 'designing', 'making', 'done', 'overdue', 'failed']

// 全局类型过滤 + 关键字 + 状态筛选
const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return works.works.filter((w) => {
    const okType = ui.typeFilter === 'all' || w.type === ui.typeFilter
    const okStatus = statusFilter.value === 'all' || w.status === statusFilter.value
    const okKw = !k || w.name.toLowerCase().includes(k) || (w.design_app || '').toLowerCase().includes(k)
    return okType && okStatus && okKw
  })
})

const parentName = (id: number | null) => works.works.find((w) => w.id === id)?.name || '—'

// ---- 新建表单 ----
const createOpen = ref(false)
const cform = ref({
  type: 'print' as WorkType,
  name: '',
  status: 'planning' as WorkStatus,
  design_app: '',
  source_path: '',
  material_color: '' as string | null,
  material_weight: '',
  print_hours: '',
  for_sale: false,
  sale_price: '',
  parent_id: '' as string,
})
function openCreate() {
  cform.value = {
    type: ui.typeFilter === 'all' ? 'print' : ui.typeFilter,
    name: '', status: 'planning', design_app: '', source_path: '',
    material_color: null, material_weight: '', print_hours: '',
    for_sale: false, sale_price: '', parent_id: '',
  }
  createOpen.value = true
}
async function submitCreate() {
  const f = cform.value
  if (!f.name.trim()) return
  await works.add({
    type: f.type,
    name: f.name.trim(),
    status: f.status,
    design_app: f.design_app.trim() || null,
    source_path: f.source_path.trim() || null,
    material_color: f.material_color,
    material_weight: f.material_weight ? Number(f.material_weight) : null,
    print_hours: f.print_hours ? Number(f.print_hours) : null,
    for_sale: f.for_sale ? 1 : 0,
    sale_price: f.for_sale && f.sale_price ? Number(f.sale_price) : null,
    parent_id: f.parent_id ? Number(f.parent_id) : null,
  })
  createOpen.value = false
}

// ---- 详情抽屉 ----
const detailId = ref<number | null>(null)
const detail = computed(() => works.works.find((w) => w.id === detailId.value) || null)

function openDetail(w: Work) {
  detailId.value = w.id
}
async function patchDetail(p: Partial<Work>) {
  if (detailId.value == null) return
  await works.patch(detailId.value, p)
}
async function remove(w: Work) {
  if (!window.confirm(`确定删除「${w.name}」？该操作不可撤销。`)) return
  await works.remove(w.id)
  if (detailId.value === w.id) detailId.value = null
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
          <template v-else>{{ WORK_TYPE_LABELS[ui.typeFilter] }}项目</template>
          · 点击卡片查看详情
        </p>
      </div>
      <button class="btn" @click="openCreate">+ 新建项目</button>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="input search" placeholder="搜索名称 / 软件…" />
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
    </div>

    <div v-if="filtered.length" class="grid">
      <div
        v-for="w in filtered"
        :key="w.id"
        class="card"
        :class="'s-' + w.status"
        @click="openDetail(w)"
      >
        <div class="thumb">
          <span>{{ w.name.slice(0, 1) }}</span>
          <span
            v-if="w.type === 'print' && w.material_color"
            class="color-dot"
            :style="{ background: w.material_color }"
            :title="w.material_color"
          ></span>
        </div>
        <div class="meta">
          <div class="name-row">
            <div class="name">{{ w.name }}</div>
            <StatusBadge :status="w.status" />
          </div>
          <div class="tags">
            <span class="tag type">{{ WORK_TYPE_LABELS[w.type] }}</span>
            <span v-if="w.design_app" class="tag">{{ w.design_app }}</span>
            <span v-if="w.type === 'print' && w.material_weight" class="tag">{{ w.material_weight }}g</span>
            <span v-if="w.type === 'print' && w.print_hours" class="tag">{{ w.print_hours }}h</span>
            <span v-if="w.for_sale" class="tag sale">售 ¥{{ w.sale_price }}</span>
          </div>
          <div v-if="w.parent_id" class="rel">↳ 子项目 · {{ parentName(w.parent_id) }}</div>
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
    </EmptyState>

    <!-- 新建项目 -->
    <BaseModal :open="createOpen" title="新建项目" width="600px" @close="createOpen = false">
      <div class="form-grid">
        <label class="field">类型
          <select v-model="cform.type" class="select">
            <option value="print">3D 打印</option>
            <option value="model">3D 建模</option>
            <option value="game">单机游戏</option>
          </select>
        </label>
        <label class="field">名称
          <input v-model="cform.name" class="input" placeholder="必填" />
        </label>
        <label class="field">状态
          <select v-model="cform.status" class="select">
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="field">软件 / 引擎
          <input v-model="cform.design_app" class="input" :placeholder="cform.type === 'game' ? 'Unity / Godot' : 'Blender / Fusion360'" />
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
        <span class="type-tag">{{ WORK_TYPE_LABELS[detail.type] }}</span>
      </div>

      <!-- 通用字段 -->
      <div class="form-grid">
        <label class="field">状态
          <select :value="detail.status" class="select" @change="patchDetail({ status: ($event.target as HTMLSelectElement).value as WorkStatus })">
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

      <!-- 3D 打印专属：调色盘关联耗材颜色 + 重量/用量 -->
      <div v-if="detail.type === 'print'" class="inline-panel">
        <div class="panel-title">耗材关联（项目内调色盘）</div>
        <div class="panel-body">
          <div class="field">
            <span class="field-label">线材颜色</span>
            <ColorPicker :model-value="detail.material_color" @update:model-value="patchDetail({ material_color: $event })" />
          </div>
          <div class="mini-fields">
            <label class="field">耗材重量 (g)
              <input :value="detail.material_weight ?? ''" class="input" inputmode="decimal" placeholder="120" @change="patchDetail({ material_weight: Number(($event.target as HTMLInputElement).value) || null })" />
            </label>
            <label class="field">打印时长 (h)
              <input :value="detail.print_hours ?? ''" class="input" inputmode="decimal" placeholder="6.5" @change="patchDetail({ print_hours: Number(($event.target as HTMLInputElement).value) || null })" />
            </label>
            <div v-if="detail.material_color" class="color-preview">
              <span class="preview-dot" :style="{ background: detail.material_color }"></span>
              <span class="preview-hex">{{ detail.material_color.toUpperCase() }}</span>
            </div>
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

      <!-- 单机游戏专属 -->
      <div v-else-if="detail.type === 'game'" class="inline-panel">
        <div class="panel-title">游戏制作信息</div>
        <div class="panel-body">
          <label class="field">平台
            <input :value="detail.category || ''" class="input" placeholder="PC / Steam / 主机" @change="patchDetail({ category: ($event.target as HTMLInputElement).value || null })" />
          </label>
          <label class="field">版本
            <input :value="detail.tags || ''" class="input" placeholder="v0.1.0" @change="patchDetail({ tags: ($event.target as HTMLInputElement).value || null })" />
          </label>
        </div>
      </div>

      <template #footer>
        <button class="btn danger ghost" @click="remove(detail)">删除项目</button>
        <button class="btn ghost" @click="detailId = null">关闭</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.subtitle { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.search { flex: 1; max-width: 320px; }
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
  box-shadow: var(--shadow-sm); transition: var(--transition); animation: rise 0.32s ease both;
}
.card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--accent); }
.card.s-planning { border-top: 3px solid var(--purple); }
.card.s-designing { border-top: 3px solid var(--blue); }
.card.s-making { border-top: 3px solid var(--orange); }
.card.s-done { border-top: 3px solid var(--green); }
.card.s-overdue { border-top: 3px solid var(--red); }
.card.s-failed { border-top: 3px solid var(--gray); }
.thumb {
  height: 104px; border-radius: 10px; position: relative;
  background: linear-gradient(135deg, var(--accent-weak), #c7d7fb);
  display: flex; align-items: center; justify-content: center;
  font-size: 38px; font-weight: 800; color: var(--accent);
}
.color-dot {
  position: absolute; right: 10px; bottom: 10px; width: 18px; height: 18px;
  border-radius: 50%; border: 2px solid #fff; box-shadow: var(--shadow-sm);
}
.name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.name { font-weight: 700; font-size: 15px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; color: var(--text-2); background: var(--gray-bg); padding: 2px 8px; border-radius: 6px; }
.tag.type { color: var(--accent); background: var(--accent-weak); font-weight: 600; }
.tag.sale { color: var(--red); background: var(--red-bg); }
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
.color-preview { display: flex; align-items: center; gap: 8px; }
.preview-dot { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--line-strong); }
.preview-hex { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--text-2); }
.field.check { flex-direction: row; align-items: center; gap: 8px; }
</style>
