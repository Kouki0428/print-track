<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  listFilaments,
  createFilament,
  updateFilament,
  deleteFilament,
  type Filament,
} from '@/db/api'
import BaseModal from '@/components/BaseModal.vue'
import EmptyState from '@/components/EmptyState.vue'

const filaments = ref<Filament[]>([])
const showModal = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ brand: '', color: '#6f7bd6', total_g: '', price_per_kg: '' })

async function reload() {
  filaments.value = await listFilaments()
}
onMounted(reload)

const stats = computed(() => {
  const total = filaments.value.length
  const totalBuy = filaments.value.reduce((s, f) => s + (f.total_g || 0) * (f.price_per_kg || 0) / 1000, 0)
  const remain = filaments.value.reduce((s, f) => s + (f.remaining_g || 0) * (f.price_per_kg || 0) / 1000, 0)
  return { total, totalBuy, remain }
})

function openCreate() {
  editingId.value = null
  form.value = { brand: '', color: '#6f7bd6', total_g: '', price_per_kg: '' }
  showModal.value = true
}

function openEdit(f: Filament) {
  editingId.value = f.id
  form.value = {
    brand: f.brand || '',
    color: f.color || '#6f7bd6',
    total_g: f.total_g != null ? String(f.total_g) : '',
    price_per_kg: f.price_per_kg != null ? String(f.price_per_kg) : '',
  }
  showModal.value = true
}

async function submit() {
  const total = parseFloat(form.value.total_g)
  if (!form.value.brand || !total) return
  if (editingId.value != null) {
    await updateFilament(editingId.value, {
      brand: form.value.brand,
      color: form.value.color,
      total_g: total,
      price_per_kg: parseFloat(form.value.price_per_kg) || null,
    })
  } else {
    await createFilament({
      brand: form.value.brand,
      color: form.value.color,
      total_g: total,
      remaining_g: total,
      price_per_kg: parseFloat(form.value.price_per_kg) || null,
    })
  }
  showModal.value = false
  await reload()
}

async function adjust(id: number, delta: number) {
  const f = filaments.value.find((x) => x.id === id)
  if (!f) return
  const next = Math.max(0, (f.remaining_g || 0) + delta)
  await updateFilament(id, { remaining_g: next })
  await reload()
}

async function remove(f: Filament) {
  if (!window.confirm(`确定删除耗材「${f.brand || '未命名'}」？`)) return
  await deleteFilament(f.id)
  await reload()
}

function pct(f: Filament): number {
  return f.total_g ? Math.round(((f.remaining_g || 0) / f.total_g) * 100) : 0
}
function isLow(f: Filament): boolean {
  return pct(f) <= 20
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">耗材管理</h1>
      <button class="btn" @click="openCreate">+ 新增耗材</button>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="stat-value">{{ stats.total }}</div><div class="stat-label">耗材种类</div></div>
      <div class="stat"><div class="stat-value">¥{{ stats.totalBuy.toFixed(1) }}</div><div class="stat-label">入库总值</div></div>
      <div class="stat"><div class="stat-value">¥{{ stats.remain.toFixed(1) }}</div><div class="stat-label">剩余价值</div></div>
    </div>

    <div v-if="filaments.length" class="list">
      <div v-for="f in filaments" :key="f.id" class="card item">
        <span class="swatch" :style="{ background: f.color || '#ccc' }"></span>
        <div class="info">
          <div class="name-row">
            <div class="name">{{ f.brand || '未命名' }}</div>
            <span v-if="isLow(f)" class="badge low">库存紧张</span>
          </div>
          <div class="sub">单价 ¥{{ f.price_per_kg ?? '—' }}/kg · 余 {{ f.remaining_g ?? 0 }} / {{ f.total_g ?? 0 }} g</div>
          <div class="bar">
            <span :class="{ low: isLow(f) }" :style="{ width: pct(f) + '%', background: f.color || '#ccc' }"></span>
          </div>
        </div>
        <div class="ops">
          <button class="mini" @click="adjust(f.id, 50)">+50g</button>
          <button class="mini" @click="adjust(f.id, -50)">-50g</button>
          <button class="mini" @click="openEdit(f)">编辑</button>
          <button class="mini danger" @click="remove(f)">删除</button>
        </div>
      </div>
    </div>

    <EmptyState v-else emoji="🧵" title="还没有耗材记录" desc="录入你的线材库存，打印时会自动扣减用量。" />

    <BaseModal :open="showModal" :title="editingId != null ? '编辑耗材' : '新增耗材'" width="480px" @close="showModal = false">
      <div class="form-grid">
        <label class="field">品牌 / 型号
          <input v-model="form.brand" class="input" placeholder="如 eSUN PLA+" />
        </label>
        <label class="field">颜色
          <input v-model="form.color" class="input" type="color" style="height:38px;padding:3px" />
        </label>
        <label class="field">总重 (g)
          <input v-model="form.total_g" class="input" type="number" placeholder="1000" />
        </label>
        <label class="field">单价 (¥/kg)
          <input v-model="form.price_per_kg" class="input" type="number" placeholder="60" />
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
.list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.item { display: flex; align-items: center; gap: 14px; }
.swatch { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; border: 1px solid var(--line); }
.info { flex: 1; }
.name-row { display: flex; align-items: center; gap: 8px; }
.name { font-weight: 700; }
.sub { font-size: 12px; color: var(--muted); margin: 3px 0 7px; }
.bar { height: 7px; background: var(--bg-soft); border-radius: 5px; overflow: hidden; }
.bar span { display: block; height: 100%; transition: width 0.3s ease; border-radius: 5px; }
.bar span.low { box-shadow: 0 0 0 1px var(--red-bg); }
.badge.low { color: var(--red); background: var(--red-bg); }
.ops { display: flex; gap: 6px; flex-wrap: wrap; }
.mini { border: 1px solid var(--line); background: var(--panel-2); border-radius: 7px; padding: 5px 10px; font-size: 12px; cursor: pointer; transition: var(--transition); }
.mini:hover { background: var(--hover); }
.mini.danger { color: var(--red); border-color: var(--red-bg); }
.mini.danger:hover { background: var(--red-bg); }
</style>
