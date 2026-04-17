# TimeBox — 开发日志

> 最后更新：2026-04-15
> 当前状态：AI 助手集成完成，待稳定性调优

---

## 项目简介

TimeBox 是一个专为 Honor 荣耀手机设计的并行任务计时 App，帮助用户记录时间、分析效率、管理点子和待办。

- **包名**: `com.timebox.app`
- **平台**: Capacitor 8 → Android 原生 Java
- **前端**: React 18 + TypeScript + Vite 6 + Tailwind CSS v4
- **存储**: IndexedDB（`src/app/services/db.ts`，当前版本 v4）
- **AI**: 阿里百炼平台（DashScope），兼容 OpenAI 格式

---

## 目录结构

```
Download Dashboard Screens/
├── CLAUDE.md                        # Claude Code 开发规范（构建流程、架构要点）
├── DEVLOG.md                        # 本文件
├── vite.config.ts
├── capacitor.config.ts
├── android/                         # Android 原生代码
│   └── app/src/main/java/com/timebox/app/
│       ├── MainActivity.java        # Capacitor 插件（FloatingPlugin）
│       └── FloatingService.java     # 前台服务（悬浮窗计时，~900行）
└── src/
    ├── main.tsx
    ├── styles/
    │   ├── index.css
    │   ├── tailwind.css
    │   ├── fonts.css
    │   └── theme.css
    └── app/
        ├── App.tsx                  # 路由入口
        ├── routes.ts                # 路由配置
        ├── context/
        │   └── AppContext.tsx       # 全局状态（核心，~1650行）
        ├── services/
        │   ├── db.ts                # IndexedDB 封装（v4）
        │   ├── ai.ts                # AI 服务层（DashScope 统一调用）
        │   ├── ai-prompts.ts        # AI Prompt 模板（6个能力）
        │   └── exportCSV.ts         # CSV 导出
        └── components/
            ├── Layout.tsx           # 顶栏 + 底部导航
            ├── Dashboard.tsx        # 首页（计时卡片 + AI 命令栏 + 洞察卡片）
            ├── Timeline.tsx         # 24h 时间轴（支持并行任务列布局）
            ├── Worklog.tsx          # 历史记录（数据审查）
            ├── TodoPage.tsx         # 待办（归档支持）
            ├── AppBucketsPage.tsx   # 应用桶配置
            ├── ScreenUsageTimeline.tsx  # 手机使用时间线
            ├── AICommandBar.tsx     # AI 自然语言命令栏（含停止按钮）
            ├── AIInsightCard.tsx    # AI 洞察卡片（结构化报告渲染）
            ├── AISettings.tsx       # AI 设置（API Key + 模型选择）
            ├── DailyReportDialog.tsx
            ├── EndTaskDialog.tsx
            ├── ManualSessionDialog.tsx  # 手动记录（支持自定义开始时间 + evalTag）
            ├── NewTaskDialog.tsx
            ├── NewLongTaskDialog.tsx
            ├── GuideModal.tsx       # 使用指南
            ├── FloatingWidget.tsx
            ├── ideas/
            │   ├── IdeaHub.tsx      # 点子管理主页（inbox/active/completed/archived）
            │   ├── IdeaCard.tsx     # 点子卡片（长按菜单，生命周期操作）
            │   ├── IdeaDetail.tsx   # 点子详情页
            │   ├── EvaluationSheet.tsx  # 点子评估面板
            │   ├── MilestoneSection.tsx # 里程碑
            │   ├── QuickCapture.tsx     # 快速捕获
            │   └── TaskItem.tsx         # 点子子任务
            └── ui/                  # shadcn/Radix 基础组件（不要修改）
```

---

## 数据模型（AppContext 核心类型）

| 类型 | 说明 | 持久化 Store |
|------|------|------|
| `Task` | 计时任务（可并行运行） | `timebox-tasks` |
| `WorkSession` | 已完成的计时记录 | `timebox-sessions` |
| `LongTask` | 长线任务（累计计时） | `timebox-long-tasks` |
| `Idea` | 点子（inbox→active→completed/archived） | `timebox-ideas` |
| `Todo` | 待办（支持归档） | `timebox-todos` |
| `AppBucket` | 应用桶配置（手机 App 归类） | `timebox-buckets` |
| `BucketDetection` | 桶检测结果（已确认/跳过） | localStorage key |
| `AIConfigRecord` | AI 配置（provider/key/model） | `aiConfig` store |
| `AIInsight` | AI 生成的洞察/报告 | `aiInsights` store |

### IndexedDB 版本历史
- v1: tasks, sessions
- v2: longTasks, ideas, todos
- v3: buckets, BucketDetection 辅助数据
- **v4（当前）**: aiConfig, aiInsights

---

## 功能模块完成度

### 计时核心
- [x] 并行多任务计时（无上限）
- [x] 悬浮窗同步显示（FloatingService 前台服务）
- [x] 睡眠自动检测（间隔过长时暂停）
- [x] 手动补录记录（自定义开始时间 + evalTag 评价标签）
- [x] 24h 时间轴可视化（并行任务列布局）

### 应用桶检测
- [x] 读取 Android UsageEvents（`getUsageEvents` 原生接口）
- [x] 事后回溯模式（扫描最近3天）+ 实时监控模式
- [x] 用户确认→创建 WorkSession 补录；忽略→标记跳过
- [x] 去重防止重复弹出（localStorage key）

