import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { applySchema } from './schema'
import type Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// 懒加载数据库：避免 better-sqlite3 原生模块缺失时主进程直接崩溃（窗口仍可见）
let db: Database.Database | null = null

async function initDb(): Promise<void> {
  if (db) return
  try {
    const BetterSqlite3 = (await import('better-sqlite3')).default
    const dbPath = path.join(app.getPath('userData'), 'print-track.db')
    db = new BetterSqlite3(dbPath)
    applySchema(db)
  } catch (err) {
    db = null
    dialog.showErrorBox(
      '数据库初始化失败',
      String(err) + '\n\n通常是 better-sqlite3 未为 Electron 重建，请执行：npm run rebuild',
    )
  }
}

function createWindow(): void {
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

  if (isDev) {
    // 使用 vite-plugin-electron/simple 注入的 dev server 地址（避免端口写死导致白屏）
    const url = process.env.VITE_DEV_SERVER_URL
    if (!url) {
      dialog.showErrorBox(
        '开发服务器未就绪',
        '未检测到 VITE_DEV_SERVER_URL。\n请确认 vite dev server 已随 npm run dev 正常启动（检查终端有无报错）。',
      )
    } else {
      win.loadURL(url)
      win.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    dialog.showErrorBox('页面加载失败', `code=${errorCode} ${errorDescription}`)
  })
}

// ---- IPC：数据库代理（所有 SQL 经由主进程执行，渲染端不直连 better-sqlite3）----
ipcMain.handle('db:query', (_e, sql: string, params: unknown[] = []) => {
  if (!db) throw new Error('数据库未初始化，请执行 npm run rebuild')
  return db.prepare(sql).all(...(params as unknown[]))
})
ipcMain.handle('db:run', (_e, sql: string, params: unknown[] = []) => {
  if (!db) throw new Error('数据库未初始化，请执行 npm run rebuild')
  const res = db.prepare(sql).run(...(params as unknown[]))
  return { lastInsertRowid: res.lastInsertRowid, changes: res.changes }
})
ipcMain.handle('db:get', (_e, sql: string, params: unknown[] = []) => {
  if (!db) throw new Error('数据库未初始化，请执行 npm run rebuild')
  return db.prepare(sql).get(...(params as unknown[]))
})

// 未捕获异常弹窗，避免「静默无界面」
process.on('uncaughtException', (err) => {
  dialog.showErrorBox('未捕获错误', String(err))
})

app.whenReady().then(async () => {
  await initDb()
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
