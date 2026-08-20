<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorksStore } from '@/stores/works'
import { STATUS_LABELS, type Work, type WorkStatus } from '@/db/api'
import StatusBadge from '@/components/StatusBadge.vue'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const works = useWorksStore()

const keyword = ref('')
const filter = ref<WorkStatus | 'all'>('all')

const filters: (WorkStatus | 'all')[] = ['all', 'planning', 'designing', 'making', 'done', 'overdue', 'failed']

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return works.works.filter((w) => {
    const okStatus = filter.value === 'all' || w.status === filter.value
    const okKw = !k || w.name.toLowerCase().includes(k) || (w.design_app || '').toLowerCase().includes(k)
    return okStatus && okKw
  })
})

const parentName = (id: number | null) => works.works.find((w) => w.id === id)?.name || '—'

// ---- 弹窗表单 ----
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  name: '',
  status: 'planning' as WorkStatus,
  design_app: '',
  source_path: '',
  material_color: '',
  material_weight: '',
  print_hours: '',
  for_sale: false,
  sale_price: '',
  parent_id: '' as string,
})

function openCreate() {
  editingId.value = null
  form.value = {
    name: '', status: 'planning', design_app: '', source_path: '', material_color: '',
    material_weight: '', print_hours: '', for_sale: false, sale_price: '', parent_id: '',
  }
  modalOpen.value = true
}

function openEdit(w: Work) {
  editingId.value = w.id
  form.value = {
    name: w.name,
    status: w.status,
    design_app: w.design_app || '',
    source_path: w.source_path || '',
    material_color: w.material_color || '',
    material_weight: w.material_weight != null ? String(w.material_weight) : '',
    print_hours: w.print_hours != null ? String(w.print_hours) : '',
    for_sale: !!w.for_sale,
    sale_price: w.sale_price != null ? String(w.sale_price) : '',
    parent_id: w.parent_id != null ? String(w.parent_id) : '',
  }
  modalOpen.value = true
}

async function submit() {
  const f = form.value
  if (!f.name.trim()) return
  const payload = {
    name: f.name.trim(),
    status: f.status,
    design_app: f.design_app.trim() || null,
    source_path: f.source_path.trim() || null,
    material_color: f.material_color.trim() || null,
    material_weight: f.material_weight ? Number(f.material_weight) : null,
    print_hours: f.print_hours ? Number(f.print_hours) : null,
    for_sale: f.for_sale ? 1 : 0,
    sale_price: f.for_sale && f.sale_price ? Number(f.sale_price) : null,
    parent_id: f.parent_id ? Number(f.parent_id) : null,
  }
  if (editingId.value != null) await works.patch(editingId.value, payload)
  else await works.add(payload)
  modalOpen.value = false
}

