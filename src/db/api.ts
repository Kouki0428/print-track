// 渲染端数据库访问层：经 window.db 走主进程代理
export interface DbRow {
  [key: string]: unknown
}

export const db = {
  query: <T = DbRow>(sql: string, params: unknown[] = []): Promise<T[]> =>
    (window as any).db.query(sql, params) as Promise<T[]>,
  run: (sql: string, params: unknown[] = []): Promise<{ lastInsertRowid: number; changes: number }> =>
    (window as any).db.run(sql, params),
  get: <T = DbRow>(sql: string, params: unknown[] = []): Promise<T | undefined> =>
    (window as any).db.get(sql, params) as Promise<T | undefined>,
}

// ---- 类型 ----
export type WorkStatus = 'designing' | 'slicing' | 'printing' | 'done' | 'failed'

export interface Work {
  id: number
  name: string
  parent_id: number | null
  thumbnail: string | null
  source_path: string | null
  design_app: string | null
  category: string | null
  tags: string | null
  material_color: string | null
  material_weight: number | null
  print_hours: number | null
  status: WorkStatus
  for_sale: number
  sale_price: number | null
  created_at: string
  updated_at: string
}

export const STATUS_LABELS: Record<WorkStatus, string> = {
  designing: '设计中',
  slicing: '切片中',
  printing: '打印中',
  done: '完成',
  failed: '失败',
}

// ---- works 读写 ----
export async function listWorks(): Promise<Work[]> {
  return db.query<Work>('SELECT * FROM works ORDER BY updated_at DESC')
}

export async function createWork(input: Partial<Work>): Promise<number> {
  const res = await db.run(
    `INSERT INTO works (name, parent_id, thumbnail, source_path, design_app, category, tags,
       material_color, material_weight, print_hours, status, for_sale, sale_price)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.name ?? '未命名作品',
      input.parent_id ?? null,
      input.thumbnail ?? null,
      input.source_path ?? null,
      input.design_app ?? null,
      input.category ?? null,
      input.tags ?? null,
      input.material_color ?? null,
      input.material_weight ?? null,
      input.print_hours ?? null,
      input.status ?? 'designing',
      input.for_sale ?? 0,
      input.sale_price ?? null,
    ],
  )
  return Number(res.lastInsertRowid)
}

export async function updateWork(id: number, patch: Partial<Work>): Promise<void> {
  const keys = Object.keys(patch).filter((k) => k in ({} as Work))
  if (keys.length === 0) return
  const setClause = keys.map((k) => `${k} = ?`).join(', ')
  await db.run(
    `UPDATE works SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
    [...keys.map((k) => (patch as any)[k]), id],
  )
}

export async function deleteWork(id: number): Promise<void> {
  await db.run('DELETE FROM works WHERE id = ?', [id])
}

// ---- print_jobs 读写 ----
export interface PrintJob {
  id: number
  work_id: number
  filament_id: number | null
  started_at: string | null
  ended_at: string | null
  result: string | null
  note: string | null
  filament_used: number | null
}

export async function createPrintJob(input: Partial<PrintJob>): Promise<number> {
  const res = await db.run(
    `INSERT INTO print_jobs (work_id, filament_id, started_at, ended_at, result, note, filament_used)
     VALUES (?,?,?,?,?,?,?)`,
    [
      input.work_id,
      input.filament_id ?? null,
      input.started_at ?? null,
      input.ended_at ?? null,
      input.result ?? null,
      input.note ?? null,
      input.filament_used ?? null,
    ],
  )
  const id = Number(res.lastInsertRowid)
  // 联动扣减耗材：成功打印才扣减库存（不影响失败件）
  if (input.filament_id && input.filament_used) {
    await db.run(
      `UPDATE filaments SET remaining_g = MAX(0, COALESCE(remaining_g, 0) - ?) WHERE id = ?`,
      [input.filament_used, input.filament_id],
    )
  }
  return id
}

