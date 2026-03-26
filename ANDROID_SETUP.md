# Capacitor Android 权限配置指南

## 在 `android/app/src/main/AndroidManifest.xml` 中添加以下权限

在 `<manifest>` 标签内、`<application>` 标签前，手动插入：

```xml
<!-- 悬浮窗权限 -->
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>

<!-- 前台服务权限（计时器后台运行） -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>

<!-- 网络（如需远程同步，可选） -->
<uses-permission android:name="android.permission.INTERNET"/>
```

## 初始化 Capacitor 步骤

```bash
# 1. 安装 Capacitor
npm install @capacitor/core @capacitor/cli

# 2. 初始化 Capacitor
npx cap init TimeBox com.timebox.app

# 3. 构建 Web 资产
npm run build

# 4. 添加 Android 平台
npm install @capacitor/android
npx cap add android

# 5. 同步并打开 Android Studio
npx cap sync
npx cap open android
```

## 悬浮窗插件（可选）

```bash
npm install capacitor-floating-bubble
npx cap sync
```

然后在前端代码中使用:
```typescript
import { FloatingBubble } from 'capacitor-floating-bubble';

// 显示悬浮窗
await FloatingBubble.show({ text: '00:45:23' });

// 隐藏
await FloatingBubble.hide();
```