async function remove(w: Work) {
  if (!window.confirm(`确定删除「${w.name}」？该操作不可撤销。`)) return
  await works.remove(w.id)
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">作品库</h1>
      <button class="btn" @click="openCreate">+ 新建作品</button>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="input search" placeholder="搜索名称 / 设计来源…" />
      <div class="chips">
        <button
          v-for="f in filters"
          :key="f"
          class="chip"
          :class="{ on: filter === f }"
          @click="filter = f"
        >
          {{ f === 'all' ? '全部' : STATUS_LABELS[f] }}
        </button>
      </div>
    </div>

    <div v-if="filtered.length" class="grid">
      <div v-for="w in filtered" :key="w.id" class="card" :class="'s-' + w.status">
        <div class="thumb">
          <span>{{ w.name.slice(0, 1) }}</span>
          <span v-if="w.material_color" class="color-dot" :title="w.material_color"></span>
        </div>
        <div class="meta">
          <div class="name-row">
            <div class="name">{{ w.name }}</div>
            <StatusBadge :status="w.status" />
          </div>
          <div class="tags">
            <span v-if="w.design_app" class="tag">{{ w.design_app }}</span>
            <span v-if="w.material_color" class="tag">{{ w.material_color }}</span>
            <span v-if="w.material_weight" class="tag">{{ w.material_weight }}g</span>
            <span v-if="w.print_hours" class="tag">{{ w.print_hours }}h</span>
            <span v-if="w.for_sale" class="tag sale">售 ¥{{ w.sale_price }}</span>
          </div>
          <div v-if="w.parent_id" class="rel">↳ 子项目 · {{ parentName(w.parent_id) }}</div>
          <div v-if="w.source_path" class="src">📁 {{ w.source_path }}</div>
        </div>
        <div class="ops">
          <button class="mini" @click="openEdit(w)">编辑</button>
          <button class="mini danger" @click="remove(w)">删除</button>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      emoji="🗂️"
      title="没有匹配的作品"
      :desc="works.works.length ? '试试调整搜索或筛选条件。' : '点击下方「新建作品」开始记录你的第一个 3D 打印作品。'"
    >
      <button v-if="!works.works.length" class="btn" @click="openCreate">+ 新建作品</button>
    </EmptyState>

    <BaseModal :open="modalOpen" :title="editingId != null ? '编辑作品' : '新建作品'" width="600px" @close="modalOpen = false">
      <div class="form-grid">
        <label class="field">名称
          <input v-model="form.name" class="input" placeholder="必填，如 龙虾摆件" />
        </label>
        <label class="field">状态
          <select v-model="form.status" class="select">
            <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="field">设计来源
          <input v-model="form.design_app" class="input" placeholder="Blender / Fusion360" />
        </label>
        <label class="field">父作品（子项目归属）
          <select v-model="form.parent_id" class="select">
            <option value="">无</option>
            <option v-for="p in works.works.filter((w) => w.id !== editingId)" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label class="field">源文件 / 缩略图
          <input v-model="form.source_path" class="input" placeholder="STL / 3MF 路径" />
        </label>
        <label class="field">耗材颜色
          <input v-model="form.material_color" class="input" placeholder="红 PLA" />
        </label>
        <label class="field">耗材重量 (g)
          <input v-model="form.material_weight" class="input" placeholder="120" inputmode="decimal" />
        </label>
        <label class="field">打印时长 (h)
          <input v-model="form.print_hours" class="input" placeholder="6.5" inputmode="decimal" />
        </label>
        <label class="field check">
          <input type="checkbox" v-model="form.for_sale" /> 是否售卖
        </label>
        <label v-if="form.for_sale" class="field">售卖价格 (¥)
          <input v-model="form.sale_price" class="input" placeholder="39.9" inputmode="decimal" />
        </label>
      </div>
      <template #footer>
        <button class="btn ghost" @click="modalOpen = false">取消</button>
        <button class="btn" @click="submit">保存</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
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
  padding: 14px; display: flex; flex-direction: column; gap: 10px;
  box-shadow: var(--shadow-sm); transition: var(--transition);
}
.card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
.thumb {
  height: 104px; border-radius: 10px; position: relative;
  background: linear-gradient(135deg, var(--accent-weak), #c7d7fb);
  display: flex; align-items: center; justify-content: center;
  font-size: 38px; font-weight: 800; color: var(--accent);
}
.color-dot {
  position: absolute; right: 10px; bottom: 10px; width: 16px; height: 16px;
  border-radius: 50%; border: 2px solid #fff; box-shadow: var(--shadow-sm);
}
.name-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.name { font-weight: 700; font-size: 15px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; color: var(--text-2); background: var(--gray-bg); padding: 2px 8px; border-radius: 6px; }
.tag.sale { color: var(--red); background: var(--red-bg); }
.rel { font-size: 12px; color: var(--purple); }
.src { font-size: 12px; color: var(--muted); word-break: break-all; }
.ops { display: flex; gap: 8px; margin-top: 2px; }
.mini { border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px; padding: 5px 10px; font-size: 12px; cursor: pointer; transition: var(--transition); }
.mini:hover { background: var(--hover); }
.mini.danger { color: var(--red); border-color: var(--red-bg); }
.mini.danger:hover { background: var(--red-bg); }

.field.check { flex-direction: row; align-items: center; gap: 8px; }

/* 状态色条 + 入场动画 */
.grid > .card { animation: rise 0.32s ease both; }
.card.s-planning { border-top: 3px solid var(--purple); }
.card.s-designing { border-top: 3px solid var(--blue); }
.card.s-making { border-top: 3px solid var(--orange); }
.card.s-done { border-top: 3px solid var(--green); }
.card.s-overdue { border-top: 3px solid var(--red); }
.card.s-failed { border-top: 3px solid var(--gray); }
</style>
