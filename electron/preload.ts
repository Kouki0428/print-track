import { contextBridge, ipcRenderer } from 'electron'

// 渲染端通过 window.db 访问，主进程统一代理 SQLite，保证 contextIsolation 安全
contextBridge.exposeInMainWorld('db', {
  query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
  run: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:run', sql, params),
  get: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),
})

contextBridge.exposeInMainWorld('app', {
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  backupDatabase: () => ipcRenderer.invoke('app:backup-db'),
  saveTheme: (t: string) => ipcRenderer.invoke('app:save-theme', t),
  exportCsv: (filename: string, csv: string) => ipcRenderer.invoke('app:export-csv', filename, csv),
})

// 视频链接抓取（仅哔哩哔哩）
contextBridge.exposeInMainWorld('video', {
  fetchStats: (url: string) => ipcRenderer.invoke('video:fetchStats', url),
})
