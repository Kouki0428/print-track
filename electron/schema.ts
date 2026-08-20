import type Database from 'better-sqlite3'

export const SCHEMA_VERSION = 1

export function applySchema(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS works (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
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
      status        TEXT    NOT NULL DEFAULT 'designing',
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
      comments     INTEGER
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
    // 未来版本的 ALTER 迁移放在此处，逐一探测列后 ALTER
    db.prepare(`UPDATE meta SET value = ? WHERE key = 'schema_version'`).run(String(SCHEMA_VERSION))
  }

  // print_jobs 增加 filament_id 关联（已存在旧库兼容；better-sqlite3 需用 PRAGMA 探测后 ALTER）
  if (!hasColumn(db, 'print_jobs', 'filament_id')) {
    db.exec(`ALTER TABLE print_jobs ADD COLUMN filament_id INTEGER REFERENCES filaments(id)`)
  }
}

/** 探测列是否存在（better-sqlite3 不支持 IF NOT EXISTS 语义，统一先探测） */
export function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>
  return cols.some((c) => c.name === column)
}
