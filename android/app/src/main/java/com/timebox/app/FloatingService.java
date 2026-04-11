package com.timebox.app;

import android.app.ActivityManager;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.pm.PackageManager;
import android.os.Process;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

public class FloatingService extends Service {
    private static final String TAG = "TimeBox.Float";
    private static final String CHANNEL_ID = "floating_timer_channel";
    private static final int NOTIFICATION_ID = 101;

    private static final int MAX_DEBUG_LOGS = 200;
    private static final int DIAGNOSTIC_LOG_INTERVAL = 30; // 每 30 tick (30秒) 输出一次诊断

    // ── 桶配置（JS → 原生，供后台监控使用） ────────────────────
    public static class BucketConfig {
        public String id;
        public String name;
        public List<String> apps; // display names (lower-cased for matching)
        public int triggerMinutes;
        public int toleranceSeconds;
        public String color;

        BucketConfig(String id, String name, List<String> apps,
                     int triggerMinutes, int toleranceSeconds, String color) {
            this.id = id; this.name = name; this.apps = apps;
            this.triggerMinutes = triggerMinutes;
            this.toleranceSeconds = toleranceSeconds;
            this.color = color;
        }
    }

    // 静态桶配置（从 JS 更新）
    static final List<BucketConfig> monitorBuckets = new CopyOnWriteArrayList<>();
    // 今日已触发过的桶id（跨启动用 SharedPreferences 持久化，这里内存缓存）
    static final List<String> firedTodayBuckets = new CopyOnWriteArrayList<>();
    static volatile String firedTodayDate = "";

    // ── 待确认桶检测（原生确认按钮 → JS 消费） ─────────────────
    public static class PendingBucketConfirm {
        public String bucketId;
        public String bucketName;
        public String category;
        public String evalTag;
        public String color;
        public int detectedMinutes;
        public long trueStart;
        public long trueEnd;
        public String mode; // "realtime" or "retrospective"

        PendingBucketConfirm(String bucketId, String bucketName, String category,
                             String evalTag, String color, int detectedMinutes,
                             long trueStart, long trueEnd, String mode) {
            this.bucketId = bucketId; this.bucketName = bucketName;
            this.category = category; this.evalTag = evalTag;
            this.color = color; this.detectedMinutes = detectedMinutes;
            this.trueStart = trueStart; this.trueEnd = trueEnd; this.mode = mode;
        }
    }
    static volatile PendingBucketConfirm pendingBucketConfirm = null;

    // ── 多任务数据模型 ────────────────────────────────────────
    public static class TaskInfo {
        public String name;
        public long startTimeMillis;
        public long initialElapsedSeconds;
        public String colorHex;
        TextView timerView; // UI reference，主线程访问

        TaskInfo(String name, long startMs, long elapsed, String color) {
            this.name = name;
            this.startTimeMillis = startMs;
            this.initialElapsedSeconds = elapsed;
            this.colorHex = (color != null && color.startsWith("#")) ? color : "#10B981";
        }

        long getElapsedSeconds() {
            if (startTimeMillis == 0) return initialElapsedSeconds;
            return initialElapsedSeconds + (System.currentTimeMillis() - startTimeMillis) / 1000;
        }
    }

    // 静态任务列表（供插件直接写入）
    static final List<TaskInfo> activeTasks = new CopyOnWriteArrayList<>();
    static volatile boolean tasksNeedRebuild = false;

    public static java.util.List<java.util.Map<String, Object>> getActiveTasksInfo() {
        java.util.List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
        for (TaskInfo t : activeTasks) {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("name", t.name);
            m.put("elapsed", t.getElapsedSeconds());
            result.add(m);
        }
        return result;
    }

    private WindowManager windowManager;
    private WindowManager.LayoutParams overlayParams;
    private View floatingView;
    private LinearLayout tasksContainer; // 动态任务行容器
    private TextView badgeText;          // header 上的计数 badge
    private TextView chevronView;        // ▾/▸ 折叠指示
    private View dividerView;            // header 下方分割线
    private boolean isCollapsed = false; // 折叠状态

    // 桶检测 Alert 悬浮 banner（与计时 overlay 独立）
    private View bucketAlertView = null;
    private final Runnable alertAutoDismiss = this::removeBucketAlertOverlay;
    private static final int NOTIF_ALERT_ID = 102;
    private static final String ALERT_CHANNEL_ID = "bucket_alert_channel";

    // 向后兼容旧 getStatus() 接口
    private static volatile boolean isRunning = false;

    private PowerManager.WakeLock wakeLock;
    private int tickCount = 0;
    private long lastOverlayRecoveryMs = 0;

    // 桶后台监控（每60s独立轮询，不依赖计时任务）
    private final Handler monitorHandler = new Handler(Looper.getMainLooper());
    private static final int MONITOR_INTERVAL_MS = 60_000;
    private volatile boolean monitorRunning = false;

    // --- 静态日志缓冲区，供前端 getDiagnosticInfo() 读取 ---
    private static final List<String> debugLogs = Collections.synchronizedList(new ArrayList<>());

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            if (!isRunning) return;

            // 任务列表变化时重建 UI 行
            if (tasksNeedRebuild) {
                tasksNeedRebuild = false;
                if (activeTasks.isEmpty()) {
                    if (bucketAlertView == null) {
                        logD("TICKER: no tasks, no alert, stopping service");
                        isRunning = false;
                        stopForeground(true);
                        stopSelf();
                        return;
                    }
                    // 有 alert banner，不停服务，只停 ticker
                    logD("TICKER: no tasks but alert is showing, pausing ticker");
                    isRunning = false;
                    return;
                }
                rebuildTaskRows();
            }

