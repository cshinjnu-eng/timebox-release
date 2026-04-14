# TimeBox — 开发规则

## 项目概述
TimeBox 是一个 Capacitor Android 应用（React + Vite + Tailwind CSS + 原生 Java），用于并行任务计时、时间记录和数据分析。

- **包名**: `com.timebox.app`
- **Web 框架**: React 18 + TypeScript + Vite
- **样式**: Tailwind CSS v4 + 内联 style（深色主题，背景 `#0B0D14`）
- **UI 组件**: Radix UI + Lucide Icons + Motion (framer-motion)
- **移动端**: Capacitor 8 → Android 原生 Java
- **数据存储**: IndexedDB（通过 `src/app/services/db.ts`）
- **设备**: 主要在 Honor 荣耀手机上使用

## 目录结构

```
src/
├── app/
│   ├── App.tsx                    # 入口，路由
│   ├── context/AppContext.tsx      # 全局状态（核心，约1000行）
│   ├── components/
│   │   ├── Dashboard.tsx           # 首页：计时卡片、桶检测横幅
│   │   ├── Timeline.tsx            # 24h 时间轴
│   │   ├── Worklog.tsx             # 历史记录
│   │   ├── TodoPage.tsx            # 待办
│   │   ├── AppBucketsPage.tsx      # 应用桶配置
│   │   ├── ScreenUsageTimeline.tsx  # 手机使用时间线
│   │   ├── Layout.tsx              # 底部导航
│   │   ├── *Dialog.tsx             # 各种对话框
│   │   └── ui/                     # shadcn/Radix 基础组件（不要修改）
│   ├── services/
│   │   ├── db.ts                   # IndexedDB 封装
│   │   └── exportCSV.ts           # CSV 导出
│   └── routes.ts
├── styles/                         # CSS 文件
└── main.tsx

android/app/src/main/java/com/timebox/app/
├── MainActivity.java    # Capacitor 插件（FloatingPlugin）
└── FloatingService.java  # 前台服务（悬浮窗计时）
```

## 架构要点

### 状态管理
- 所有状态集中在 `AppContext.tsx`，通过 `useApp()` hook 访问
- 数据模型：`Task`（计时中）、`WorkSession`（已完成记录）、`LongTask`（长线任务）、`AppBucket`（应用桶配置）、`BucketDetection`（桶检测结果）
- 持久化：IndexedDB，bucketId 分桶存储（`timebox-tasks`、`timebox-sessions` 等）

### JS ↔ 原生通信
- 通过 `registerPlugin<any>("FloatingWindow")` 注册
- JS 调用：`FloatingWindow.方法名({ 参数 })`
- 原生实现在 `MainActivity.java` 的 `FloatingPlugin` 内部类
- 关键原生方法（不要删除）：
  - `getUsageEvents` — 获取手机使用事件（桶检测依赖）
  - `getUsageStats` — 获取使用统计
  - `startFloating` / `stopFloating` / `removeTask` — 悬浮窗控制
  - `getStatus` / `getActiveTasks` — 服务状态查询
  - `checkPermission` / `requestPermission` — 悬浮窗权限
  - `getDiagnosticInfo` — 诊断信息

### 应用桶检测（retrospective 补录模式）
- 用户打开 App 时扫描最近3天的 UsageEvents
- 匹配桶配置中的 App 名称，合并间隔 ≤ toleranceSeconds 的片段
- 累计未确认片段总时长 ≥ triggerMinutes 时显示横幅
- 用户确认 → 创建 WorkSession 补录；忽略 → 标记该片段跳过
- 去重 key：`bucket_seg_{bucketId}_{startTimestamp}` 存在 localStorage

## 构建与部署

### 完整构建流程（每次修改后必须按顺序执行）
```bash
cd "/Users/chensihan/Downloads/Download Dashboard Screens"

# 1. 前端构建
npx vite build

# 2. 同步到 Android
npx cap sync android

# 3. 编译 APK
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug

# 4. 安装到设备（Honor 设备需要用户在手机上点击允许）
/Users/chensihan/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# 5. 重启应用
/Users/chensihan/Library/Android/sdk/platform-tools/adb shell am force-stop com.timebox.app
/Users/chensihan/Library/Android/sdk/platform-tools/adb shell am start -n com.timebox.app/.MainActivity
```

### 快捷一行构建（不含安装）
```bash
cd "/Users/chensihan/Downloads/Download Dashboard Screens" && npx vite build && npx cap sync android && cd android && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

### APK 输出位置
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Honor 设备注意事项
- ADB 安装需要用户在手机上手动确认「允许安装」弹窗
- 如果安装失败报 `INSTALL_FAILED_ABORTED: User rejected permissions`，需要用户去 **设置 → 系统和更新 → 开发者选项 → 通过USB安装应用** 打开开关
- 悬浮窗权限需要手动授予
- WakeLock 用于防止 CPU 休眠杀计时器
- 电池优化需要关闭（否则后台服务可能被杀）

## 开发规范

### 代码风格
- React 组件使用函数式 + hooks
- 状态操作用 `useCallback` 包裹
- 内联 style 优先于 className（因为深色主题的颜色值较多）
- 中文注释和用户界面文案
- 不使用 emoji（除非用户明确要求）

### 修改原则
- **AppContext.tsx 是核心**：修改前务必通读相关段落，理解 ref / state / callback 的依赖关系
- **ui/ 目录不要动**：这些是 shadcn 基础组件
- **原生代码改动后必须重新走完整构建流程**（vite build → cap sync → gradle → adb install）
- **只改 JS/TSX 时**也需要 vite build + cap sync + gradle（因为是打包进 APK 的）
- **永远不要删除 `getUsageEvents`**：桶检测的前台检测依赖它

### Git 提交
```bash
cd "/Users/chensihan/Downloads/Download Dashboard Screens"
git add -A && git commit -m "描述"
```

### 常见调试
- 查看原生日志：`adb logcat -s TimeBox.Float TimeBox.Plugin`
- 查看设备连接：`adb devices`
- 检查 APK 是否最新：看 gradle 输出的 `executed` 数量，如果全是 `up-to-date` 说明没有变化
