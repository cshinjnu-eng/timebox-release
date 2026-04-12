package com.timebox.app;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.Process;
import android.util.Log;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 桶后台监控：定时轮询 UsageStats，检测应用使用时长是否超过阈值。
 * 从 FloatingService 中提取，职责单一。
 */
public class BucketMonitorManager {

    private static final String TAG = "TimeBox.Float";
    private static final int MONITOR_INTERVAL_MS = 60_000;
    private static final String PREFS_NAME = "timebox_monitor";
    private static final String PREFS_FIRED_DATE = "fired_date";

    // ── 数据模型 ──

    public static class BucketConfig {
        public final String id;
        public final String name;
        public final List<String> apps;
        public final int triggerMinutes;
        public final int toleranceSeconds;
        public final String color;

        public BucketConfig(String id, String name, List<String> apps,
                            int triggerMinutes, int toleranceSeconds, String color) {
            this.id = id;
            this.name = name;
            this.apps = apps;
            this.triggerMinutes = triggerMinutes;
            this.toleranceSeconds = toleranceSeconds;
            this.color = color;
        }
    }

    static class AppSession {
        final String appName;
        final long start, end;
        AppSession(String appName, long start, long end) {
            this.appName = appName;
            this.start = start;
            this.end = end;
        }
    }

    /** 触发回调：桶达到阈值时通知 FloatingService */
    public interface OnBucketTriggered {
        void onTriggered(BucketConfig bucket, int durationMinutes,
                         boolean isRealtime, long trueStart, long trueEnd);
    }

    // ── 状态 ──

    static final List<BucketConfig> monitorBuckets = new CopyOnWriteArrayList<>();
    private final Context context;
    private final OnBucketTriggered callback;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean running = false;
    private volatile boolean alertShowing = false;

