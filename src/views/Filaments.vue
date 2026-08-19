<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  listFilaments,
  createFilament,
  updateFilament,
  deleteFilament,
  type Filament,
} from '@/db/api'

const filaments = ref<Filament[]>([])
const showForm = ref(false)
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

async function addFilament() {
  const total = parseFloat(form.value.total_g)
  if (!form.value.brand || !total) return
  await createFilament({
    brand: form.value.brand,
    color: form.value.color,
    total_g: total,
    remaining_g: total,
    price_per_kg: parseFloat(form.value.price_per_kg) || null,
  })
  form.value = { brand: '', color: '#6f7bd6', total_g: '', price_per_kg: '' }
  showForm.value = false
  await reload()
}

async function adjust(id: number, delta: number) {
  const f = filaments.value.find((x) => x.id === id)
  if (!f) return
  const next = Math.max(0, (f.remaining_g || 0) + delta)
  await updateFilament(id, { remaining_g: next })
  await reload()
}

async function remove(id: number) {
  await deleteFilament(id)
  await reload()
}
</script>

<template>
  <div>
    <div class="page-head">
      <h2 class="page-title">耗材管理</h2>
      <button class="btn" @click="showForm = true">+ 新增耗材</button>
    </div>

    <div class="stats">
      <div class="stat"><div class="stat-num">{{ stats.total }}</div><div class="stat-label">耗材种类</div></div>
      <div class="stat"><div class="stat-num">¥{{ stats.totalBuy.toFixed(1) }}</div><div class="stat-label">入库总值</div></div>
      <div class="stat"><div class="stat-num">¥{{ stats.remain.toFixed(1) }}</div><div class="stat-label">剩余价值</div></div>
    </div>

    <div v-if="showForm" class="card form">
      <div class="row">
        <label>品牌/型号<input v-model="form.brand" placeholder="如 eSUN PLA+" /></label>
        <label>颜色<input v-model="form.color" type="color" /></label>
        <label>总重(g)<input v-model="form.total_g" type="number" placeholder="1000" /></label>
        <label>单价(¥/kg)<input v-model="form.price_per_kg" type="number" placeholder="60" /></label>
      </div>
      <div class="actions">
        <button class="btn" @click="addFilament">保存</button>
        <button class="btn ghost" @click="showForm = false">取消</button>
      </div>
    </div>

    <div class="list">
      <div v-for="f in filaments" :key="f.id" class="item">
        <span class="swatch" :style="{ background: f.color || '#ccc' }"></span>
        <div class="info">
          <div class="name">{{ f.brand || '未命名' }}</div>
          <div class="sub">
            单价 ¥{{ f.price_per_kg ?? '—' }}/kg ·
            余 {{ f.remaining_g ?? 0 }} / {{ f.total_g ?? 0 }} g
          </div>
          <div class="bar"><span :style="{ width: (f.total_g ? (f.remaining_g || 0) / f.total_g * 100 : 0) + '%', background: f.color || '#ccc' }"></span></div>
        </div>
        <div class="ops">
          <button class="mini" @click="adjust(f.id, 50)">+50g</button>
          <button class="mini" @click="adjust(f.id, -50)">-50g</button>
          <button class="mini danger" @click="remove(f.id)">删除</button>
        </div>
      </div>
      <div v-if="!filaments.length" class="empty">暂无耗材，点击「新增耗材」录入库存。</div>
    </div>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; }
.stats { display: flex; gap: 14px; margin-bottom: 18px; }
.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; min-width: 120px; }
.stat-num { font-size: 22px; font-weight: 700; }
.stat-label { color: var(--muted); font-size: 12px; margin-top: 2px; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.form .row { display: flex; gap: 14px; flex-wrap: wrap; }
.form label { display: flex; flex-direction: column; font-size: 12px; color: var(--muted); gap: 4px; }
.form input { padding: 7px 9px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; }
.actions { margin-top: 12px; display: flex; gap: 10px; }
.btn { padding: 8px 14px; border: none; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; font-size: 14px; }
.btn.ghost { background: #e9ebef; color: var(--text); }
.list { display: flex; flex-direction: column; gap: 10px; }
.item { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
.swatch { width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0; border: 1px solid var(--line); }
.info { flex: 1; }
.name { font-weight: 600; }
.sub { font-size: 12px; color: var(--muted); margin: 2px 0 6px; }
.bar { height: 6px; background: #eef0f3; border-radius: 4px; overflow: hidden; }
.bar span { display: block; height: 100%; transition: width .3s; }
.ops { display: flex; gap: 6px; }
.mini { border: 1px solid var(--line); background: #fff; border-radius: 7px; padding: 5px 9px; font-size: 12px; cursor: pointer; }
.mini.danger { color: #d23f3f; border-color: #f0c5c5; }
.empty { color: var(--muted); padding: 20px; text-align: center; }
</style>
