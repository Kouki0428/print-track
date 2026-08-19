<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorksStore } from '@/stores/works'
import { STATUS_LABELS, type WorkStatus } from '@/db/api'

const works = useWorksStore()
const keyword = ref('')
const showForm = ref(false)

const form = ref({
  name: '',
  status: 'designing' as WorkStatus,
  design_app: '',
  source_path: '',
  material_color: '',
  material_weight: '',
  print_hours: '',
  for_sale: false,
  sale_price: '',
  parent_id: '' as string,
})

const filtered = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return works.works
  return works.works.filter((w) => w.name.toLowerCase().includes(k))
})

const parentOptions = computed(() =>
  works.works.map((w) => ({ id: w.id, name: w.name })),
)

function resetForm() {
  form.value = {
    name: '', status: 'designing', design_app: '', source_path: '', material_color: '',
    material_weight: '', print_hours: '', for_sale: false, sale_price: '', parent_id: '',
  }
}

async function submit() {
  const f = form.value
  if (!f.name.trim()) return
  await works.add({
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
  })
  resetForm()
  showForm.value = false
}

function setStatus(id: number, status: WorkStatus) {
  works.patch(id, { status })
}
</script>

<template>
  <h1 class="page-title">作品库</h1>
  <div class="toolbar">
    <input v-model="keyword" class="search" placeholder="搜索作品名称…" />
    <button class="btn" @click="showForm = !showForm">+ 新建作品</button>
  </div>

  <div v-if="showForm" class="form">
    <div class="row">
      <label>名称<input v-model="form.name" placeholder="必填" /></label>
      <label>状态
        <select v-model="form.status">
          <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <label>设计来源<input v-model="form.design_app" placeholder="如 Blender / Fusion360" /></label>
      <label>子项目(父作品)
        <select v-model="form.parent_id">
          <option value="">无</option>
          <option v-for="p in parentOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>源文件/缩略图<input v-model="form.source_path" placeholder="STL / 3MF 路径" /></label>
      <label>耗材颜色<input v-model="form.material_color" placeholder="如 红 PLA" /></label>
      <label>耗材重量(g)<input v-model="form.material_weight" placeholder="如 120" inputmode="decimal" /></label>
      <label>打印时长(h)<input v-model="form.print_hours" placeholder="如 6.5" inputmode="decimal" /></label>
    </div>
    <div class="row">
      <label class="check"><input type="checkbox" v-model="form.for_sale" /> 是否售卖</label>
      <label v-if="form.for_sale">售卖价格(¥)<input v-model="form.sale_price" placeholder="如 39.9" inputmode="decimal" /></label>
    </div>
    <div class="actions">
      <button class="btn" @click="submit">保存</button>
      <button class="btn ghost" @click="showForm = false">取消</button>
      
    </div>
  </div>

  <div class="grid">
    <div v-for="w in filtered" :key="w.id" class="card">
      <div class="thumb">{{ w.name.slice(0, 1) }}</div>
      <div class="meta">
        <div class="name">{{ w.name }}</div>
        <div class="sub">
          <span class="tag">{{ STATUS_LABELS[w.status] }}</span>
          <span v-if="w.material_color" class="tag">色 {{ w.material_color }}</span>
          <span v-if="w.material_weight" class="tag">{{ w.material_weight }}g</span>
          <span v-if="w.print_hours" class="tag">{{ w.print_hours }}h</span>
          <span v-if="w.for_sale" class="tag sale">售 ¥{{ w.sale_price }}</span>
        </div>
        <div v-if="w.design_app" class="src">出处：{{ w.design_app }}</div>
        <div v-if="w.source_path" class="src">📁 {{ w.source_path }}</div>
      </div>
      <select class="status-select" :value="w.status" @change="setStatus(w.id, ($event.target as HTMLSelectElement).value as WorkStatus)">
        <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>
    <div v-if="filtered.length === 0" class="empty">暂无作品，点击「新建作品」开始。</div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
.search { flex: 1; max-width: 320px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; }
.btn { padding: 8px 14px; border: none; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; font-size: 14px; }
.btn.ghost { background: #e9ebef; color: var(--text); }
.form { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
.row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.row label { display: flex; flex-direction: column; font-size: 12px; color: var(--muted); gap: 4px; }
.row label.check { flex-direction: row; align-items: center; gap: 6px; }
.row input, .row select { padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; min-width: 150px; background: #fff; color: var(--text); }
.actions { display: flex; gap: 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.thumb { height: 96px; border-radius: 8px; background: linear-gradient(135deg, #e8f0fe, #c7d7fb); display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 700; color: var(--accent); }
.name { font-weight: 600; font-size: 15px; }
.sub { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-size: 12px; color: var(--muted); background: #f0f2f5; padding: 2px 8px; border-radius: 6px; }
.tag.sale { color: #c0392b; background: #fdecea; }
.src { font-size: 12px; color: var(--muted); word-break: break-all; }
.status-select { margin-top: auto; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; }
.empty { color: var(--muted); padding: 40px; grid-column: 1 / -1; text-align: center; }
</style>
