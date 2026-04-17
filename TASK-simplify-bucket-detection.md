# 任务：停用原生后台桶监控，仅保留应用内 retrospective 补录

## 项目路径
```
/Users/chensihan/Downloads/Download Dashboard Screens/
```

## 背景
TimeBox 是一个 Capacitor Android 应用（Ionic/React + 原生 Java）。其中有一个"应用桶"功能：监控用户使用特定 app 的时长，超过阈值后提醒用户记录。

当前有**两条检测路径**：
1. **原生后台监控**（应用外提醒）：`FloatingService` → `BucketMonitorManager` 每60s轮询 UsageStats → `BucketAlertHelper` 弹悬浮overlay → `PendingBucketConfirm` → JS 3s 轮询消费 — **要删除**
2. **JS 前台检测**（应用内提醒）：用户打开 App 时 `AppContext.tsx` useEffect 扫描 UsageStats → `setBucketDetection` → Dashboard 中的 `BucketDetectionBanner` 横幅 — **保留，仅 retrospective 补录模式**

**用户决定：停用路径1（原生后台监控），只保留路径2（应用内提醒），且只保留 retrospective 补录模式（不再启动实时计时）。**

## 需要执行的变更

### 1. 删除原生文件
- **删除** `android/app/src/main/java/com/timebox/app/BucketMonitorManager.java`
- **删除** `android/app/src/main/java/com/timebox/app/BucketAlertHelper.java`

### 2. 修改 `android/app/src/main/java/com/timebox/app/FloatingService.java`（约905行）
- 删除字段 `bucketMonitor`、`bucketAlert`（第48-49行附近）
- 删除 `PendingBucketConfirm` 内部类（第52-79行附近）及 `pendingBucketConfirm` 静态字段
- `onCreate()` 中删除 `bucketMonitor` 和 `bucketAlert` 初始化代码块（包括 `OnBucketTriggered` 回调 lambda）
- `onStartCommand()` 中删除以下 action 分支：
  - `START_MONITOR`
  - `STOP_MONITOR`  
  - `BUCKET_ALERT`
  - `DISMISS_BUCKET_ALERT`
- `onStartCommand()` null intent 分支中删除 `bucketMonitor.loadBucketsFromPrefs()` 恢复逻辑
- `STOP` action 中删除 `bucketAlert.remove()` 调用
- `onDestroy()` 中删除 `bucketMonitor.stop()` 和 `bucketAlert.remove()`
- 删除 `maybeStopIfIdle()` 方法
- ticker 中 `bucketAlert == null || !bucketAlert.isShowing()` 改回简单逻辑（没有 alert 显示时直接判定为无 alert）
- `addLog()` 公共方法可以保留（无害）

### 3. 修改 `android/app/src/main/java/com/timebox/app/MainActivity.java`（约835行）
- 删除 `updateBucketMonitor` PluginMethod（第360-421行附近）
- 删除 `showBucketAlert` PluginMethod（第423-444行附近）
- 删除 `dismissBucketAlert` PluginMethod（第446-461行附近）
- 删除 `getPendingBucketConfirm` PluginMethod（第463-484行附近）
- **保留** `getUsageEvents` PluginMethod（JS 前台检测需要它）

### 4. 修改 `src/app/context/AppContext.tsx`（约1094行）
- 删除 `consumePendingBucketConfirm` 回调（第429-468行）
- 删除 visibilitychange 里调用 `consumePendingBucketConfirm` 的逻辑（第470-480行）
- 删除 3s 轮询 `consumePendingBucketConfirm` 的 useEffect（第483-487行）
- 删除 `pushBucketsToMonitor` 函数（第858-868行）
- `addBucket`/`updateBucket`/`deleteBucket` 中删除 `pushBucketsToMonitor(next)` 调用
- 初始化 useEffect 中（第582-584行附近）删除 `FloatingWindow.updateBucketMonitor` 调用
- **桶检测 useEffect**（第641行开始）：统一 mode 为 `"retrospective"`，删除 realtime 判断逻辑
- **`confirmBucketDetection`**（第898行开始）：删除 realtime 分支（创建 Task + 启动浮窗），只保留 retrospective 补录（创建 WorkSession）
- **`dismissBucketDetection`**（第937行附近）：删除 `FloatingWindow.dismissBucketAlert` 调用
- 删除所有 `FloatingWindow.showBucketAlert` 调用

### 5. 修改 `src/app/components/Dashboard.tsx`
- `BucketDetectionBanner` 中：统一文案为补录模式（去掉 realtime 的"检测到"/"开始计时"措辞，统一为"使用记录"补录提示）
- 按钮文案统一为"记录使用"，而非"确认计时 →"

## 不变的部分（不要动）
- 桶配置的 CRUD（`addBucket`/`updateBucket`/`deleteBucket` 的本地状态管理和事件持久化）
- `BucketDetectionBanner` 组件本身（只改文案）
- `getUsageEvents` 原生方法
- 计时浮窗功能（FloatingService 的 ticker、createFloatingView、rebuildTaskRows 等）
- `BucketDetection` interface（保留但 `mode` 字段实际只会是 `"retrospective"`）

## 构建命令
```bash
cd "/Users/chensihan/Downloads/Download Dashboard Screens/android"
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

## ADB 部署（Honor 设备需要 USB 安装权限）
```bash
/Users/chensihan/Library/Android/sdk/platform-tools/adb install -r "/Users/chensihan/Downloads/Download Dashboard Screens/android/app/build/outputs/apk/debug/app-debug.apk"
/Users/chensihan/Library/Android/sdk/platform-tools/adb shell am force-stop com.timebox.app
/Users/chensihan/Library/Android/sdk/platform-tools/adb shell am start -n com.timebox.app/.MainActivity
```

## Git
改完后执行：
```bash
cd "/Users/chensihan/Downloads/Download Dashboard Screens"
git add -A && git commit -m "simplify: 停用原生后台桶监控，仅保留应用内 retrospective 补录"
```
