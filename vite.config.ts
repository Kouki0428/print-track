import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        input: 'electron/preload.ts',
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 固定 dev 端口，避开 5173（你的 acgn-records 项目常驻该端口），减少端口冲突导致的白屏
  server: {
    port: 5190,
    strictPort: false,
  },
  build: {
    // 关闭「构建前清空输出目录」：部分沙箱环境的回收站机制会拦截 rm，导致 emptyDir 失败。
    // 若在本机使用该模板，可改回默认（删除该行）以获得干净产物。
    emptyOutDir: false,
  },
})