### 点子系统
- [x] 生命周期：inbox → active → completed / archived
- [x] 评估面板（可行性/必要性/影响力评分）
- [x] 里程碑和子任务
- [x] 标签自动补全
- [x] 计时联动（从点子详情发起计时）
- [x] IdeaCard 长按菜单（归档/恢复/删除）

### 待办
- [x] 优先级（high/medium/low）+ 分类
- [x] 归档已完成

### AI 助手（2026-04 新增）
- [x] 统一 AI 服务层（`ai.ts`）— 阿里百炼平台，5个模型可选
- [x] 数据快照收集器（`collectSnapshot`）— 序列化 App 状态供 prompt 使用
- [x] 6套 Prompt 模板（时间分析、点子助手、日报、周报、自然语言操作、自动洞察）
- [x] 日报支持任意历史日期（近7天日期选择器）
- [x] 自然语言命令执行（CREATE_TASK / CREATE_IDEA / CREATE_TODO / GENERATE_REPORT / ANALYZE_TIME）
- [x] AI 洞察卡片（结构化报告渲染，支持展开查看）
- [x] 30秒超时自动中断 + 手动停止按钮
- [x] Qwen3 系列自动关闭 thinking 模式（避免长时间等待）
- [ ] 自动洞察后台触发（配置已有，触发逻辑待完善）
- [ ] 点子助手结构化结果（AI 返回的 split_tasks 暂未渲染到 IdeaDetail）

### 数据导出
- [x] CSV 导出（WorkSession 全量）

---

## AI 服务架构

```
用户操作
  ↓
AICommandBar.tsx          — 自然语言输入 + 快捷日期选择日报
  ↓
AppContext.tsx             — executeNLCommand / generateDailyReport / analyzeTime
  ↓
ai-prompts.ts             — buildXxxMessages() 构建 prompt
  ↓
ai.ts → callAI()          — fetch POST DashScope API（含 AbortController 超时/取消）
  ↓
AIInsightCard.tsx         — 渲染 AI 返回的 JSON 报告
```

### 支持的模型（均通过阿里百炼平台，同一 API Key）
| 模型ID | 显示名 | 特点 |
|--------|--------|------|
| `glm-5.1` | GLM-5.1 | 推荐，综合性能强 |
| `kimi-2.5` | Kimi 2.5 | 长文本理解好 |
| `qwen3-plus` | Qwen3 Plus | 阿里自研，自动关闭 thinking |
| `qwen3-turbo` | Qwen3 Turbo | 省钱版，自动关闭 thinking |
| `qwen-max` | Qwen Max | 性能最强，费用较高 |

---

## JS ↔ 原生通信接口

通过 `registerPlugin<any>("FloatingWindow")` 注册，JS 调用形式：`FloatingWindow.方法名({ 参数 })`

| 方法 | 说明 | 重要性 |
|------|------|------|
| `getUsageEvents` | 获取手机 UsageEvents（桶检测核心） | **不可删除** |
| `getUsageStats` | 获取使用统计 | 重要 |
| `startFloating` | 启动悬浮窗服务 | 重要 |
| `stopFloating` | 停止悬浮窗 | 重要 |
| `removeTask` | 从悬浮窗移除任务 | 重要 |
| `getStatus` | 查询服务状态 | 辅助 |
| `getActiveTasks` | 获取活跃任务列表 | 辅助 |
| `checkPermission` | 检查悬浮窗权限 | 辅助 |
| `requestPermission` | 请求权限 | 辅助 |
| `getDiagnosticInfo` | 诊断信息 | 调试 |

---

## 构建流程

```bash
cd "/Users/chensihan/Downloads/Download Dashboard Screens"

# 1. 前端构建
npx vite build

# 2. 同步到 Android
npx cap sync android

# 3. 编译 APK
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug

# 4. 安装（手机需 USB 连接 + 信任调试）
/Users/chensihan/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 5. 重启
/Users/chensihan/Library/Android/sdk/platform-tools/adb shell am force-stop com.timebox.app
/Users/chensihan/Library/Android/sdk/platform-tools/adb shell am start -n com.timebox.app/.MainActivity
```

**APK 输出路径**: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 已知问题 / 待处理

| 问题 | 优先级 | 描述 |
|------|--------|------|
| AI 响应偶发卡死 | 高 | 已加 30s 超时 + 停止按钮，根因可能是模型 thinking 模式，GLM/Kimi 待排查 |
| 点子助手结构化输出未渲染 | 中 | AI 返回 split_tasks JSON 后，未自动写入 IdeaDetail 的子任务列表 |
| 自动洞察未触发 | 低 | `enableAutoInsights` 配置存在但 App 启动时触发逻辑未接入 |
| APK 安装需手动允许 | 低 | Honor 设备 USB 安装每次需手机端确认，无法绕过 |

---

## 开发规范（给其他 IDE 的提示）

1. **AppContext.tsx 是核心**：所有状态都在这里，修改前务必通读相关段落，理解 `ref` / `state` / `useCallback` 依赖链
2. **ui/ 目录不要动**：shadcn/Radix 自动生成的基础组件
3. **样式用内联 style 优先**：深色主题颜色值多，`className` 仅用于布局工具类
4. **中文注释和文案**：用户界面全中文
5. **不加 emoji**：除非用户要求
6. **改动后必须完整构建**：vite build → cap sync → gradle → adb install，四步缺一不可
7. **永远不要删除 `getUsageEvents`**：桶检测依赖此原生接口
8. **AI 调用统一走 `callAI()`**：不要绕过，它处理超时、取消、Qwen3 thinking 等边界情况
