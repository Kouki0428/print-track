import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { applySchema, recomputeOverdue } from './schema'
import { fetchVideoStats } from './videoFetch'
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

// ---- UI 偏好（ui-pref.json：主题 / 关闭到托盘等，主进程与渲染端共享）----
function readUiPref(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'ui-pref.json'), 'utf8')) || {}
  } catch {
    return {}
  }
}
function writeUiPref(patch: Record<string, unknown>) {
  try {
    const p = path.join(app.getPath('userData'), 'ui-pref.json')
    fs.writeFileSync(p, JSON.stringify({ ...readUiPref(), ...patch }), 'utf8')
  } catch {
    // 写入失败不影响功能
  }
}

// 读取用户主题偏好（决定窗口背景色），避免深色用户启动闪白
function readThemePref(): 'light' | 'dark' {
  return readUiPref().theme === 'dark' ? 'dark' : 'light'
}

// ---- 托盘最小化 ----
let tray: Tray | null = null
let closeToTray = false

function ensureTray(win: BrowserWindow) {
  if (tray) return
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('PrintTrack · 点击图标恢复窗口')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          win.show()
          win.focus()
        },
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]),
  )
  tray.on('double-click', () => {
    win.show()
    win.focus()
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    title: 'PrintTrack · 3D 打印进度管理',
    backgroundColor: readThemePref() === 'dark' ? '#14161b' : '#f4f6f9',
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
      // 默认不弹 DevTools；需要调试时设环境变量 PRINTTRACK_DEVTOOLS=1 才会以独立窗口打开
      if (process.env.PRINTTRACK_DEVTOOLS === '1') {
        win.webContents.openDevTools({ mode: 'detach' })
      }
    }
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    dialog.showErrorBox('页面加载失败', `code=${errorCode} ${errorDescription}`)
  })

  // target="_blank" / window.open 一律交给系统默认浏览器，不在应用内开子窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 开启「关闭到托盘」时：点关闭 = 隐藏窗口（真正退出走托盘菜单的退出）
  win.on('close', (e) => {
    if (closeToTray && !appQuiting) {
      e.preventDefault()
      win.hide()
    }
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

// 真正退出标记：托盘隐藏模式下 before-quit 时放行 close 事件
let appQuiting = false
app.on('before-quit', () => {
  appQuiting = true
})

// 打开数据目录（设置页使用）
ipcMain.handle('app:open-data-folder', () => {
  const dir = app.getPath('userData')
  shell.openPath(dir)
  return dir
})

// 备份数据库：弹出保存对话框，将 SQLite 文件复制到用户选择的位置
ipcMain.handle('app:backup-db', async () => {
  if (!db) throw new Error('数据库未初始化，请执行 npm run rebuild')
  const res = await dialog.showSaveDialog({
    title: '备份数据库',
    defaultPath: `print-track-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [
      { name: 'SQLite 数据库', extensions: ['db'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (res.canceled || !res.filePath) return { ok: false as const }
  await db.backup(res.filePath)
  return { ok: true as const, path: res.filePath }
})

// 主题偏好持久化（主进程读它决定窗口背景色）
ipcMain.handle('app:save-theme', (_e, t: string) => {
  writeUiPref({ theme: t === 'dark' ? 'dark' : 'light' })
})

// 关闭到托盘开关（渲染端设置页控制）
ipcMain.handle('app:set-close-to-tray', (e, v: boolean) => {
  closeToTray = !!v
  writeUiPref({ closeToTray: closeToTray })
  if (closeToTray) {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) ensureTray(win)
  }
})

// 导出 CSV：渲染端拼好内容，这里弹保存框写文件（加 BOM 保证 Excel 打开中文不乱码）
ipcMain.handle('app:export-csv', async (_e, filename: string, csv: string) => {
  const res = await dialog.showSaveDialog({
    title: '导出 CSV',
    defaultPath: filename,
    filters: [
      { name: 'CSV 文件', extensions: ['csv'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })
  if (res.canceled || !res.filePath) return { ok: false as const }
  fs.writeFileSync(res.filePath, '\uFEFF' + csv, 'utf8')
  return { ok: true as const, path: res.filePath }
})

// 视频链接抓取：仅哔哩哔哩
ipcMain.handle('video:fetchStats', async (_e, url: string) => {
  return await fetchVideoStats(url)
})

// 全量重算逾期 + 每日自动抓取视频（启动执行一次，随后每 24h 一次）
async function dailyRefresh(): Promise<void> {
  if (!db) return
  try {
    recomputeOverdue(db)
    const today = new Date().toISOString().slice(0, 10)
    const rows = db
      .prepare(`SELECT id, url, last_fetched, published_at FROM videos WHERE url IS NOT NULL`)
      .all() as Array<{ id: number; url: string; last_fetched: string | null; published_at: string | null }>
    for (const v of rows) {
      if (v.last_fetched && v.last_fetched.slice(0, 10) === today) continue
      try {
        const s = await fetchVideoStats(v.url)
        db.prepare(
          `UPDATE videos SET views=?, likes=?, comments=?, published_at=?, last_fetched=datetime('now') WHERE id=?`,
        ).run(s.views, s.likes, s.comments, s.published_at || v.published_at, v.id)
      } catch (e) {
        // 单条失败跳过（下架 / 限流 / 网络抖动），仅记录便于排查
        console.warn(`[dailyRefresh] 视频 ${v.id} 抓取失败:`, String(e))
      }
    }
  } catch (err) {
    // 自动任务失败不应中断应用（如离线 / B 站限流），仅记录
    console.warn('[dailyRefresh] 失败:', String(err))
  }
}

app.whenReady().then(async () => {
  await initDb()
  closeToTray = !!readUiPref().closeToTray
  createWindow()
  if (closeToTray) {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) ensureTray(win)
  }
  await dailyRefresh()
  // 每日自动抓取：24h 周期，避免阻塞启动
  setInterval(dailyRefresh, 24 * 60 * 60 * 1000)
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
