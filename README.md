# PrintTrack —— 3D 打印作品进度管理与规划

桌面应用：Electron + Vue3 + TypeScript + Vite + Pinia + 本地 SQLite（better-sqlite3）。

## 功能模块
- 仪表盘：作品数、在制/完成、售卖收益概览
- 作品库：CRUD + 搜索 + 状态切换 + 设计来源/子项目/源文件/重量/时长/售价
- 进度板：五态看板（设计中/切片中/打印中/完成/失败）+ 打印记录（自动扣减耗材）
- 时间线：周刻度甘特式排期（开始/结束/优先级）
- 耗材：库存管理、入库、剩余量调整
- 视频统计：按作品聚合各平台播放/点赞/评论
- 设置：数据存储说明与数据概览

## 运行（Windows CMD）
```cmd
cd E:\下载\3D打印作品进度管理软件\print-track
npm install
npm run rebuild    :: 为 Electron 重建 better-sqlite3 原生模块（首次必跑）
npm run dev        :: 启动桌面窗口
```
> 首次会用 `npm run rebuild`（electron-rebuild）为 Electron 重建原生模块，否则运行时报 ABI 错误。

## 构建与发布
```cmd
npm run build      :: 出 dist + dist-electron（含 vite build，已禁用 emptyOutDir 以避免清理被拦截）
npm run typecheck  :: vue-tsc 类型检查
npm run dist       :: 打包为可分发的 exe（electron-builder）
```

## 数据库
- 位置：应用用户数据目录下的 `print-track.db`（自动创建，离线可用）。
- 模型：works / print_jobs / filaments / videos / schedule + meta。
- 迁移：better-sqlite3 不支持 `ALTER ... IF NOT EXISTS`，统一用 `PRAGMA table_info` 探测后再 `ALTER`。

## 版本管理（已初始化 Git）
- 仓库已建在 `print-track/` 目录，分支 `main`。
- `.gitignore` 已忽略 `node_modules`、`dist`、`dist-electron`、`*.db`。
- 日常提交：
```cmd
git add .
git commit -m "你的改动说明"
```
- 已配置提交身份：`yhq1845769 / yhq184@outlook.com`，`autocrlf=true`（Windows 换行）。
