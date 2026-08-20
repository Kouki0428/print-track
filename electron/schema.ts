import type Database from 'better-sqlite3'

export const SCHEMA_VERSION = 2

export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS works (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      type          TEXT    NOT NULL DEFAULT 'print',
      name          TEXT    NOT NULL,
      parent_id     INTEGER REFERENCES works(id) ON DELETE CASCADE,
      thumbnail     TEXT,
      source_path   TEXT,
      design_app    TEXT,
      category      TEXT,
      tags          TEXT,
      material_color TEXT,
      material_weight REAL,
      print_hours   REAL,
      status        TEXT    NOT NULL DEFAULT 'planning',
      for_sale      INTEGER NOT NULL DEFAULT 0,
      sale_price    REAL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id     INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      started_at  TEXT,
      ended_at    TEXT,
      result      TEXT,
      note        TEXT,
      filament_used REAL
    );

    CREATE TABLE IF NOT EXISTS filaments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      brand        TEXT,
      color        TEXT,
      total_g      REAL,
      remaining_g  REAL,
      price_per_kg REAL
    );

    CREATE TABLE IF NOT EXISTS videos (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id      INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      platform     TEXT,
      url          TEXT,
      published_at TEXT,
      views        INTEGER,
      likes        INTEGER,
      comments     INTEGER,
      last_fetched TEXT
    );

    CREATE TABLE IF NOT EXISTS schedule (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id       INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
      planned_start TEXT,
      planned_end   TEXT,
      priority      INTEGER DEFAULT 0,
      note          TEXT
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  // 首次启动写 schema 版本；后续迁移走这里（保持 PRAGMA table_info 探测后 ALTER 的约束）
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined
  if (!row) {
    db.prepare(`INSERT INTO meta (key, value) VALUES ('schema_version', ?)`).run(String(SCHEMA_VERSION))
  } else if (Number(row.value) < SCHEMA_VERSION) {
    runMigrations(db, Number(row.value))
    db.prepare(`UPDATE meta SET value = ? WHERE key = 'schema_version'`).run(String(SCHEMA_VERSION))
  }

  // 状态语义升级：旧的 slicing/printing 合并为 making（筹划中/设计中/完成/失败 保持不变）
  // 旧库可能残留这两个值，统一重映射，避免看板/筛选出现未知状态
  db.exec(`UPDATE works SET status = 'making' WHERE status IN ('slicing', 'printing')`)

  // 旧库 works 没有 type 列时，默认归类为 3D 打印（兼容早期数据）
  if (!hasColumn(db, 'works', 'type')) {
    db.exec(`ALTER TABLE works ADD COLUMN type TEXT NOT NULL DEFAULT 'print'`)
  }
  // 旧库 videos 没有 last_fetched 列时补上（每日自动抓取时间戳）
  if (!hasColumn(db, 'videos', 'last_fetched')) {
    db.exec(`ALTER TABLE videos ADD COLUMN last_fetched TEXT`)
  }
  // print_jobs 增加 filament_id 关联（已存在旧库兼容；better-sqlite3 需用 PRAGMA 探测后 ALTER）
  if (!hasColumn(db, 'print_jobs', 'filament_id')) {
    db.exec(`ALTER TABLE print_jobs ADD COLUMN filament_id INTEGER REFERENCES filaments(id)`)
  }

  // 启动即重算一次逾期态（基于排期结束日）
  recomputeOverdue(db)
}

// 版本化迁移：仅执行 fromVersion 之后的升级步骤
function runMigrations(db: Database.Database, fromVersion: number): void {
  if (fromVersion < 2) {
    if (!hasColumn(db, 'works', 'type')) {
      db.exec(`ALTER TABLE works ADD COLUMN type TEXT NOT NULL DEFAULT 'print'`)
    }
    if (!hasColumn(db, 'videos', 'last_fetched')) {
      db.exec(`ALTER TABLE videos ADD COLUMN last_fetched TEXT`)
    }
  }
}

/**
 * 逾期自动判定并持久化：
 * - 非终态（非 done / failed / overdue）的项目，只要存在「排期结束日 < 今天」的排期，即自动标为 overdue。
 * - 完成后（done）不再被覆盖，保证已交付项目不会误判逾期。
 * 写回 works.status，使全应用（看板 / 列表 / 仪表盘 / 详情）实时反映红色逾期态。
 */
export function recomputeOverdue(db: Database.Database): void {
  db.exec(`
    UPDATE works
    SET status = 'overdue'
    WHERE status NOT IN ('done', 'failed', 'overdue')
      AND id IN (
        SELECT work_id FROM schedule
        WHERE planned_end IS NOT NULL
          AND date(planned_end) < date('now')
      )
  `)
}

/** 探测列是否存在（better-sqlite3 不支持 IF NOT EXISTS 语义，统一先探测） */
export function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>
  return cols.some((c) => c.name === column)
}
