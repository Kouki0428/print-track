# PrintTrack —— 3D 打印 / 3D 建模 / 自定义项目进度管理

桌面应用：Electron + Vue3 + TypeScript + Vite + Pinia + 本地 SQLite（better-sqlite3）。

## 功能模块
- **统一项目管理**：3D 打印 / 3D 建模 / 其它（含自定义类型）三类项目，侧边栏一键切换过滤
- **仪表盘**：数字滚动统计、状态分布图（点击直达筛选）、即将截止提醒、最近打印 / 最近更新
- **作品库**：CRUD、搜索、状态筛选、排序；卡片悬停快捷改状态/删除；详情内改名、调色盘关联耗材颜色、关联视频展示
- **进度板**：6 态看板（筹划中/设计中/制作中/完成/逾期/失败），**拖拽换列**即改状态；打印记录增删 + 起止时间校验
- **时间线**：周刻度甘特排期，今天竖线高亮，超期自动标红并联动全局状态；色条点击可编辑排期
- **视频统计**：仅哔哩哔哩，粘贴链接自动抓取播放/点赞/评论；每日自动抓取 + 手动全量/单条刷新
- **通用**：`Ctrl+K` 全局快速搜索（项目/页面直达）、深浅双主题（可跟随系统、启动不闪白）、Toast 反馈、确认弹窗、快捷键 `1`–`5` 切页 / `N` 新建、时间线一键回到今天、数据库一键备份、项目清单导出 CSV

## 运行（Windows）
```cmd
cd /d E:\下载\3D打印作品进度管理软件\print-track
npm install
npm run rebuild    :: 为 Electron 重建 better-sqlite3 原生模块（首次必跑）
npm run dev        :: 启动桌面窗口（端口固定 5190，避免常见占用冲突）
```
> 若弹出「数据库初始化失败」，通常是没跑 `npm run rebuild`。

## 构建与发布
```cmd
npm run build      :: 出 dist + dist-electron
npm run typecheck  :: vue-tsc 类型检查
npm run dist       :: 打包为可分发的 exe（electron-builder）
```

## 数据库
- 位置：应用用户数据目录下的 `print-track.db`（自动创建，离线可用）。
- 模型：works / print_jobs / filaments / videos / schedule + meta。
- 迁移：用 `PRAGMA table_info` 探测后再 `ALTER`（better-sqlite3 不支持 `IF NOT EXISTS`）。
- 备份：设置 → 「备份数据库」，选择保存位置即可导出 `.db` 文件。

## 版本管理
- 远程仓库：`git@github.com:yhq1845769/print-track.git`（SSH 协议）。
- `.gitignore` 已忽略 `node_modules`、`dist`、`dist-electron`、`*.db` 等。
- 日常提交：
```cmd
git add .
git commit -m "你的改动说明"
git push
```
