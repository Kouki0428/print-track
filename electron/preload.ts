import { contextBridge, ipcRenderer } from 'electron'

// 渲染端通过 window.db 访问，主进程统一代理 SQLite，保证 contextIsolation 安全
contextBridge.exposeInMainWorld('db', {
  query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
  run: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:run', sql, params),
  get: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),
})

contextBridge.exposeInMainWorld('app', {
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
})

// 视频链接抓取（B站 / YouTube）
contextBridge.exposeInMainWorld('video', {
  fetchStats: (url: string, youtubeKey?: string) => ipcRenderer.invoke('video:fetchStats', url, youtubeKey),
})
