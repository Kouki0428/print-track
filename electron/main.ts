import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Database from 'better-sqlite3'
import { applySchema } from './schema'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let db: Database.Database

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    title: 'PrintTrack · 3D 打印进度管理',
    backgroundColor: '#f6f7f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const dbPath = path.join(app.getPath('userData'), 'print-track.db')
  db = new Database(dbPath)
  applySchema(db)

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ---- IPC: 数据库代理（所有 SQL 经由主进程执行，渲染端不直连 better-sqlite3）----
ipcMain.handle('db:query', (_e, sql: string, params: unknown[] = []) => {
  return db.prepare(sql).all(...(params as unknown[]))
})
ipcMain.handle('db:run', (_e, sql: string, params: unknown[] = []) => {
  const res = db.prepare(sql).run(...(params as unknown[]))
  return { lastInsertRowid: res.lastInsertRowid, changes: res.changes }
})
ipcMain.handle('db:get', (_e, sql: string, params: unknown[] = []) => {
  return db.prepare(sql).get(...(params as unknown[]))
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db?.close()
    app.quit()
  }
})
