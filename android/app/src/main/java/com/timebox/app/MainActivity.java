package com.timebox.app;

import android.app.ActivityManager;
import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatingPlugin.class); // Must be BEFORE super.onCreate()
        super.onCreate(savedInstanceState);
    }

    @CapacitorPlugin(name = "FloatingWindow")
    public static class FloatingPlugin extends Plugin {
        private static final String TAG = "TimeBox.Plugin";

        // ─── Service State Sync ─────────────────────────────
        @PluginMethod
        public void getStatus(PluginCall call) {
            Log.d(TAG, "getStatus called");
            JSObject ret = new JSObject();
            ret.put("isRunning", FloatingService.isServiceRunning());
            ret.put("startTime", FloatingService.getStartTime());
            ret.put("elapsed", FloatingService.getElapsed());
            ret.put("name", FloatingService.getTaskName());
            call.resolve(ret);
        }

        // ─── Device Info (for frontend guidance) ────────────
        @PluginMethod
        public void getDeviceInfo(PluginCall call) {
            Log.d(TAG, "getDeviceInfo called");
            JSObject ret = new JSObject();
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("brand", Build.BRAND);
            ret.put("model", Build.MODEL);
            ret.put("isHonor", isHonor());
            ret.put("isHuawei", isHuawei());
            ret.put("isXiaomi", isXiaomi());

            boolean overlayGranted = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                overlayGranted = Settings.canDrawOverlays(getContext());
            }
            ret.put("overlayGranted", overlayGranted);

            boolean batteryOptimized = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    batteryOptimized = !pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                }
            }
            ret.put("batteryOptimized", batteryOptimized);

            ret.put("usagePermission", hasUsageStatsPermission());

            call.resolve(ret);
        }

        // ─── 新增：完整诊断信息（含 Native 日志） ──────────────
        @PluginMethod
        public void getDiagnosticInfo(PluginCall call) {
            Log.d(TAG, "getDiagnosticInfo called");
            JSObject info = new JSObject();

            // 设备信息
            info.put("manufacturer", Build.MANUFACTURER);
            info.put("model", Build.MODEL);
            info.put("brand", Build.BRAND);
            info.put("sdkVersion", Build.VERSION.SDK_INT);
            info.put("release", Build.VERSION.RELEASE);
            info.put("isHonor", isHonor());
            info.put("isHuawei", isHuawei());
            info.put("isXiaomi", isXiaomi());

            // 权限状态
            boolean canDrawOverlays = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                canDrawOverlays = Settings.canDrawOverlays(getContext());
            }
            info.put("canDrawOverlays", canDrawOverlays);

            int usageMode = getUsageStatsPermissionMode();
            info.put("usageStatsPermissionMode", usageMode);
            info.put("usageStatsPermissionLabel", permissionModeLabel(usageMode));
            info.put("usagePermission", hasUsageStatsPermission());

            // 电池优化
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            boolean batteryExempt = false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
                batteryExempt = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
            info.put("isIgnoringBatteryOptimizations", batteryExempt);

            // 服务状态
            info.put("foregroundServiceRunning", FloatingService.isServiceRunning());

            // UsageStats 快速查询计数
            long now = System.currentTimeMillis();
            long dayAgo = now - 24L * 60L * 60L * 1000L;
            UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm != null && hasUsageStatsPermission()) {
                try {
                    List<UsageStats> daily = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, dayAgo, now);
                    List<UsageStats> best = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, dayAgo, now);
                    info.put("usageStatsDailyCount", daily != null ? daily.size() : -1);
                    info.put("usageStatsBestCount", best != null ? best.size() : -1);
                } catch (Exception e) {
                    Log.e(TAG, "getDiagnosticInfo: UsageStats query failed", e);
                    info.put("usageStatsDailyCount", -1);
                    info.put("usageStatsBestCount", -1);
                }
            } else {
                info.put("usageStatsDailyCount", -1);
                info.put("usageStatsBestCount", -1);
            }

            // 进程重要性
            info.put("currentProcessImportance", getCurrentProcessImportance());

            // 最近 native 日志
            JSArray logsArray = new JSArray();
            for (String log : FloatingService.getRecentLogs()) {
                logsArray.put(log);
            }
            info.put("recentNativeLogs", logsArray);

            info.put("timestamp", now);
            call.resolve(info);
        }

        // ─── Overlay Permission ─────────────────────────────
        @PluginMethod
        public void checkPermission(PluginCall call) {
            boolean granted = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                granted = Settings.canDrawOverlays(getContext());
            }
            Log.d(TAG, "checkPermission: overlayGranted=" + granted);
            call.resolve(new JSObject().put("granted", granted));
        }

        @PluginMethod
        public void requestPermission(PluginCall call) {
            Log.d(TAG, "requestPermission called, canDrawOverlays=" +
                    (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? Settings.canDrawOverlays(getContext()) : true));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
                boolean opened = false;
                // 荣耀/华为: 先尝试专属路径
                if (isHonor() || isHuawei()) {
                    String[][] targets = {
                        {"com.android.settings", "com.android.settings.Settings$AppDrawOverlaySettingsActivity"},
                        {"com.hihonor.android.settings", "com.hihonor.android.settings.overlay.OverlayActivity"},
                    };
                    for (String[] t : targets) {
                        try {
                            Intent i = new Intent();
                            i.setComponent(new ComponentName(t[0], t[1]));
                            i.setData(Uri.parse("package:" + getContext().getPackageName()));
                            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            getContext().startActivity(i);
                            opened = true;
                            Log.d(TAG, "requestPermission: opened via " + t[1]);
                            break;
                        } catch (Exception e) {
                            Log.d(TAG, "requestPermission: " + t[1] + " failed");
                        }
                    }
                }
                if (!opened) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                Uri.parse("package:" + getContext().getPackageName()));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                        Log.d(TAG, "requestPermission: standard intent sent");
                    } catch (Exception e) {
                        Log.e(TAG, "requestPermission: all intents failed", e);
                    }
                }
            }
            call.resolve();
        }

        // ─── Battery Optimization ───────────────────────────
        @PluginMethod
        public void requestBatteryOptimization(PluginCall call) {
            Log.d(TAG, "requestBatteryOptimization called");
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    getContext().startActivity(intent);
                }
            } catch (Exception e) {
                Log.w(TAG, "Battery optimization request failed", e);
            }
            call.resolve();
        }

        // ─── OEM-specific launch manager ────────────────────
        @PluginMethod
        public void openLaunchManager(PluginCall call) {
            Log.d(TAG, "openLaunchManager called");
            boolean opened = false;

            if (isHonor() || isHuawei()) {
                opened = openHonorHuaweiLaunchManager();
            } else if (isXiaomi()) {
                opened = openXiaomiPermissionPage();
            }

            if (!opened) {
                try {
                    Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    opened = true;
                } catch (Exception e) {
                    Log.e(TAG, "Failed to open app details", e);
                }
            }

            call.resolve(new JSObject().put("opened", opened));
        }

        // ─── Brand detection ────────────────────────────────
        private boolean isHonor() {
            String manufacturer = Build.MANUFACTURER.toLowerCase();
            String brand = Build.BRAND.toLowerCase();
            return manufacturer.contains("honor") || brand.contains("honor");
        }

        private boolean isHuawei() {
            String manufacturer = Build.MANUFACTURER.toLowerCase();
            String brand = Build.BRAND.toLowerCase();
            return manufacturer.contains("huawei") || brand.contains("huawei");
        }

        private boolean isXiaomi() {
            String manufacturer = Build.MANUFACTURER.toLowerCase();
            return manufacturer.contains("xiaomi") || manufacturer.contains("redmi");
        }

        private boolean openHonorHuaweiLaunchManager() {
            String[][] targets = {
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"},
                {"com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            };

            for (String[] target : targets) {
                try {
                    Intent intent = new Intent();
                    intent.setComponent(new ComponentName(target[0], target[1]));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    Log.i(TAG, "Opened launch manager: " + target[1]);
                    return true;
                } catch (Exception e) {
                    Log.d(TAG, "Failed to open: " + target[1]);
                }
            }
            return false;
        }

        private boolean openXiaomiPermissionPage() {
            try {
                Intent intent = new Intent("miui.intent.action.APP_OPS_SETTINGS");
                intent.putExtra("extra_pkgname", getContext().getPackageName());
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        // ─── Floating Window Control ────────────────────────
        @PluginMethod
        public void startFloating(PluginCall call) {
            String name = call.getString("name", "计时中");
            long startTime = call.getLong("startTime", 0L);
            long elapsed = call.getLong("elapsed", 0L);
            Log.d(TAG, "startFloating: name=" + name + ", startTime=" + startTime + ", elapsed=" + elapsed);

            Intent intent = new Intent(getContext(), FloatingService.class);
            String color = call.getString("color", "#10B981");
            intent.putExtra("name", name);
            intent.putExtra("startTime", startTime);
            intent.putExtra("elapsed", elapsed);
            intent.putExtra("color", color);

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getContext().startForegroundService(intent);
                } else {
                    getContext().startService(intent);
                }
                Log.d(TAG, "startFloating: service started OK");
            } catch (Exception e) {
                Log.e(TAG, "startFloating: FAILED to start service", e);
            }
            call.resolve();
        }

        @PluginMethod
        public void removeTask(PluginCall call) {
            String name = call.getString("name", "");
            Log.d(TAG, "removeTask: name=" + name);
            FloatingService.activeTasks.removeIf(t -> t.name.equals(name));
            FloatingService.tasksNeedRebuild = true;
            call.resolve();
        }

        @PluginMethod
        public void getActiveTasks(PluginCall call) {
            JSArray arr = new JSArray();
            for (java.util.Map<String, Object> t : FloatingService.getActiveTasksInfo()) {
                JSObject obj = new JSObject();
                obj.put("name", (String) t.get("name"));
                obj.put("elapsed", (Long) t.get("elapsed"));
                arr.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("tasks", arr);
            call.resolve(ret);
        }

        // 从 JS 传入桶配置并启动/更新后台监控
        @PluginMethod
        public void updateBucketMonitor(PluginCall call) {
            com.getcapacitor.JSArray buckets = call.getArray("buckets");
            Log.d(TAG, "updateBucketMonitor: count=" + (buckets != null ? buckets.length() : 0));
            FloatingService.monitorBuckets.clear();
            if (buckets != null) {
                for (int i = 0; i < buckets.length(); i++) {
                    try {
                        org.json.JSONObject b = buckets.getJSONObject(i);
                        String id = b.optString("id", "");
                        String name = b.optString("name", "");
                        String color = b.optString("color", "#F59E0B");
                        int triggerMin = b.optInt("triggerMinutes", 5);
                        int toleranceSec = b.optInt("toleranceSeconds", 60);
                        org.json.JSONArray appsArr = b.optJSONArray("apps");
                        java.util.List<String> apps = new java.util.ArrayList<>();
                        if (appsArr != null) {
                            for (int j = 0; j < appsArr.length(); j++) apps.add(appsArr.getString(j));
                        }
                        FloatingService.monitorBuckets.add(
                            new FloatingService.BucketConfig(id, name, apps, triggerMin, toleranceSec, color));
                    } catch (Exception e) {
                        Log.w(TAG, "updateBucketMonitor: parse error at " + i, e);
                    }
                }
            }
            // 如果有桶配置，确保监控服务在跑
            if (!FloatingService.monitorBuckets.isEmpty()) {
                Intent intent = new Intent(getContext(), FloatingService.class);
                intent.setAction("START_MONITOR");
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        getContext().startForegroundService(intent);
                    } else {
                        getContext().startService(intent);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "updateBucketMonitor: failed to start service", e);
                }
            }
            call.resolve();
        }

        @PluginMethod
        public void showBucketAlert(PluginCall call) {
            String bucketName = call.getString("bucketName", "");
            int minutes = call.getInt("detectedMinutes", 0);
            String color = call.getString("color", "#F59E0B");
            Log.d(TAG, "showBucketAlert: bucket=" + bucketName + ", min=" + minutes);
            Intent intent = new Intent(getContext(), FloatingService.class);
            intent.setAction("BUCKET_ALERT");
            intent.putExtra("bucketName", bucketName);
            intent.putExtra("minutes", minutes);
            intent.putExtra("color", color);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getContext().startForegroundService(intent);
                } else {
                    getContext().startService(intent);
                }
            } catch (Exception e) {
                Log.e(TAG, "showBucketAlert: failed", e);
            }
            call.resolve();
        }

        @PluginMethod
        public void dismissBucketAlert(PluginCall call) {
            Log.d(TAG, "dismissBucketAlert");
            Intent intent = new Intent(getContext(), FloatingService.class);
            intent.setAction("DISMISS_BUCKET_ALERT");
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getContext().startForegroundService(intent);
                } else {
                    getContext().startService(intent);
                }
            } catch (Exception e) {
                Log.e(TAG, "dismissBucketAlert: failed", e);
            }
            call.resolve();
        }

        @PluginMethod
        public void stopFloating(PluginCall call) {
            Log.d(TAG, "stopFloating called");
            Intent intent = new Intent(getContext(), FloatingService.class);
            intent.setAction("STOP");
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    getContext().startForegroundService(intent);
                } else {
                    getContext().startService(intent);
                }
            } catch (Exception e) {
                getContext().stopService(intent);
            }
            call.resolve();
        }

        // ─── Usage Stats ────────────────────────────────────
        @PluginMethod
        public void checkUsagePermission(PluginCall call) {
            boolean granted = hasUsageStatsPermission();
            int mode = getUsageStatsPermissionMode();
            Log.d(TAG, "checkUsagePermission: granted=" + granted + ", mode=" + mode);
            JSObject ret = new JSObject();
            ret.put("granted", granted);
            ret.put("mode", mode);
            ret.put("modeLabel", permissionModeLabel(mode));
            call.resolve(ret);
        }

        @PluginMethod
        public void requestUsagePermission(PluginCall call) {
            Log.d(TAG, "requestUsagePermission called, hasPermission=" + hasUsageStatsPermission());
            if (!hasUsageStatsPermission()) {
                boolean opened = false;
                // 荣耀/华为: 直接跳转到本 App 的使用情况访问页面
                if (isHonor() || isHuawei()) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                        intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                        opened = true;
                        Log.d(TAG, "requestUsagePermission: Honor direct package intent sent");
                    } catch (Exception e) {
                        Log.w(TAG, "requestUsagePermission: Honor direct intent failed", e);
                    }
                }
                if (!opened) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getContext().startActivity(intent);
                        Log.d(TAG, "requestUsagePermission: standard intent sent");
                    } catch (Exception e) {
                        Log.e(TAG, "requestUsagePermission: failed", e);
                    }
                }
            }
            call.resolve();
        }

        @PluginMethod
        public void getUsageStats(PluginCall call) {
            int permMode = getUsageStatsPermissionMode();
            Log.d(TAG, "getUsageStats: permMode=" + permMode + ", hasPermission=" + hasUsageStatsPermission());

            if (!hasUsageStatsPermission()) {
                JSObject errResult = new JSObject();
                errResult.put("stats", new JSArray());
                errResult.put("debug", "USAGE_ACCESS_DENIED (mode=" + permMode + ", label=" + permissionModeLabel(permMode) + ")");
                errResult.put("permissionMode", permMode);
                call.resolve(errResult);
                return;
            }

            UsageStatsManager usm = (UsageStatsManager) getContext()
                    .getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) {
                JSObject errResult = new JSObject();
                errResult.put("stats", new JSArray());
                errResult.put("debug", "UsageStatsManager is null");
                call.resolve(errResult);
                return;
            }

            long endTime = call.getLong("endTime", System.currentTimeMillis());
            long startTime = call.getLong("startTime", endTime - 86400000L);

            Log.i(TAG, "Querying usage stats from " + startTime + " to " + endTime);

            // 多策略查询：BEST → DAILY → WEEKLY
            String usedInterval = "BEST";
            List<UsageStats> statsList = usm.queryUsageStats(UsageStatsManager.INTERVAL_BEST, startTime, endTime);
            int bestCount = statsList != null ? statsList.size() : 0;

            if (statsList == null || statsList.isEmpty()) {
                Log.w(TAG, "INTERVAL_BEST returned empty, trying INTERVAL_DAILY");
                usedInterval = "DAILY";
                statsList = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
            }
            int dailyCount = statsList != null ? statsList.size() : 0;

            if (statsList == null || statsList.isEmpty()) {
                Log.w(TAG, "INTERVAL_DAILY also empty, trying wider 7-day WEEKLY range");
                usedInterval = "WEEKLY";
                Calendar cal = Calendar.getInstance();
                cal.add(Calendar.DAY_OF_YEAR, -7);
                statsList = usm.queryUsageStats(UsageStatsManager.INTERVAL_WEEKLY, cal.getTimeInMillis(), System.currentTimeMillis());
            }
            int weeklyCount = statsList != null ? statsList.size() : 0;

            if (statsList == null || statsList.isEmpty()) {
                JSObject result = new JSObject();
                result.put("stats", new JSArray());
                result.put("debug", "All intervals empty. BEST=" + bestCount + " DAILY=" + dailyCount
                        + " WEEKLY=" + weeklyCount + " manufacturer=" + Build.MANUFACTURER
                        + " permMode=" + permMode);
                result.put("queryAttempts", new JSObject()
                        .put("BEST", bestCount).put("DAILY", dailyCount).put("WEEKLY", weeklyCount));
                call.resolve(result);
                return;
            }

            Log.i(TAG, "Got " + statsList.size() + " entries via " + usedInterval);

            Map<String, Long> aggregatedTime = new HashMap<>();
            Map<String, Long> lastUsedMap = new HashMap<>();

            for (UsageStats stats : statsList) {
                String pkg = stats.getPackageName();
                long total = stats.getTotalTimeInForeground();
                if (total <= 0) continue;

                aggregatedTime.put(pkg, aggregatedTime.getOrDefault(pkg, 0L) + total);
                long lastUsed = stats.getLastTimeUsed();
                if (lastUsed > lastUsedMap.getOrDefault(pkg, 0L)) {
                    lastUsedMap.put(pkg, lastUsed);
                }
            }

            PackageManager pkgMgr = getContext().getPackageManager();
            JSArray results = new JSArray();

            for (Map.Entry<String, Long> entry : aggregatedTime.entrySet()) {
                String pkg = entry.getKey();
                long totalTime = entry.getValue();
                if (totalTime < 30000) continue;

                JSObject item = new JSObject();
                item.put("packageName", pkg);
                item.put("totalTimeMs", totalTime);
                item.put("lastUsed", lastUsedMap.getOrDefault(pkg, 0L));

                item.put("appName", getAppLabel(pkg, pkgMgr));
                results.put(item);
            }

            JSObject result = new JSObject();
            result.put("stats", results);
            result.put("debug", "OK: " + statsList.size() + " raw via " + usedInterval
                    + ", " + results.length() + " aggregated"
                    + " (BEST=" + bestCount + " DAILY=" + dailyCount + " WEEKLY=" + weeklyCount + ")");
            result.put("queryAttempts", new JSObject()
                    .put("BEST", bestCount).put("DAILY", dailyCount).put("WEEKLY", weeklyCount));
            call.resolve(result);
        }

        // ─── Usage Events (Gantt Timeline) ─────────────────
        @PluginMethod
        public void getUsageEvents(PluginCall call) {
            if (!hasUsageStatsPermission()) {
                JSObject err = new JSObject();
                err.put("sessions", new JSArray());
                err.put("debug", "USAGE_ACCESS_DENIED");
                call.resolve(err);
                return;
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
                JSObject err = new JSObject();
                err.put("sessions", new JSArray());
                err.put("debug", "API_TOO_LOW");
                call.resolve(err);
                return;
            }

            UsageStatsManager usm = (UsageStatsManager) getContext()
                    .getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) {
                call.reject("UsageStatsManager null");
                return;
            }

            long endTime = call.getLong("endTime", System.currentTimeMillis());
            long startTime = call.getLong("startTime", endTime - 86400000L);

            android.app.usage.UsageEvents events = usm.queryEvents(startTime, endTime);
            Map<String, Long> resumeMap = new HashMap<>();
            JSArray sessions = new JSArray();
            PackageManager pm = getContext().getPackageManager();

            while (events.hasNextEvent()) {
                android.app.usage.UsageEvents.Event ev = new android.app.usage.UsageEvents.Event();
                events.getNextEvent(ev);
                String pkg = ev.getPackageName();

                if (ev.getEventType() == android.app.usage.UsageEvents.Event.ACTIVITY_RESUMED) {
                    resumeMap.put(pkg, ev.getTimeStamp());
                } else if (ev.getEventType() == android.app.usage.UsageEvents.Event.ACTIVITY_PAUSED) {
                    Long t0 = resumeMap.remove(pkg);
                    if (t0 != null && ev.getTimeStamp() - t0 >= 3000) {
                        JSObject s = new JSObject();
                        s.put("packageName", pkg);
                        s.put("appName", getAppLabel(pkg, pm));
                        s.put("start", t0);
                        s.put("end", ev.getTimeStamp());
                        sessions.put(s);
                    }
                }
            }

            // 仍在前台的 app（未收到 PAUSED）
            long now = System.currentTimeMillis();
            for (Map.Entry<String, Long> e : resumeMap.entrySet()) {
                long dur = now - e.getValue();
                if (dur >= 3000) {
                    JSObject s = new JSObject();
                    s.put("packageName", e.getKey());
                    s.put("appName", getAppLabel(e.getKey(), pm));
                    s.put("start", e.getValue());
                    s.put("end", Math.min(now, endTime));
                    sessions.put(s);
                }
            }

            JSObject result = new JSObject();
            result.put("sessions", sessions);
            call.resolve(result);
        }

        // ─── App 名称解析（方案A: QUERY_ALL_PACKAGES + 方案B: 映射表） ──
        private static final java.util.Map<String, String> APP_NAME_MAP;
        static {
            APP_NAME_MAP = new java.util.HashMap<>();
            APP_NAME_MAP.put("com.tencent.mm", "微信");
            APP_NAME_MAP.put("com.tencent.mobileqq", "QQ");
            APP_NAME_MAP.put("com.xingin.xhs", "小红书");
            APP_NAME_MAP.put("com.ss.android.ugc.aweme", "抖音");
            APP_NAME_MAP.put("com.zhiliaoapp.musically", "抖音");
            APP_NAME_MAP.put("com.sina.weibo", "微博");
            APP_NAME_MAP.put("com.weibo.android", "微博");
            APP_NAME_MAP.put("tv.danmaku.bili", "哔哩哔哩");
            APP_NAME_MAP.put("com.bilibili.app.blue", "哔哩哔哩");
            APP_NAME_MAP.put("com.taobao.taobao", "淘宝");
            APP_NAME_MAP.put("com.eg.android.AlipayGphone", "支付宝");
            APP_NAME_MAP.put("com.jingdong.app.mall", "京东");
            APP_NAME_MAP.put("com.netease.cloudmusic", "网易云音乐");
            APP_NAME_MAP.put("com.kugou.android", "酷狗音乐");
            APP_NAME_MAP.put("com.tencent.qqlive", "腾讯视频");
            APP_NAME_MAP.put("com.iqiyi.video", "爱奇艺");
            APP_NAME_MAP.put("com.youku.phone", "优酷");
            APP_NAME_MAP.put("com.baidu.BaiduMap", "百度地图");
            APP_NAME_MAP.put("com.amap.android.navi", "高德地图");
            APP_NAME_MAP.put("com.didi.es.activity", "滴滴出行");
            APP_NAME_MAP.put("com.meituan.mt", "美团");
            APP_NAME_MAP.put("com.sankuai.meituan.takeoutnew", "美团外卖");
            APP_NAME_MAP.put("com.eleme.android", "饿了么");
            APP_NAME_MAP.put("com.pdd.buyer", "拼多多");
            APP_NAME_MAP.put("com.zhihu.android", "知乎");
            APP_NAME_MAP.put("com.ss.android.article.news", "今日头条");
            APP_NAME_MAP.put("com.tencent.news", "腾讯新闻");
            APP_NAME_MAP.put("com.alibaba.android.rimet", "钉钉");
            APP_NAME_MAP.put("com.tencent.wework", "企业微信");
            APP_NAME_MAP.put("com.baidu.searchbox", "百度");
            APP_NAME_MAP.put("com.UCMobile", "UC浏览器");
            APP_NAME_MAP.put("com.taptap", "TapTap");
            APP_NAME_MAP.put("com.wepie.ivy", "蜂巢");
            APP_NAME_MAP.put("com.hihonor.android.launcher", "桌面");
            APP_NAME_MAP.put("com.android.settings", "设置");
            APP_NAME_MAP.put("com.android.packageinstaller", "安装程序");
            APP_NAME_MAP.put("com.hihonor.photos", "图库");
            APP_NAME_MAP.put("com.hihonor.camera", "相机");
            APP_NAME_MAP.put("com.hihonor.filemanager", "文件管理");
            APP_NAME_MAP.put("com.hihonor.deskclock", "时钟");
        }

        private String getAppLabel(String pkg, PackageManager pm) {
            try {
                ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                return pm.getApplicationLabel(ai).toString();
            } catch (PackageManager.NameNotFoundException e) {
                String mapped = APP_NAME_MAP.get(pkg);
                if (mapped != null) return mapped;
                int dot = pkg.lastIndexOf('.');
                return dot >= 0 ? pkg.substring(dot + 1) : pkg;
            }
        }

        // ─── 内部工具 ──────────────────────────────────────
        private boolean hasUsageStatsPermission() {
            int mode = getUsageStatsPermissionMode();
            if (mode == AppOpsManager.MODE_DEFAULT) {
                return getContext().checkCallingOrSelfPermission(android.Manifest.permission.PACKAGE_USAGE_STATS)
                    == PackageManager.PERMISSION_GRANTED;
            }
            return mode == AppOpsManager.MODE_ALLOWED;
        }

        private int getUsageStatsPermissionMode() {
            AppOpsManager appOps = (AppOpsManager) getContext()
                    .getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return -1;
            // API 29+ 使用 unsafeCheckOpNoThrow 避免 deprecated 警告
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    getContext().getPackageName());
            } else {
                return appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    getContext().getPackageName());
            }
        }

        private int getCurrentProcessImportance() {
            ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
            if (am == null) return -1;
            List<ActivityManager.RunningAppProcessInfo> procs = am.getRunningAppProcesses();
            if (procs == null) return -1;
            int myPid = Process.myPid();
            for (ActivityManager.RunningAppProcessInfo info : procs) {
                if (info.pid == myPid) return info.importance;
            }
            return -1;
        }

        private static String permissionModeLabel(int mode) {
            switch (mode) {
                case AppOpsManager.MODE_ALLOWED: return "ALLOWED";
                case AppOpsManager.MODE_IGNORED: return "IGNORED";
                case AppOpsManager.MODE_ERRORED: return "ERRORED";
                case AppOpsManager.MODE_DEFAULT: return "DEFAULT";
                default: return "UNKNOWN(" + mode + ")";
            }
        }
    }
}