    public BucketMonitorManager(Context context, OnBucketTriggered callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    // ── 公共 API ──

    public void start() {
        if (running) return;
        running = true;
        handler.post(monitorRunnable);
        logD("BucketMonitor: started, interval=" + MONITOR_INTERVAL_MS + "ms");
    }

    public void stop() {
        running = false;
        handler.removeCallbacks(monitorRunnable);
        logD("BucketMonitor: stopped");
    }

    public boolean isRunning() { return running; }

    public void setAlertShowing(boolean showing) { this.alertShowing = showing; }

    public boolean hasBuckets() { return !monitorBuckets.isEmpty(); }

    public void loadBucketsFromPrefs() {
        SharedPreferences prefs = getPrefs();
        String json = prefs.getString("buckets_json", "");
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

    public boolean hasUsagePermission() {
        AppOpsManager aom = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        if (aom == null) return false;
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = aom.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), context.getPackageName());
        } else {
            mode = aom.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(), context.getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    // ── 核心检测 ──

    private final Runnable monitorRunnable = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            checkBucketsNow();
            handler.postDelayed(this, MONITOR_INTERVAL_MS);
        }
    };

    void checkBucketsNow() {
        if (monitorBuckets.isEmpty()) return;
        if (alertShowing) return;
        if (!hasUsagePermission()) { logD("BucketMonitor: no usage permission"); return; }

        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return;

        long now = System.currentTimeMillis();
        Calendar dayStart = Calendar.getInstance();
        dayStart.set(Calendar.HOUR_OF_DAY, 0);
        dayStart.set(Calendar.MINUTE, 0);
        dayStart.set(Calendar.SECOND, 0);
        dayStart.set(Calendar.MILLISECOND, 0);

        List<AppSession> allSessions = collectSessions(usm, dayStart.getTimeInMillis(), now);
        logD("BucketMonitor: scanned " + allSessions.size() + " sessions today, buckets=" + monitorBuckets.size());

        for (BucketConfig bucket : monitorBuckets) {
            long consumedMs = getConsumedMs(bucket.id);
            List<AppSession> bSessions = filterByBucket(allSessions, bucket);

            long totalDurMs = 0;
            for (AppSession s : bSessions) totalDurMs += (s.end - s.start);

            long unconsumedMs = totalDurMs - consumedMs;
            long triggerMs = bucket.triggerMinutes * 60000L;

            logD("BucketMonitor: checking bucket=" + bucket.name + " apps=" + bucket.apps
                    + " trigMin=" + bucket.triggerMinutes
                    + " totalMin=" + fmtMin(totalDurMs)
                    + " consumedMin=" + fmtMin(consumedMs)
                    + " unconsumedMin=" + fmtMin(unconsumedMs));

            if (unconsumedMs < triggerMs) continue;
            if (bSessions.isEmpty()) continue;

            List<long[]> segments = mergeSegments(bSessions, bucket.toleranceSeconds);
            long[] latest = segments.get(segments.size() - 1);

            int durMin = (int) Math.round(unconsumedMs / 60000.0);
            boolean isRealtime = (now - latest[1]) <= 10 * 60000L;
            logD("BucketMonitor: TRIGGER bucket=" + bucket.name + " dur=" + durMin + "min"
                    + " mode=" + (isRealtime ? "realtime" : "retrospective")
                    + " newConsumed=" + fmtMin(totalDurMs) + "min");

            setConsumedMs(bucket.id, totalDurMs);
            callback.onTriggered(bucket, durMin, isRealtime, latest[0], latest[1]);
            break; // 一次只弹一个
        }
    }

    // ── UsageStats 采集 ──

    private List<AppSession> collectSessions(UsageStatsManager usm, long from, long to) {
        PackageManager pm = context.getPackageManager();
        Map<String, Long> resumeMap = new HashMap<>();
        Map<String, String> pkgToName = new HashMap<>();
        List<AppSession> sessions = new ArrayList<>();

        UsageEvents events = usm.queryEvents(from, to);
        while (events.hasNextEvent()) {
            UsageEvents.Event ev = new UsageEvents.Event();
            events.getNextEvent(ev);
            String pkg = ev.getPackageName();

            if (ev.getEventType() == UsageEvents.Event.ACTIVITY_RESUMED) {
                resumeMap.put(pkg, ev.getTimeStamp());
            } else if (ev.getEventType() == UsageEvents.Event.ACTIVITY_PAUSED) {
                Long t0 = resumeMap.remove(pkg);
                if (t0 != null && ev.getTimeStamp() - t0 >= 3000) {
                    if (!pkgToName.containsKey(pkg)) pkgToName.put(pkg, resolveAppName(pkg, pm));
                    sessions.add(new AppSession(pkgToName.get(pkg), t0, ev.getTimeStamp()));
                }
            }
        }
        // 仍在前台的 app
        long now = System.currentTimeMillis();
        for (Map.Entry<String, Long> e : resumeMap.entrySet()) {
            if (now - e.getValue() >= 3000) {
                String pkg = e.getKey();
                if (!pkgToName.containsKey(pkg)) pkgToName.put(pkg, resolveAppName(pkg, pm));
                sessions.add(new AppSession(pkgToName.get(pkg), e.getValue(), now));
            }
        }
        return sessions;
    }

    private List<AppSession> filterByBucket(List<AppSession> all, BucketConfig bucket) {
        List<AppSession> result = new ArrayList<>();
        for (AppSession s : all) {
            for (String a : bucket.apps) {
                if (a.toLowerCase(Locale.ROOT).equals(s.appName.toLowerCase(Locale.ROOT))) {
                    result.add(s);
                    break;
                }
            }
        }
        return result;
    }

    private List<long[]> mergeSegments(List<AppSession> sessions, int toleranceSec) {
        sessions.sort((a, b) -> Long.compare(a.start, b.start));
        long segStart = sessions.get(0).start, segEnd = sessions.get(0).end;
        List<long[]> segments = new ArrayList<>();
        for (int i = 1; i < sessions.size(); i++) {
            if (sessions.get(i).start - segEnd <= toleranceSec * 1000L) {
                segEnd = Math.max(segEnd, sessions.get(i).end);
            } else {
                segments.add(new long[]{ segStart, segEnd });
                segStart = sessions.get(i).start;
                segEnd = sessions.get(i).end;
            }
        }
        segments.add(new long[]{ segStart, segEnd });
        return segments;
    }

    String resolveAppName(String pkg, PackageManager pm) {
        try {
            android.content.pm.ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (PackageManager.NameNotFoundException e) {
            int dot = pkg.lastIndexOf('.');
            return dot >= 0 ? pkg.substring(dot + 1) : pkg;
        }
    }

    // ── 消费时长持久化（per-key） ──

    private SharedPreferences getPrefs() {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private String todayStr() {
        Calendar cal = Calendar.getInstance();
        return String.format(Locale.US, "%04d-%02d-%02d",
                cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH));
    }

    long getConsumedMs(String bucketId) {
        SharedPreferences prefs = getPrefs();
        String today = todayStr();
        if (!today.equals(prefs.getString(PREFS_FIRED_DATE, ""))) return 0;
        long val = prefs.getLong("consumed_" + bucketId, 0);
        if (val == 0) {
            val = readLegacyConsumed(prefs, bucketId);
        }
        return val;
    }

    void setConsumedMs(String bucketId, long consumedMs) {
        getPrefs().edit()
                .putString(PREFS_FIRED_DATE, todayStr())
                .putLong("consumed_" + bucketId, consumedMs)
                .apply();
    }

    /** 兼容旧版管道符格式 "|bucketId:value|" */
    private long readLegacyConsumed(SharedPreferences prefs, String bucketId) {
        String savedIds = prefs.getString("fired_ids", "");
        if (savedIds.isEmpty()) return 0;
        String token = "|" + bucketId + ":";
        int idx = savedIds.lastIndexOf(token);
        if (idx < 0) return 0;
        int valStart = idx + token.length();
        int valEnd = savedIds.indexOf("|", valStart);
        if (valEnd < 0) return 0;
        try {
            long val = Long.parseLong(savedIds.substring(valStart, valEnd));
            if (val > 86400000L) {
                logD("BucketMonitor: detected stale legacy value " + val + " for bucket=" + bucketId);
                return 0;
            }
            return val;
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    // ── 工具 ──

    private static String fmtMin(long ms) {
        return String.format(Locale.US, "%.1f", ms / 60000.0);
    }

    private static void logD(String msg) {
        Log.d(TAG, msg);
        FloatingService.addLog("D", msg);
    }

    private static void logE(String msg, Throwable t) {
        Log.e(TAG, msg, t);
        FloatingService.addLog("E", msg + " | " + t.getClass().getSimpleName() + ": " + t.getMessage());
    }
}