export async function listPrintJobs(workId: number): Promise<PrintJob[]> {
  return db.query<PrintJob>('SELECT * FROM print_jobs WHERE work_id = ? ORDER BY id DESC', [workId])
}

// ---- filaments 读写 ----
export interface Filament {
  id: number
  brand: string | null
  color: string | null
  total_g: number | null
  remaining_g: number | null
  price_per_kg: number | null
}

export async function listFilaments(): Promise<Filament[]> {
  return db.query<Filament>('SELECT * FROM filaments ORDER BY id DESC')
}

export async function createFilament(input: Partial<Filament>): Promise<number> {
  const res = await db.run(
    `INSERT INTO filaments (brand, color, total_g, remaining_g, price_per_kg)
     VALUES (?,?,?,?,?)`,
    [
      input.brand ?? null,
      input.color ?? null,
      input.total_g ?? null,
      input.remaining_g ?? input.total_g ?? null,
      input.price_per_kg ?? null,
    ],
  )
  return Number(res.lastInsertRowid)
}

export async function updateFilament(id: number, patch: Partial<Filament>): Promise<void> {
  const keys = Object.keys(patch).filter((k) => k in ({} as Filament))
  if (  keys.length === 0) return
  const setClause = keys.map((k) => `${k} = ?`).join(', ')
  await db.run(`UPDATE filaments SET ${setClause} WHERE id = ?`, [...keys.map((k) => (patch as any)[k]), id])
}

export async function deleteFilament(id: number): Promise<void> {
  await db.run('DELETE FROM filaments WHERE id = ?', [id])
}

// ---- videos 读写 ----
export interface Video {
  id: number
  work_id: number
  platform: string | null
  url: string | null
  published_at: string | null
  views: number | null
  likes: number | null
  comments: number | null
}

export async function listVideos(): Promise<Video[]> {
  return db.query<Video>('SELECT * FROM videos ORDER BY published_at DESC')
}

export async function listVideosByWork(workId: number): Promise<Video[]> {
  return db.query<Video>('SELECT * FROM videos WHERE work_id = ? ORDER BY published_at DESC', [workId])
}

export async function createVideo(input: Partial<Video>): Promise<number> {
  const res = await db.run(
    `INSERT INTO videos (work_id, platform, url, published_at, views, likes, comments)
     VALUES (?,?,?,?,?,?,?)`,
    [
      input.work_id,
      input.platform ?? null,
      input.url ?? null,
      input.published_at ?? null,
      input.views ?? 0,
      input.likes ?? 0,
      input.comments ?? 0,
    ],
  )
  return Number(res.lastInsertRowid)
}

export async function deleteVideo(id: number): Promise<void> {
  await db.run('DELETE FROM videos WHERE id = ?', [id])
}

// ---- schedule 读写 ----
export interface Schedule {
  id: number
  work_id: number
  planned_start: string | null
  planned_end: string | null
  priority: number | null
  note: string | null
}

export async function listSchedules(): Promise<Schedule[]> {
  return db.query<Schedule>('SELECT * FROM schedule ORDER BY priority DESC, planned_start ASC')
}

export async function createSchedule(input: Partial<Schedule>): Promise<number> {
  const res = await db.run(
    `INSERT INTO schedule (work_id, planned_start, planned_end, priority, note)
     VALUES (?,?,?,?,?)`,
    [
      input.work_id,
      input.planned_start ?? null,
      input.planned_end ?? null,
      input.priority ?? 0,
      input.note ?? null,
    ],
  )
  return Number(res.lastInsertRowid)
}

export async function updateSchedule(id: number, patch: Partial<Schedule>): Promise<void> {
  const keys = Object.keys(patch).filter((k) => k in ({} as Schedule))
  if (keys.length === 0) return
  const setClause = keys.map((k) => `${k} = ?`).join(', ')
  await db.run(`UPDATE schedule SET ${setClause} WHERE id = ?`, [...keys.map((k) => (patch as any)[k]), id])
}

export async function deleteSchedule(id: number): Promise<void> {
  await db.run('DELETE FROM schedule WHERE id = ?', [id])
}
