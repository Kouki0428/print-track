import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'

// 注入应用版本号（渲染端通过 __APP_VERSION__ 使用，避免多处硬编码）
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
  },
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts',
        // better-sqlite3 是原生 CJS 模块，必须作为外部依赖交给 Electron 的 Node 直接加载，
        // 不能被 rollup 打包进主进程（打包会破坏其 CJS 运行环境，导致 __filename is not defined）。
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
            },
          },
        },
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
