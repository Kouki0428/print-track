# PrintTrack —— 3D 打印 / 3D 建模 / 自定义项目进度管理

一款本地优先的桌面应用，统一管理你的 3D 打印、3D 建模与自定义项目：从筹划、设计到制作完成，配合排期提醒、打印记录与 B 站视频数据统计。

技术栈：Electron + Vue 3 + TypeScript + Vite + Pinia + SQLite（better-sqlite3）。

## 功能特性

### 项目管理
- 三类项目统一管理：3D 打印 / 3D 建模 / 其它（支持自定义类型）
- 六种状态流转：筹划中 → 设计中 → 制作中 → 完成；逾期自动标红（依据排期结束日）；失败终态
- 子项目归属与完成进度条，卡片悬停即可改状态 / 编辑 / 删除

### 规划与追踪
- 进度板看板：拖拽卡片换列即改状态，打印记录增删 + 起止时间校验
- 时间线排期：周刻度甘特视图、「今天」竖线高亮、一键回到今天、色条点击直接编辑
- 仪表盘：状态分布、即将截止提醒、本月打印次数与成功率、最近打印 / 最近更新

### 数据与内容
- B 站视频统计：粘贴链接自动抓取播放 / 点赞 / 评论，每日自动刷新，按作品聚合汇总
- 作品详情：改名、调色盘关联耗材颜色（多色）、关联视频展示
- 数据安全：数据库一键备份（.db）、项目清单导出 CSV（Excel 中文兼容）

### 体验细节
- 深浅双主题，可跟随系统切换，启动零闪白
- `Ctrl+K` 全局快速搜索：项目直达、页面跳转
- 快捷键：`1`–`5` 切换页面 · `N` 新建 · `Enter` 提交表单
- Toast 操作反馈、样式化确认弹窗、骨架屏加载、细腻动效（尊重系统减弱动效设置）

## 快速开始（Windows）

```cmd
cd /d E:\下载\3D打印作品进度管理软件\print-track
npm install
npm run rebuild    :: 为 Electron 重建 better-sqlite3 原生模块（首次必跑）
npm run dev        :: 启动桌面窗口（开发端口固定 5190）
```

> 若启动时弹出「数据库初始化失败」，通常是漏跑了 `npm run rebuild`。

## 构建与打包

```cmd
npm run build      :: 构建渲染端 + 主进程（dist + dist-electron）
npm run typecheck  :: vue-tsc 类型检查
npm run dist       :: electron-builder 打包分发版
```

## 数据说明

- 数据库位于系统用户数据目录下的 `print-track.db`，完全离线可用
- 表结构：works / print_jobs / filaments / videos / schedule + meta
- 迁移策略：`PRAGMA table_info` 探测后 `ALTER TABLE`（兼容旧库升级）
- 备份与导出入口在「设置」页

## 版本管理

- 远程仓库：`git@github.com:Kouki0428/print-track.git`（SSH 协议）
- `.gitignore` 已忽略 `node_modules`、`dist`、`dist-electron`、`*.db` 等
- 日常提交：

```cmd
git add .
git commit -m "改动说明"
git push
```

## 当前版本

**v0.1.0**
