# TimeBox

一款专为深度工作设计的**并行任务计时器** Android App，支持多任务同时计时、全局悬浮窗、屏幕使用分析与日报生成。

---

## 功能特性

- **并行计时** — 同时运行多个任务计时器，随时暂停/恢复
- **全局悬浮窗** — 离开 App 后悬浮窗持续显示计时，可随时唤起
- **任务分类与标签** — 工作/学习/生活/琐事/睡觉五大分类，支持四象限评估标签
- **时间轴** — 可视化当天任务甘特图 + 屏幕使用时间轴（双列并排）
- **日报** — 自动生成每日总结，含工时统计、屏幕使用、推测睡眠、待办完成情况
- **待办清单** — 带优先级与分类的 Todo 管理
- **工作记录** — 历史会话浏览、编辑、筛选、CSV 导出
- **手动记录** — 补录历史时间段，支持评估标签
- **使用指南** — App 内置文档，顶栏图标一键打开
- **IndexedDB 持久化** — 本地数据存储，无需网络

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS + CSS-in-JS |
| 动画 | Motion (Framer Motion) |
| 图表 | Recharts |
| 原生桥接 | Capacitor 6 |
| Android 原生 | Java — FloatingService (WindowManager overlay, WakeLock) |
| 数据库 | IndexedDB (activitywatch-client) |

---

## 项目结构

```
src/app/
├── context/
│   └── AppContext.tsx          # 全局状态、计时逻辑、FloatingWindow 桥接
├── components/
│   ├── Dashboard.tsx           # 计时主页
│   ├── Timeline.tsx            # 时间轴（任务 + 屏幕使用双列）
│   ├── Worklog.tsx             # 数据审查页
│   ├── DailyReportDialog.tsx   # 日报弹窗
│   ├── GuideModal.tsx          # 使用指南
│   ├── ManualSessionDialog.tsx # 手动记录
│   ├── EndTaskDialog.tsx       # 结束任务
│   └── ScreenUsageTimeline.tsx # 屏幕使用甘特图
android/app/src/main/java/com/timebox/app/
├── FloatingService.java        # 悬浮窗 Service（WindowManager + 前台通知）
└── MainActivity.java           # Capacitor 桥接插件 (FloatingPlugin)
```

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动 Web 预览
npm run dev

# 构建 + 同步到 Android
npm run build
npx cap sync android

# 用 Android Studio 打开（需要 JDK 17+）
npx cap open android
```

### 环境要求

- Node.js 18+
- Android Studio (含 JDK)
- Android SDK API 26+
- 真机调试建议关闭电池优化、开启悬浮窗权限与使用情况访问权限

---

## Android 权限说明

| 权限 | 用途 |
|---|---|
| `SYSTEM_ALERT_WINDOW` | 全局悬浮窗 |
| `FOREGROUND_SERVICE` | 保活计时 Service |
| `WAKE_LOCK` | 防止后台计时被系统杀死 |
| `PACKAGE_USAGE_STATS` | 屏幕使用时间分析（需手动授权） |

---

## 数据存储

所有数据存储在本地 IndexedDB，分三个 bucket：

- `timebox-tasks` — 进行中的任务
- `timebox-sessions` — 已完成的工作记录
- `timebox-todos` — 待办事项

---

## License

MIT
