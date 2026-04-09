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
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;

public class FloatingService extends Service {
    private static final String TAG = "TimeBox.Float";
    private static final String CHANNEL_ID = "floating_timer_channel";
    private static final int NOTIFICATION_ID = 101;

    private static final int MAX_DEBUG_LOGS = 200;
    private static final int DIAGNOSTIC_LOG_INTERVAL = 30; // 每 30 tick (30秒) 输出一次诊断

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

    // 向后兼容旧 getStatus() 接口
    private static volatile boolean isRunning = false;

    private PowerManager.WakeLock wakeLock;
    private int tickCount = 0;
    private long lastOverlayRecoveryMs = 0;

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
                    logD("TICKER: no tasks, stopping service");
                    isRunning = false;
                    stopForeground(true);
                    stopSelf();
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
                releaseWakeLock();
                stopForeground(true);
                stopSelf();
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
            logD("onStartCommand: intent is null, flags=" + flags);
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
        releaseWakeLock();
        if (floatingView != null && windowManager != null) {
            try {
                windowManager.removeView(floatingView);
            } catch (Exception ignored) {}
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
}
