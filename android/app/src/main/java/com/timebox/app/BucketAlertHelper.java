package com.timebox.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

/**
 * 桶检测 Alert 悬浮 banner 的 UI 构建与管理。
 * 从 FloatingService 中提取，职责单一。
 */
public class BucketAlertHelper {

    private static final String TAG = "TimeBox.Float";
    static final int NOTIF_ALERT_ID = 102;
    static final String ALERT_CHANNEL_ID = "bucket_alert_channel";
    private static final int AUTO_DISMISS_MS = 15000;

    /** 用户操作回调 */
    public interface AlertCallback {
        void onConfirm(String bucketId, String bucketName, String colorHex,
                       int minutes, boolean isRealtime, long trueStart, long trueEnd);
        void onDismiss();
    }

    private final Context context;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private View alertView;
    private final Runnable autoDismiss = this::remove;

    public BucketAlertHelper(Context context) {
        this.context = context;
    }

    public boolean isShowing() { return alertView != null; }

    public void show(WindowManager wm, String bucketId, String bucketName,
                     int minutes, String colorHex, boolean isRealtime,
                     long trueStart, long trueEnd, AlertCallback callback) {
        this.windowManager = wm;

        if (!android.provider.Settings.canDrawOverlays(context)) {
            logD("showBucketAlert: no overlay permission");
            return;
        }
        handler.removeCallbacks(autoDismiss);
        remove();

        int parsedColor;
        try { parsedColor = Color.parseColor(colorHex != null ? colorHex : "#F59E0B"); }
        catch (Exception e) { parsedColor = Color.parseColor("#F59E0B"); }
        final int accentColor = parsedColor;

        // ── 根容器 ──
        LinearLayout root = new LinearLayout(context);
        root.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable rootBg = new GradientDrawable();
        rootBg.setColor(Color.parseColor("#F0161820"));
        rootBg.setCornerRadius(dp(12));
        rootBg.setStroke(dp(1), Color.parseColor("#2A2D3A"));
        root.setBackground(rootBg);
        root.setPadding(dp(14), dp(12), dp(14), dp(12));
        root.setElevation(dp(8));

        // ── 顶行：色条 + 文字 + 关闭按钮 ──
        LinearLayout topRow = new LinearLayout(context);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(Gravity.CENTER_VERTICAL);

        View accent = new View(context);
        GradientDrawable accentBg = new GradientDrawable();
        accentBg.setColor(accentColor);
        accentBg.setCornerRadius(dp(2));
        accent.setBackground(accentBg);
        LinearLayout.LayoutParams accentP = new LinearLayout.LayoutParams(dp(3), dp(32));
        accentP.setMarginEnd(dp(10));
        topRow.addView(accent, accentP);

        LinearLayout textCol = new LinearLayout(context);
        textCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams textColP = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        textColP.setMarginEnd(dp(10));

        TextView titleView = new TextView(context);
        titleView.setText("检测到「" + bucketName + "」");
        titleView.setTextColor(Color.parseColor("#E8EAF0"));
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        titleView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);

        TextView subView = new TextView(context);
        subView.setText(isRealtime
                ? "已连续使用约 " + minutes + " 分钟，开始计时？"
                : "已使用约 " + minutes + " 分钟，记录为历史？");
        subView.setTextColor(Color.parseColor("#8B8FA8"));
        subView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);

        textCol.addView(titleView);
        textCol.addView(subView);
        topRow.addView(textCol, textColP);

        TextView closeBtn = new TextView(context);
        closeBtn.setText("✕");
        closeBtn.setTextColor(Color.parseColor("#525675"));
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        closeBtn.setPadding(dp(6), dp(2), 0, dp(2));
        closeBtn.setOnClickListener(v -> {
            handler.removeCallbacks(autoDismiss);
            remove();
            callback.onDismiss();
        });
        topRow.addView(closeBtn);
        root.addView(topRow);

        // ── 按钮行 ──
        LinearLayout btnRow = new LinearLayout(context);
        btnRow.setOrientation(LinearLayout.HORIZONTAL);
        btnRow.setGravity(Gravity.END);
        LinearLayout.LayoutParams btnRowP = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        btnRowP.topMargin = dp(10);

        TextView confirmBtn = new TextView(context);
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
            handler.removeCallbacks(autoDismiss);
            remove();
            callback.onConfirm(bucketId, bucketName, colorHex, minutes, isRealtime, trueStart, trueEnd);
        });
        btnRow.addView(confirmBtn);
        root.addView(btnRow, btnRowP);

        // ── 加入 WindowManager ──
        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.FILL_HORIZONTAL;
        params.x = dp(12);
        params.y = dp(60);
        params.width = WindowManager.LayoutParams.MATCH_PARENT;

        try {
            wm.addView(root, params);
            alertView = root;
            logD("showBucketAlert: overlay added for " + bucketName);
        } catch (Exception e) {
            logE("showBucketAlert: addView failed", e);
        }

        handler.postDelayed(autoDismiss, AUTO_DISMISS_MS);
    }

    public void remove() {
        handler.removeCallbacks(autoDismiss);
        if (alertView != null && windowManager != null) {
            try { windowManager.removeView(alertView); } catch (Exception ignored) {}
            alertView = null;
            logD("removeBucketAlert: overlay removed");
        }
    }

    // ── 通知 ──

    public static void createAlertNotificationChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    ALERT_CHANNEL_ID, "TimeBox 使用检测", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setShowBadge(true);
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    public static Notification buildAlertNotification(Context ctx, String bucketName) {
        Intent ni = new Intent(ctx, MainActivity.class);
        ni.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pi = PendingIntent.getActivity(ctx, 1, ni,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(ctx, ALERT_CHANNEL_ID)
                .setContentTitle("检测到「" + bucketName + "」使用")
                .setContentText("点击进入 TimeBox 确认计时")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
    }

    // ── 工具 ──

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP, value, context.getResources().getDisplayMetrics());
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