            updateTimerUI();
            tickCount++;

            if (tickCount % DIAGNOSTIC_LOG_INTERVAL == 0) {
                logD("TICK-DIAG tasks=" + activeTasks.size()
                        + ", overlayAttached=" + isOverlayAttached()
                        + ", canDraw=" + Settings.canDrawOverlays(FloatingService.this));
            }

            if (floatingView != null && !isOverlayAttached()) {
                long now = System.currentTimeMillis();
                if (now - lastOverlayRecoveryMs > 500) {
                    lastOverlayRecoveryMs = now;
                    logD("OVERLAY-RECOVERY: re-adding view");
                    recoverOverlay();
                }
            }

            handler.postDelayed(this, 1000);
        }
    };

    // ========== 静态公共方法 (供 Plugin 调用) ==========

    public static boolean isServiceRunning() { return isRunning; }
    public static long getStartTime() {
        return activeTasks.isEmpty() ? 0 : activeTasks.get(0).startTimeMillis;
    }
    public static long getElapsed() {
        return activeTasks.isEmpty() ? 0 : activeTasks.get(0).initialElapsedSeconds;
    }
    public static String getTaskName() {
        return activeTasks.isEmpty() ? "计时中" : activeTasks.get(0).name;
    }

    /** 插件调用：更新任务列表，在主线程重建 UI */
    public static void updateTasks(List<TaskInfo> newTasks) {
        activeTasks.clear();
        activeTasks.addAll(newTasks);
        tasksNeedRebuild = true;
        isRunning = !newTasks.isEmpty();
    }

    public static void clearTasks() {
        activeTasks.clear();
        tasksNeedRebuild = true;
        isRunning = false;
    }

    public static List<String> getRecentLogs() {
        synchronized (debugLogs) {
            int size = debugLogs.size();
            int from = Math.max(0, size - 50);
            return new ArrayList<>(debugLogs.subList(from, size));
        }
    }

    static boolean isHonorOrHuawei() {
        String manufacturer = Build.MANUFACTURER.toLowerCase(Locale.ROOT);
        String brand = Build.BRAND.toLowerCase(Locale.ROOT);
        return manufacturer.contains("huawei") || manufacturer.contains("honor")
            || brand.contains("huawei") || brand.contains("honor");
    }

    // ========== 生命周期 ==========

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        logD("onCreate: manufacturer=" + Build.MANUFACTURER + ", model=" + Build.MODEL
                + ", SDK=" + Build.VERSION.SDK_INT + ", brand=" + Build.BRAND
                + ", isHonorOrHuawei=" + isHonorOrHuawei());
        createNotificationChannel();

        // 荣耀/华为设备获取 WakeLock 防止 CPU 休眠杀 timer
        if (isHonorOrHuawei()) {
            acquireWakeLock();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            logD("onStartCommand: action=" + action + ", flags=" + flags + ", startId=" + startId);

            if ("STOP".equals(action)) {
                logD("STOP: stopping service, clearing " + activeTasks.size() + " tasks");
                activeTasks.clear();
                tasksNeedRebuild = true;
                isRunning = false;
                handler.removeCallbacks(ticker);
                handler.removeCallbacks(alertAutoDismiss);
                removeBucketAlertOverlay();
                releaseWakeLock();
                stopForeground(true);
                stopSelf();
                return START_NOT_STICKY;
            }

            if ("START_MONITOR".equals(action)) {
                logD("START_MONITOR: starting bucket background polling");
                startBucketMonitor();
                // 确保服务以 foreground 方式运行（如果还没有计时任务）
                if (!isRunning) {
                    try {
                        createNotificationChannel();
                        startForeground(NOTIFICATION_ID, buildNotification("TimeBox 监控中..."));
                    } catch (Exception e) { logE("START_MONITOR: startForeground failed", e); }
                }
                return START_STICKY;
            }

            if ("STOP_MONITOR".equals(action)) {
                logD("STOP_MONITOR: stopping bucket background polling");
                stopBucketMonitor();
                if (!isRunning && activeTasks.isEmpty() && bucketAlertView == null) {
                    stopForeground(true); stopSelf();
                }
                return START_NOT_STICKY;
            }

            if ("BUCKET_ALERT".equals(action)) {
                String bId = intent.getStringExtra("bucketId");
                String bName = intent.getStringExtra("bucketName");
                int bMinutes = intent.getIntExtra("minutes", 0);
                String bColor = intent.getStringExtra("color");
                boolean bRealtime = intent.getBooleanExtra("isRealtime", true);
                long bStart = intent.getLongExtra("trueStart", 0);
                long bEnd = intent.getLongExtra("trueEnd", 0);
                logD("BUCKET_ALERT: name=" + bName + ", min=" + bMinutes + ", realtime=" + bRealtime);
                if (!isRunning && activeTasks.isEmpty()) {
                    // 无计时任务：启动服务仅用于显示 alert
                    try {
                        createAlertNotificationChannel();
                        startForeground(NOTIF_ALERT_ID, buildAlertNotification(bName));
                    } catch (Exception e) { logE("BUCKET_ALERT: startForeground failed", e); }
                }
                if (windowManager == null) windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
                showBucketAlertOverlay(bId != null ? bId : "", bName, bMinutes, bColor, bRealtime, bStart, bEnd);
                return START_NOT_STICKY;
            }

            if ("DISMISS_BUCKET_ALERT".equals(action)) {
                logD("DISMISS_BUCKET_ALERT");
                handler.removeCallbacks(alertAutoDismiss);
                removeBucketAlertOverlay();
                return START_NOT_STICKY;
            }

            if ("RESTORE".equals(action)) {
                logD("RESTORE: service restarting after task removed");
                if (isRunning && !activeTasks.isEmpty()) {
                    try {
                        startForeground(NOTIFICATION_ID, buildNotification("恢复计时中..."));
                        logD("RESTORE: startForeground OK");
                    } catch (Exception e) {
                        logE("RESTORE: startForeground FAILED", e);
                    }
                    if (floatingView == null) {
                        createFloatingView();
                    }
                    handler.removeCallbacks(ticker);
                    handler.post(ticker);
                }
                return START_STICKY;
            }

            String name = intent.getStringExtra("name");
            long startMs = intent.getLongExtra("startTime", 0);
            long elapsed = intent.getLongExtra("elapsed", 0);
            String color = intent.getStringExtra("color");

            if (floatingView == null) {
                try {
                    startForeground(NOTIFICATION_ID, buildNotification("计时中 — 00:00:00"));
                    logD("startForeground OK");
                } catch (Exception e) {
                    logE("startForeground FAILED", e);
                }
                createFloatingView();
            }

            // 兼容旧单任务调用：把传入任务合并进列表
            if (name != null && startMs > 0) {
                boolean found = false;
                for (TaskInfo t : activeTasks) {
                    if (t.name.equals(name)) {
                        t.startTimeMillis = startMs;
                        t.initialElapsedSeconds = elapsed;
                        if (color != null) t.colorHex = color;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    activeTasks.add(new TaskInfo(name, startMs, elapsed, color));
                    tasksNeedRebuild = true;
                }
                isRunning = true;
                logD("START: name=" + name + ", tasks=" + activeTasks.size());
                handler.removeCallbacks(ticker);
                handler.post(ticker);
            }
        } else {
            logD("onStartCommand: intent is null (service restarted), flags=" + flags + " → reloading persisted buckets");
            // 服务被系统杀死后以 START_STICKY 重启：从 SharedPreferences 恢复桶配置并重启监控
            loadBucketsFromPrefs();
            if (!monitorBuckets.isEmpty()) {
                if (!isRunning) {
                    try {
                        createNotificationChannel();
                        startForeground(NOTIFICATION_ID, buildNotification("TimeBox 监控中..."));
                    } catch (Exception e) { logE("restart: startForeground failed", e); }
                }
                startBucketMonitor();
            }
        }
        return START_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        logD("onTaskRemoved: isRunning=" + isRunning + ", tasks=" + activeTasks.size());
        if (!isRunning || activeTasks.isEmpty()) {
            return;
        }

        // 方式1: 直接重启
        Intent restartIntent = new Intent(getApplicationContext(), FloatingService.class);
        restartIntent.setAction("RESTORE");
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getApplicationContext().startForegroundService(restartIntent);
            } else {
                getApplicationContext().startService(restartIntent);
            }
            logD("onTaskRemoved: direct restart intent sent");
        } catch (Exception e) {
            logE("onTaskRemoved: direct restart FAILED", e);
        }

        // 方式2: AlarmManager 延迟重启（Honor 可能杀掉直接重启）
        scheduleRestart();
    }

    private void scheduleRestart() {
        Intent restartIntent = new Intent(getApplicationContext(), FloatingService.class);
        restartIntent.setAction("RESTORE");
        PendingIntent pi = PendingIntent.getService(
                getApplicationContext(), 999, restartIntent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            am.setExactAndAllowWhileIdle(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + 1000, // 1秒后重启
                    pi);
            logD("scheduleRestart: AlarmManager fallback set for 1s");
        }
    }

    @Override
    public void onDestroy() {
        logD("onDestroy: isRunning=" + isRunning);
        isRunning = false;
        handler.removeCallbacks(ticker);
        handler.removeCallbacks(alertAutoDismiss);
        stopBucketMonitor();
        releaseWakeLock();
        if (floatingView != null && windowManager != null) {
            try { windowManager.removeView(floatingView); } catch (Exception ignored) {}
        }
        if (bucketAlertView != null && windowManager != null) {
            try { windowManager.removeView(bucketAlertView); } catch (Exception ignored) {}
            bucketAlertView = null;
        }
        super.onDestroy();
    }

    // ========== Overlay 管理 ==========

    private boolean isOverlayAttached() {
        return floatingView != null && floatingView.getWindowToken() != null;
    }

    private void recoverOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            logD("OVERLAY-RECOVERY: canDrawOverlays=false, cannot recover");
            return;
        }

        // 先移除旧 view
        if (floatingView != null && windowManager != null) {
            try {
                windowManager.removeView(floatingView);
            } catch (Exception ignored) {}
        }
        floatingView = null;
        overlayParams = null;

        // 重新创建
        createFloatingView();
        logD("OVERLAY-RECOVERY: re-created, attached=" + isOverlayAttached());
    }

    private void createFloatingView() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setMinimumWidth(dp(140));
        root.setElevation(dp(10));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#F0161820"));
        bg.setCornerRadius(dp(14));
        bg.setStroke(dp(1), Color.parseColor("#2A2D3A"));
        root.setBackground(bg);

        // ── Header：把手 + 标题 + badge + 关闭按钮 ──────────────
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(android.view.Gravity.CENTER_VERTICAL);
        header.setPadding(dp(10), dp(8), dp(8), dp(6));

        TextView grip = new TextView(this);
        grip.setText("⠿ ");
        grip.setTextColor(Color.parseColor("#525675"));
        grip.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);

        TextView title = new TextView(this);
        title.setText("并行计时");
        title.setTextColor(Color.parseColor("#C4C8E0"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);

        badgeText = new TextView(this);
        badgeText.setText(" ● " + activeTasks.size() + " ");
        badgeText.setTextColor(Color.parseColor("#10B981"));
        badgeText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 9);
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(Color.parseColor("#2010B981"));
        badgeBg.setCornerRadius(dp(4));
        badgeText.setBackground(badgeBg);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        badgeParams.setMarginStart(dp(4));
        badgeParams.setMarginEnd(dp(4));

        // ▾ 折叠按钮
        chevronView = new TextView(this);
        chevronView.setText("▾");
        chevronView.setTextColor(Color.parseColor("#525675"));
        chevronView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        chevronView.setPadding(dp(4), dp(2), dp(2), dp(2));

        // ✕ 关闭按钮
        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.parseColor("#525675"));
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        closeBtn.setPadding(dp(6), dp(2), dp(6), dp(2));
        closeBtn.setOnClickListener(v -> {
            logD("close button tapped, stopping service");
            isRunning = false;
            activeTasks.clear();
            handler.removeCallbacks(ticker);
            stopForeground(true);
            stopSelf();
        });

        header.addView(grip);
        header.addView(title, titleParams);
        header.addView(badgeText, badgeParams);
        header.addView(chevronView);
        header.addView(closeBtn);
        root.addView(header);
        final LinearLayout headerRef = header;

        // ── 分割线 ──────────────────────────────────────────────
        dividerView = new android.view.View(this);
        dividerView.setBackgroundColor(Color.parseColor("#252836"));
        root.addView(dividerView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(1)));


        // ── 任务行容器（动态） ───────────────────────────────────
        tasksContainer = new LinearLayout(this);
        tasksContainer.setOrientation(LinearLayout.VERTICAL);
        root.addView(tasksContainer);

        floatingView = root;

        // 初始化任务行
        rebuildTaskRows();

        // 恢复折叠状态
        if (isCollapsed) {
            tasksContainer.setVisibility(View.GONE);
            dividerView.setVisibility(View.GONE);
            chevronView.setText("▸");
        }

        int layoutType;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutType = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutType = WindowManager.LayoutParams.TYPE_PHONE;
        }

        overlayParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);

        overlayParams.gravity = Gravity.TOP | Gravity.LEFT;
        overlayParams.x = dp(20);
        overlayParams.y = dp(100);

        try {
            windowManager.addView(floatingView, overlayParams);
            logD("createFloatingView: addView OK, attached=" + isOverlayAttached());
        } catch (Exception e) {
            logE("createFloatingView: addView FAILED (permission denied?)", e);
            stopSelf();
            return;
        }

        floatingView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private long touchStartTime;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = overlayParams.x;
                        initialY = overlayParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        touchStartTime = System.currentTimeMillis();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        overlayParams.x = initialX + (int) (event.getRawX() - initialTouchX);
                        overlayParams.y = initialY + (int) (event.getRawY() - initialTouchY);
                        try {
                            windowManager.updateViewLayout(floatingView, overlayParams);
                        } catch (Exception e) {
                            logE("OVERLAY-DRAG: updateViewLayout failed", e);
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        long duration = System.currentTimeMillis() - touchStartTime;
                        float dx = Math.abs(event.getRawX() - initialTouchX);
                        float dy = Math.abs(event.getRawY() - initialTouchY);
                        if (dx < 10 && dy < 10 && duration < 200) {
                            // 判断是否点在 header 区域
                            int[] loc = new int[2];
                            headerRef.getLocationOnScreen(loc);
                            int headerBottom = loc[1] + headerRef.getHeight();
                            if (event.getRawY() <= headerBottom) {
                                toggleCollapse();
                            } else {
                                v.performClick();
                                Intent intent = new Intent(FloatingService.this, MainActivity.class);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                                startActivity(intent);
                            }
                        }
                        return true;
                }
                return false;
            }
        });
    }

    // ========== Timer UI ==========

    /** 折叠/展开任务行 */
    private void toggleCollapse() {
        isCollapsed = !isCollapsed;
        int visibility = isCollapsed ? View.GONE : View.VISIBLE;
        if (tasksContainer != null) tasksContainer.setVisibility(visibility);
        if (dividerView != null) dividerView.setVisibility(visibility);
        if (chevronView != null) chevronView.setText(isCollapsed ? "▸" : "▾");
        // 重新测量让窗口收缩/展开
        if (floatingView != null && windowManager != null && overlayParams != null) {
            try { windowManager.updateViewLayout(floatingView, overlayParams); } catch (Exception ignored) {}
        }
    }

    /** 重建 tasksContainer 里的所有任务行 */
    private void rebuildTaskRows() {
        if (tasksContainer == null) return;
        tasksContainer.removeAllViews();

        for (TaskInfo task : activeTasks) {
            // 每行：[色点] [任务名(flex)] [计时]
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(android.view.Gravity.CENTER_VERTICAL);
            row.setPadding(dp(10), dp(7), dp(10), dp(7));

            // 色点
            android.view.View dot = new android.view.View(this);
            GradientDrawable dotShape = new GradientDrawable();
            dotShape.setShape(GradientDrawable.OVAL);
            try {
                dotShape.setColor(Color.parseColor(task.colorHex));
            } catch (Exception e) {
                dotShape.setColor(Color.parseColor("#10B981"));
            }
            dot.setBackground(dotShape);
            LinearLayout.LayoutParams dotP = new LinearLayout.LayoutParams(dp(6), dp(6));
            dotP.setMarginEnd(dp(7));

            // 任务名
            TextView nameView = new TextView(this);
            nameView.setTextColor(Color.parseColor("#8B8FA8"));
            nameView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            nameView.setText(task.name);
            nameView.setMaxLines(1);
            nameView.setEllipsize(android.text.TextUtils.TruncateAt.END);
            LinearLayout.LayoutParams nameP = new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
            nameP.setMarginEnd(dp(8));

            // 计时
            TextView timerView = new TextView(this);
            timerView.setTextColor(Color.parseColor("#E8EAF0"));
            timerView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
            timerView.setTypeface(android.graphics.Typeface.MONOSPACE, android.graphics.Typeface.BOLD);
            timerView.setText(fmtSeconds(task.getElapsedSeconds()));

            task.timerView = timerView; // 保存引用供每秒更新用

            row.addView(dot, dotP);
            row.addView(nameView, nameP);
            row.addView(timerView);
            tasksContainer.addView(row);

            // 任务间分割线（非最后一个）
            if (activeTasks.indexOf(task) < activeTasks.size() - 1) {
                android.view.View sep = new android.view.View(this);
                sep.setBackgroundColor(Color.parseColor("#1A252836"));
                tasksContainer.addView(sep, new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, dp(1)));
            }
        }

        // 更新 badge 数字
        if (badgeText != null) {
            badgeText.setText(" ● " + activeTasks.size() + " ");
        }

        // 通知 WindowManager 重新布局
        if (floatingView != null && windowManager != null && isOverlayAttached()) {
            try {
                windowManager.updateViewLayout(floatingView, overlayParams);
            } catch (Exception ignored) {}
        }
    }

    private static String fmtSeconds(long totalSeconds) {
        long h = totalSeconds / 3600;
        long m = (totalSeconds % 3600) / 60;
        long s = totalSeconds % 60;
        return String.format(Locale.US, "%02d:%02d:%02d", h, m, s);
    }

    private void updateTimerUI() {
        if (activeTasks.isEmpty()) return;

        String notifText = "";
        for (TaskInfo task : activeTasks) {
            String timeStr = fmtSeconds(task.getElapsedSeconds());
            if (task.timerView != null) {
                task.timerView.setText(timeStr);
            }
            if (notifText.isEmpty()) notifText = task.name + " — " + timeStr;
        }

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification(notifText));
        }
    }

    // ========== 通知 ==========

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "TimeBox 计时", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String content) {
        Intent ni = new Intent(this, MainActivity.class);
        ni.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pi = PendingIntent.getActivity(this, 0, ni,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("TimeBox 正在后台计时")
                .setContentText(content)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    // ========== Honor WakeLock 保活 ==========

    private void acquireWakeLock() {
        if (wakeLock != null) return;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TimeBox:FloatingService");
        wakeLock.acquire();
        logD("WakeLock acquired (Honor/Huawei device)");
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
            logD("WakeLock released");
        }
    }

    // ========== 工具方法 ==========

    private int getCurrentProcessImportance() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return -1;
        List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
        if (procs == null) return -1;
        int myPid = android.os.Process.myPid();
        for (ActivityManager.RunningAppProcessInfo info : procs) {
            if (info.pid == myPid) return info.importance;
        }
        return -1;
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics());
    }

    // ========== 日志系统 ==========

    private static final SimpleDateFormat LOG_TIME_FMT = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US);

    private static void logD(String msg) {
        Log.d(TAG, msg);
        addDebugLog("D", msg);
    }

    private static void logE(String msg, Throwable t) {
        Log.e(TAG, msg, t);
        addDebugLog("E", msg + " | " + t.getClass().getSimpleName() + ": " + t.getMessage());
    }

    private static void addDebugLog(String level, String msg) {
        String ts = LOG_TIME_FMT.format(new Date());
        String entry = "[" + ts + " " + level + "] " + msg;
        debugLogs.add(entry);
        while (debugLogs.size() > MAX_DEBUG_LOGS) {
            debugLogs.remove(0);
        }
    }

    // ========== 桶后台监控 ==========

    private void loadBucketsFromPrefs() {
        String json = getMonitorPrefs().getString("buckets_json", "");
        if (json.isEmpty()) { logD("loadBucketsFromPrefs: no saved buckets"); return; }
        monitorBuckets.clear();
        try {
            org.json.JSONArray arr = new org.json.JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject b = arr.getJSONObject(i);
                String id = b.optString("id", "");
                String name = b.optString("name", "");
                String color = b.optString("color", "#F59E0B");
                int tMin = b.optInt("triggerMinutes", 5);
                int tSec = b.optInt("toleranceSeconds", 60);
                org.json.JSONArray appsArr = b.optJSONArray("apps");
                List<String> apps = new ArrayList<>();
                if (appsArr != null) {
                    for (int j = 0; j < appsArr.length(); j++) apps.add(appsArr.getString(j));
                }
                monitorBuckets.add(new BucketConfig(id, name, apps, tMin, tSec, color));
            }
            logD("loadBucketsFromPrefs: loaded " + monitorBuckets.size() + " buckets");
        } catch (Exception e) {
            logE("loadBucketsFromPrefs: parse error", e);
        }
    }

    private void startBucketMonitor() {
        if (monitorRunning) return;
        monitorRunning = true;
        monitorHandler.post(monitorRunnable);
        logD("BucketMonitor: started, interval=" + MONITOR_INTERVAL_MS + "ms");
    }

    private void stopBucketMonitor() {
        monitorRunning = false;
        monitorHandler.removeCallbacks(monitorRunnable);
        logD("BucketMonitor: stopped");
    }

    private final Runnable monitorRunnable = new Runnable() {
        @Override
        public void run() {
            if (!monitorRunning) return;
            checkBucketsNow();
            monitorHandler.postDelayed(this, MONITOR_INTERVAL_MS);
        }
    };

    // SharedPreferences key 前缀，用于持久化今日已触发桶
    private static final String PREFS_NAME = "timebox_monitor";
    private static final String PREFS_FIRED_DATE = "fired_date";
    private static final String PREFS_FIRED_IDS = "fired_ids";

    private android.content.SharedPreferences getMonitorPrefs() {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /**
     * 获取指定桶今日已"消费"（已触发过）的累计使用时长（毫秒）。
     * 返回 0 表示今天从未触发。
     * SharedPreferences 格式: fired_ids = "|bucketId:consumedMs||bucketId2:consumedMs2|"
     */
    private long getConsumedMs(String bucketId) {
        android.content.SharedPreferences prefs = getMonitorPrefs();
        java.util.Calendar cal = java.util.Calendar.getInstance();
        String today = String.format(Locale.US, "%04d-%02d-%02d",
                cal.get(java.util.Calendar.YEAR),
                cal.get(java.util.Calendar.MONTH) + 1,
                cal.get(java.util.Calendar.DAY_OF_MONTH));
        String savedDate = prefs.getString(PREFS_FIRED_DATE, "");
        if (!today.equals(savedDate)) return 0;
        String savedIds = prefs.getString(PREFS_FIRED_IDS, "");
        String token = "|" + bucketId + ":";
        int idx = savedIds.lastIndexOf(token);
        if (idx < 0) return 0;
        int valStart = idx + token.length();
        int valEnd = savedIds.indexOf("|", valStart);
        if (valEnd < 0) return 0;
        try {
            long val = Long.parseLong(savedIds.substring(valStart, valEnd));
            // 旧版存的是 System.currentTimeMillis() 时间戳（约1.7万亿ms），
            // 新版存的是累计使用时长（正常不超过24小时=86400000ms）。
            // 检测到旧数据时重置为0。
            if (val > 86400000L) {
                logD("BucketMonitor: detected stale timestamp " + val + " for bucket=" + bucketId + ", resetting to 0");
                return 0;
            }
            return val;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * 记录桶已消费的累计使用时长。每次触发后更新为当前总时长。
     */
    private void setConsumedMs(String bucketId, long consumedMs) {
        android.content.SharedPreferences prefs = getMonitorPrefs();
        java.util.Calendar cal = java.util.Calendar.getInstance();
        String today = String.format(Locale.US, "%04d-%02d-%02d",
                cal.get(java.util.Calendar.YEAR),
                cal.get(java.util.Calendar.MONTH) + 1,
                cal.get(java.util.Calendar.DAY_OF_MONTH));
        String savedDate = prefs.getString(PREFS_FIRED_DATE, "");
        String ids = today.equals(savedDate) ? prefs.getString(PREFS_FIRED_IDS, "") : "";
        // 移除旧的该桶记录（如有）
        String token = "|" + bucketId + ":";
        int oldIdx = ids.indexOf(token);
        if (oldIdx >= 0) {
            int oldEnd = ids.indexOf("|", oldIdx + token.length());
            if (oldEnd >= 0) {
                ids = ids.substring(0, oldIdx) + ids.substring(oldEnd);
            }
        }
        // 追加新记录
        ids = ids + "|" + bucketId + ":" + consumedMs + "|";
        prefs.edit()
             .putString(PREFS_FIRED_DATE, today)
             .putString(PREFS_FIRED_IDS, ids)
             .apply();
    }

    // AppName 简单 session 结构
    private static class AppSession {
        final String appName;
        final long start, end;
        AppSession(String appName, long start, long end) {
            this.appName = appName; this.start = start; this.end = end;
        }
    }

    private void checkBucketsNow() {
        if (monitorBuckets.isEmpty()) return;
        if (bucketAlertView != null) return; // 已有 banner，不重复触发
        if (!hasUsagePermission()) { logD("BucketMonitor: no usage permission"); return; }

        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return;

        long now = System.currentTimeMillis();
        java.util.Calendar dayStartCal = java.util.Calendar.getInstance();
        dayStartCal.set(java.util.Calendar.HOUR_OF_DAY, 0);
        dayStartCal.set(java.util.Calendar.MINUTE, 0);
        dayStartCal.set(java.util.Calendar.SECOND, 0);
        dayStartCal.set(java.util.Calendar.MILLISECOND, 0);

        // 解析今日所有 App 使用 session（直接存 displayName）
        PackageManager pm = getPackageManager();
        Map<String, Long> resumeMap = new HashMap<>();
        Map<String, String> pkgToName = new HashMap<>();
        List<AppSession> allSessions = new ArrayList<>();

        android.app.usage.UsageEvents usageEvents = usm.queryEvents(dayStartCal.getTimeInMillis(), now);
        while (usageEvents.hasNextEvent()) {
            android.app.usage.UsageEvents.Event ev = new android.app.usage.UsageEvents.Event();
            usageEvents.getNextEvent(ev);
            String pkg = ev.getPackageName();

            if (ev.getEventType() == android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED) {
                resumeMap.put(pkg, ev.getTimeStamp());
            } else if (ev.getEventType() == android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED) {
                Long t0 = resumeMap.remove(pkg);
                if (t0 != null && ev.getTimeStamp() - t0 >= 3000) {
                    if (!pkgToName.containsKey(pkg)) pkgToName.put(pkg, resolveAppName(pkg, pm));
                    allSessions.add(new AppSession(pkgToName.get(pkg), t0, ev.getTimeStamp()));
                }
            }
        }
        // 仍在前台的 app
        for (Map.Entry<String, Long> e : resumeMap.entrySet()) {
            long dur = now - e.getValue();
            if (dur >= 3000) {
                String pkg = e.getKey();
                if (!pkgToName.containsKey(pkg)) pkgToName.put(pkg, resolveAppName(pkg, pm));
                allSessions.add(new AppSession(pkgToName.get(pkg), e.getValue(), now));
            }
        }

        logD("BucketMonitor: scanned " + allSessions.size() + " sessions today, buckets=" + monitorBuckets.size());

        for (BucketConfig bucket : monitorBuckets) {
            long consumedMs = getConsumedMs(bucket.id);

            // 收集属于该桶的所有 session（按 displayName 精确匹配，大小写不敏感）
            List<AppSession> bSessions = new ArrayList<>();
            for (AppSession s : allSessions) {
                for (String a : bucket.apps) {
                    if (a.toLowerCase(Locale.ROOT).equals(s.appName.toLowerCase(Locale.ROOT))) {
                        bSessions.add(s); break;
                    }
                }
            }

            // 计算该桶今日总使用时长
            long totalDurMs = 0;
            for (AppSession s : bSessions) {
                totalDurMs += (s.end - s.start);
            }

            // 未消费的新增使用时长 = 今日总时长 - 已消费时长
            long unconsumedMs = totalDurMs - consumedMs;
            long triggerMs = bucket.triggerMinutes * 60000L;

            logD("BucketMonitor: checking bucket=" + bucket.name + " apps=" + bucket.apps
                    + " trigMin=" + bucket.triggerMinutes
                    + " totalMin=" + String.format(Locale.US, "%.1f", totalDurMs / 60000.0)
                    + " consumedMin=" + String.format(Locale.US, "%.1f", consumedMs / 60000.0)
                    + " unconsumedMin=" + String.format(Locale.US, "%.1f", unconsumedMs / 60000.0));

            if (unconsumedMs < triggerMs) continue;

            // 按时间排序，防抖合并（用于确定最近使用段的 trueStart/trueEnd）
            if (bSessions.isEmpty()) continue;
            bSessions.sort((a, b) -> Long.compare(a.start, b.start));
            long segStart = bSessions.get(0).start, segEnd = bSessions.get(0).end;
            List<long[]> segments = new ArrayList<>();
            for (int i = 1; i < bSessions.size(); i++) {
                if (bSessions.get(i).start - segEnd <= bucket.toleranceSeconds * 1000L) {
                    segEnd = Math.max(segEnd, bSessions.get(i).end);
                } else {
                    segments.add(new long[]{ segStart, segEnd });
                    segStart = bSessions.get(i).start; segEnd = bSessions.get(i).end;
                }
            }
            segments.add(new long[]{ segStart, segEnd });

            // 取最新（最后一个）合并段作为展示给用户的时间区间
            long[] latest = segments.get(segments.size() - 1);

            int durMin = (int) Math.round(unconsumedMs / 60000.0);
            boolean isRealtime = (now - latest[1]) <= 10 * 60000L;
            String mode = isRealtime ? "realtime" : "retrospective";
            logD("BucketMonitor: TRIGGER bucket=" + bucket.name + " dur=" + durMin + "min mode=" + mode
                    + " newConsumed=" + String.format(Locale.US, "%.1f", totalDurMs / 60000.0) + "min");

            // 把当前总时长记为已消费，下次只有新增使用超过阈值才会再次触发
            setConsumedMs(bucket.id, totalDurMs);
            if (windowManager == null) windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
            showBucketAlertOverlay(bucket.id, bucket.name, durMin, bucket.color, isRealtime, latest[0], latest[1]);
            break; // 一次只弹一个
        }
    }

    private boolean hasUsagePermission() {
        AppOpsManager aom = (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
        if (aom == null) return false;
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = aom.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), getPackageName());
        } else {
            mode = aom.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private String resolveAppName(String pkg, PackageManager pm) {
        try {
            android.content.pm.ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (PackageManager.NameNotFoundException e) {
            int dot = pkg.lastIndexOf('.');
            return dot >= 0 ? pkg.substring(dot + 1) : pkg;
        }
    }

    // ========== 桶检测 Alert 悬浮 banner ==========

    private void showBucketAlertOverlay(String bucketId, String bucketName, int minutes, String colorHex, boolean isRealtime, long trueStart, long trueEnd) {
        if (!Settings.canDrawOverlays(this)) {
            logD("showBucketAlert: no overlay permission");
            return;
        }
        handler.removeCallbacks(alertAutoDismiss);
        if (bucketAlertView != null) {
            try { windowManager.removeView(bucketAlertView); } catch (Exception ignored) {}
            bucketAlertView = null;
        }
        if (windowManager == null) windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        int parsedColor;
        try { parsedColor = Color.parseColor(colorHex != null ? colorHex : "#F59E0B"); }
        catch (Exception e) { parsedColor = Color.parseColor("#F59E0B"); }
        final int accentColor = parsedColor;

        // ── 根容器 ──
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable rootBg = new GradientDrawable();
        rootBg.setColor(Color.parseColor("#F0161820"));
        rootBg.setCornerRadius(dp(12));
        rootBg.setStroke(dp(1), Color.parseColor("#2A2D3A"));
        root.setBackground(rootBg);
        root.setPadding(dp(14), dp(12), dp(14), dp(12));
        root.setElevation(dp(8));

        // ── 顶行：图标 + 文字 + 关闭按钮 ──
        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(android.view.Gravity.CENTER_VERTICAL);

        // 色条（左侧装饰）
        android.view.View accent = new android.view.View(this);
        GradientDrawable accentBg = new GradientDrawable();
        accentBg.setColor(accentColor);
        accentBg.setCornerRadius(dp(2));
        accent.setBackground(accentBg);
        LinearLayout.LayoutParams accentP = new LinearLayout.LayoutParams(dp(3), dp(32));
        accentP.setMarginEnd(dp(10));
        topRow.addView(accent, accentP);

        // 文字（弹性）
        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams textColP = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColP.setMarginEnd(dp(10));

        TextView titleView = new TextView(this);
        titleView.setText("检测到「" + bucketName + "」");
        titleView.setTextColor(Color.parseColor("#E8EAF0"));
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        titleView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);

        TextView subView = new TextView(this);
        subView.setText(isRealtime
                ? "已连续使用约 " + minutes + " 分钟，开始计时？"
                : "已使用约 " + minutes + " 分钟，记录为历史？");
        subView.setTextColor(Color.parseColor("#8B8FA8"));
        subView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);

        textCol.addView(titleView);
        textCol.addView(subView);
        topRow.addView(textCol, textColP);

        // 关闭按钮
        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.parseColor("#525675"));
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        closeBtn.setPadding(dp(6), dp(2), 0, dp(2));
        closeBtn.setOnClickListener(v -> {
            handler.removeCallbacks(alertAutoDismiss);
            removeBucketAlertOverlay();
        });
        topRow.addView(closeBtn);
        root.addView(topRow);

        // ── 按钮行 ──
        LinearLayout btnRow = new LinearLayout(this);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setGravity(android.view.Gravity.END);
        LinearLayout.LayoutParams btnRowP = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnRowP.topMargin = dp(10);

        // 确认计时 → 打开 App
        TextView confirmBtn = new TextView(this);
        confirmBtn.setText(isRealtime ? "确认计时 →" : "记录使用 →");
        confirmBtn.setTextColor(Color.WHITE);
        confirmBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        confirmBtn.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        GradientDrawable confirmBg = new GradientDrawable();
        confirmBg.setColor(accentColor);
        confirmBg.setCornerRadius(dp(8));
        confirmBtn.setBackground(confirmBg);
        confirmBtn.setPadding(dp(14), dp(8), dp(14), dp(8));
        confirmBtn.setOnClickListener(v -> {
            handler.removeCallbacks(alertAutoDismiss);
            removeBucketAlertOverlay();
            // 设置 pending 数据供 JS 消费
            String mode = isRealtime ? "realtime" : "retrospective";
            pendingBucketConfirm = new PendingBucketConfirm(
                    bucketId, bucketName, "", "", colorHex, minutes, trueStart, trueEnd, mode);
            logD("BucketConfirm: pending set for bucket=" + bucketName + " mode=" + mode);
            Intent openApp = new Intent(FloatingService.this, MainActivity.class);
            openApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            try { startActivity(openApp); } catch (Exception ignored) {}
        });
        btnRow.addView(confirmBtn);
        root.addView(btnRow, btnRowP);

        // ── 加入 WindowManager ──
        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams alertParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        alertParams.gravity = android.view.Gravity.TOP | android.view.Gravity.FILL_HORIZONTAL;
        alertParams.x = dp(12);
        alertParams.y = dp(60); // 状态栏下方
        alertParams.width = WindowManager.LayoutParams.MATCH_PARENT;

        // 修正：用 MATCH_PARENT 时 x margin 通过 padding 控制
        root.setPadding(dp(14), dp(12), dp(14), dp(12));

        try {
            windowManager.addView(root, alertParams);
            bucketAlertView = root;
            logD("showBucketAlert: overlay added for " + bucketName);
        } catch (Exception e) {
            logE("showBucketAlert: addView failed", e);
        }

        // 15秒后自动消失
        handler.postDelayed(alertAutoDismiss, 15000);
    }

    private void removeBucketAlertOverlay() {
        if (bucketAlertView != null && windowManager != null) {
            try { windowManager.removeView(bucketAlertView); } catch (Exception ignored) {}
            bucketAlertView = null;
            logD("removeBucketAlert: overlay removed");
        }
        // 仅用于显示 alert 的模式：无任务则停止服务
        if (!isRunning || activeTasks.isEmpty()) {
            try { stopForeground(true); } catch (Exception ignored) {}
            stopSelf();
        }
    }

    private void createAlertNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    ALERT_CHANNEL_ID, "TimeBox 使用检测", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setShowBadge(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildAlertNotification(String bucketName) {
        Intent ni = new Intent(this, MainActivity.class);
        ni.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pi = PendingIntent.getActivity(this, 1, ni,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle("检测到「" + bucketName + "」使用")
                .setContentText("点击进入 TimeBox 确认计时")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
    }
}
