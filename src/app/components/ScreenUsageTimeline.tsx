import { useEffect, useState, useMemo } from "react";
import { Smartphone, AlertTriangle, RefreshCw, Shield, Settings, ChevronRight } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { registerPlugin } from "@capacitor/core";

// Plugin bridge
const FloatingWindow: any =
  Capacitor.getPlatform() === "android" ? registerPlugin("FloatingWindow") : null;

interface UsageItem {
  appName: string;
  packageName: string;
  totalTimeMs: number;
  lastUsed: number;
}

interface DeviceInfo {
  manufacturer: string;
  brand: string;
  model: string;
  isHonor: boolean;
  isHuawei: boolean;
  isXiaomi: boolean;
  overlayGranted: boolean;
  batteryOptimized: boolean;
  usagePermission: boolean;
}

interface DiagnosticInfo {
  manufacturer: string;
  model: string;
  brand: string;
  sdkVersion: number;
  release: string;
  isHonor: boolean;
  isHuawei: boolean;
  isXiaomi: boolean;
  canDrawOverlays: boolean;
  usageStatsPermissionMode: number;
  usageStatsPermissionLabel: string;
  usagePermission: boolean;
  isIgnoringBatteryOptimizations: boolean;
  foregroundServiceRunning: boolean;
  usageStatsDailyCount: number;
  usageStatsBestCount: number;
  currentProcessImportance: number;
  recentNativeLogs: string[];
  timestamp: number;
}

// ─── Shared app color palette (same as Timeline.tsx) ─────────────────
const APP_COLOR_KNOWN: Record<string, string> = {
  微信: "#07C160", QQ: "#12B7F5", 抖音: "#FE2C55",
  哔哩哔哩: "#FB7299", 淘宝: "#FF5000", 支付宝: "#1677FF",
  Chrome: "#4285F4", YouTube: "#FF0000", Instagram: "#E1306C",
};
const APP_COLOR_PALETTE = [
  "#06B6D4", "#A855F7", "#10B981", "#F59E0B", "#EF4444",
  "#4F7FFF", "#EC4899", "#8B5CF6", "#F97316", "#3B82F6",
  "#84CC16", "#E879F9",
];

function getAppStyle(name: string): { color: string; bg: string } {
  for (const key of Object.keys(APP_COLOR_KNOWN)) {
    if (name.includes(key)) {
      const c = APP_COLOR_KNOWN[key];
      return { color: c, bg: `${c}20` };
    }
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = APP_COLOR_PALETTE[Math.abs(hash) % APP_COLOR_PALETTE.length];
  return { color: c, bg: `${c}20` };
}

function formatMs(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}分钟`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

interface UsageSession {
  appName: string;
  packageName: string;
  start: number; // ms
  end: number;   // ms
}

export function ScreenUsageTimeline({ selectedDate }: { selectedDate: Date }) {
  const [stats, setStats] = useState<UsageItem[]>([]);
  const [usageSessions, setUsageSessions] = useState<UsageSession[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGantt, setShowGantt] = useState(true);
  const [debugLog, setDebugLog] = useState("");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [diagInfo, setDiagInfo] = useState<DiagnosticInfo | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  const [showNativeLogs, setShowNativeLogs] = useState(false);

  const isAndroid = Capacitor.getPlatform() === "android";

  async function fetchDeviceInfo() {
    if (!FloatingWindow) return;
    try {
      const info = await FloatingWindow.getDeviceInfo();
      setDeviceInfo(info);
    } catch (e) {
      console.warn("getDeviceInfo failed:", e);
    }
  }

  async function fetchDiagnosticInfo() {
    if (!FloatingWindow) return;
    try {
      const info = await FloatingWindow.getDiagnosticInfo();
      setDiagInfo(info);
    } catch (e) {
      console.warn("getDiagnosticInfo failed:", e);
    }
  }

  async function checkAndLoad() {
    if (!isAndroid || !FloatingWindow) {
      setHasPermission(false);
      return;
    }

    await fetchDeviceInfo();
    await fetchDiagnosticInfo();

    try {
      const res = await FloatingWindow.checkUsagePermission();
      setHasPermission(res.granted);
      if (res.granted) {
        await loadStats();
      }
    } catch (err) {
      console.warn("Usage check failed:", err);
      setHasPermission(false);
    }
  }

  async function requestPerm() {
    if (!FloatingWindow) return;
    await FloatingWindow.requestUsagePermission();
    setTimeout(checkAndLoad, 2000);
  }

  async function openLaunchManager() {
    if (!FloatingWindow) return;
    await FloatingWindow.openLaunchManager();
  }

  async function requestBatteryOpt() {
    if (!FloatingWindow) return;
    await FloatingWindow.requestBatteryOptimization();
  }

  async function requestOverlay() {
    if (!FloatingWindow) return;
    await FloatingWindow.requestPermission();
  }

  async function loadStats() {
    if (!FloatingWindow) return;
    setLoading(true);

    const d = new Date(selectedDate.getTime());
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 24 * 60 * 60 * 1000;

    try {
      const res = await FloatingWindow.getUsageStats({
        startTime: start,
        endTime: Math.min(end, Date.now()),
      });
      const debugStr = res.debug || "";
      setDebugLog(debugStr);
      const items: UsageItem[] = res.stats || [];
      items.sort((a: UsageItem, b: UsageItem) => b.totalTimeMs - a.totalTimeMs);
      setStats(items);
    } catch (err: any) {
      console.warn("Usage stats load failed:", err);
      setDebugLog(err?.message || String(err));
    } finally {
      setLoading(false);
    }

    // Load Gantt events
    await loadUsageEvents();
  }

  async function loadUsageEvents() {
    if (!FloatingWindow) return;
    const d = new Date(selectedDate.getTime());
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    try {
      const res = await FloatingWindow.getUsageEvents({
        startTime: start,
        endTime: Math.min(end, Date.now()),
      });
      const sessions: UsageSession[] = res.sessions || [];
      setUsageSessions(sessions);
    } catch (err: any) {
      console.warn("Usage events load failed:", err);
    }
  }

  useEffect(() => {
    checkAndLoad();
  }, [selectedDate]);

  const totalScreenTime = useMemo(
    () => stats.reduce((s, item) => s + item.totalTimeMs, 0),
    [stats]
  );

  const dayStart = useMemo(() => {
    const d = new Date(selectedDate.getTime());
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [selectedDate]);

  const dayMs = 24 * 60 * 60 * 1000;

  const groupedApps = useMemo(() => {
    const map = new Map<string, UsageSession[]>();
    usageSessions.forEach((s) => {
      if (!map.has(s.appName)) map.set(s.appName, []);
      map.get(s.appName)!.push(s);
    });
    return Array.from(map.entries())
      .map(([appName, sessions]) => ({
        appName,
        sessions,
        totalMs: sessions.reduce((sum, s) => sum + (s.end - s.start), 0),
      }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 15);
  }, [usageSessions]);

  const isOemDevice = deviceInfo && (deviceInfo.isHonor || deviceInfo.isHuawei || deviceInfo.isXiaomi);
  const brandName = deviceInfo?.isHonor ? "荣耀" : deviceInfo?.isHuawei ? "华为" : deviceInfo?.isXiaomi ? "小米" : "你的设备";

  // Non-Android fallback
  if (!isAndroid) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center text-center"
        style={{ background: "#161820", border: "1px solid #252836", minHeight: 200 }}
      >
        <Smartphone size={32} style={{ color: "#525675", marginBottom: 12 }} />
        <p style={{ fontSize: 13, color: "#8B8FA8" }}>屏幕使用数据仅在 Android 设备上可用</p>
      </div>
    );
  }

  // Permission not granted
  if (hasPermission === false) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center text-center gap-3"
        style={{ background: "#161820", border: "1px solid #252836", minHeight: 200 }}
      >
        <AlertTriangle size={28} style={{ color: "#F59E0B" }} />
        <p style={{ fontSize: 13, color: "#8B8FA8" }}>需要"使用情况访问权限"以读取屏幕使用数据</p>
        <button
          onClick={requestPerm}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#4F7FFF,#A855F7)", color: "#fff" }}
        >
          前往授权
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#161820", border: "1px solid #252836" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid #252836" }}
      >
        <div className="flex items-center gap-2">
          <Smartphone size={15} style={{ color: "#06B6D4" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>屏幕使用时间</span>
          {totalScreenTime > 0 && (
            <span
              className="px-2 py-0.5 rounded-md"
              style={{
                fontSize: 11,
                fontWeight: 600,
                background: "rgba(6,182,212,0.12)",
                color: "#06B6D4",
              }}
            >
              {formatMs(totalScreenTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isOemDevice && (
            <button
              onClick={() => setShowSetup(!showSetup)}
              className="rounded-lg p-1.5"
              style={{ color: showSetup ? "#F59E0B" : "#8B8FA8" }}
              title="权限设置"
            >
              <Shield size={14} />
            </button>
          )}
          <button
            onClick={loadStats}
            className="rounded-lg p-1.5"
            style={{ color: "#8B8FA8" }}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* OEM Permission Guide */}
      {showSetup && isOemDevice && (
        <div className="px-4 py-3" style={{ background: "#0D0E14", borderBottom: "1px solid #252836" }}>
          <p style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600, marginBottom: 8 }}>
            {brandName}设备需要额外权限设置
          </p>
          
          {/* Step 1: Overlay */}
          <button
            onClick={requestOverlay}
            className="w-full flex items-center justify-between p-2.5 rounded-lg mb-2"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: deviceInfo?.overlayGranted ? "#10B981" : "#EF4444", fontWeight: 700 }}>
                {deviceInfo?.overlayGranted ? "✓" : "1"}
              </span>
              <span style={{ fontSize: 12, color: "#C4C8E0" }}>显示在其他应用上方</span>
            </div>
            <ChevronRight size={14} style={{ color: "#525675" }} />
          </button>

          {/* Step 2: Battery */}
          <button
            onClick={requestBatteryOpt}
            className="w-full flex items-center justify-between p-2.5 rounded-lg mb-2"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: !deviceInfo?.batteryOptimized ? "#10B981" : "#EF4444", fontWeight: 700 }}>
                {!deviceInfo?.batteryOptimized ? "✓" : "2"}
              </span>
              <span style={{ fontSize: 12, color: "#C4C8E0" }}>关闭电池优化</span>
            </div>
            <ChevronRight size={14} style={{ color: "#525675" }} />
          </button>

          {/* Step 3: Launch Manager */}
          <button
            onClick={openLaunchManager}
            className="w-full flex items-center justify-between p-2.5 rounded-lg mb-2"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700 }}>3</span>
              <span style={{ fontSize: 12, color: "#C4C8E0" }}>启动管理 (开启自启动+后台运行)</span>
            </div>
            <ChevronRight size={14} style={{ color: "#525675" }} />
          </button>

          <p style={{ fontSize: 10, color: "#525675", marginTop: 4 }}>
            设备: {deviceInfo?.manufacturer} {deviceInfo?.model}
          </p>
        </div>
      )}

      {/* Content */}
      {stats.length === 0 ? (
        <div className="py-10 text-center" style={{ color: "#525675", fontSize: 13 }}>
          {loading ? "加载中..." : "暂无屏幕使用记录"}
        </div>
      ) : (
        <div className="px-4 py-3 flex flex-col gap-2">
          {stats.slice(0, 12).map((item) => {
            const style = getAppStyle(item.appName);
            const pct = totalScreenTime > 0 ? (item.totalTimeMs / totalScreenTime) * 100 : 0;
            return (
              <div key={item.packageName}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-sm inline-block"
                      style={{ width: 8, height: 8, background: style.color, flexShrink: 0 }}
                    />
                    <span className="truncate" style={{ fontSize: 12, color: "#C4C8E0", maxWidth: 120 }}>
                      {item.appName}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      color: style.color,
                      fontWeight: 600,
                    }}
                  >
                    {formatMs(item.totalTimeMs)}
                  </span>
                </div>
                <div
                  className="rounded-full overflow-hidden"
                  style={{ height: 4, background: "#252836" }}
                >
                  <div
                    className="rounded-full transition-all duration-500"
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: style.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gantt Timeline */}
      {groupedApps.length > 0 && (
        <div style={{ borderTop: "1px solid #252836" }}>
          <button
            onClick={() => setShowGantt((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5"
            style={{ background: "transparent" }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "#C4C8E0" }}>应用使用时间轴</span>
            <span style={{ fontSize: 10, color: "#525675" }}>{showGantt ? "收起 ▲" : "展开 ▼"}</span>
          </button>
          {showGantt && (
            <div className="px-4 pb-3">
              {/* Hour ticks */}
              <div style={{ display: "flex", marginLeft: 76, marginBottom: 4, position: "relative" }}>
                {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
                  <span
                    key={h}
                    style={{
                      position: "absolute",
                      left: `${(h / 24) * 100}%`,
                      fontSize: 9,
                      color: "#525675",
                      transform: "translateX(-50%)",
                      fontFamily: "monospace",
                    }}
                  >
                    {h === 0 ? "0" : h === 24 ? "24" : `${h}`}
                  </span>
                ))}
                <div style={{ height: 14 }} />
              </div>
              {/* App rows */}
              {groupedApps.map(({ appName, sessions }) => {
                const appStyle = getAppStyle(appName);
                return (
                  <div
                    key={appName}
                    style={{ display: "flex", alignItems: "center", height: 20, marginBottom: 4 }}
                  >
                    <span
                      style={{
                        width: 72,
                        flexShrink: 0,
                        fontSize: 10,
                        color: "#C4C8E0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingRight: 6,
                      }}
                    >
                      {appName}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        position: "relative",
                        height: 10,
                        background: "#1A1D29",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      {sessions.map((sess, i) => {
                        const left = ((sess.start - dayStart) / dayMs) * 100;
                        const width = ((sess.end - sess.start) / dayMs) * 100;
                        return (
                          <div
                            key={i}
                            style={{
                              position: "absolute",
                              left: `${Math.max(0, Math.min(100, left))}%`,
                              width: `${Math.max(0.3, Math.min(100 - Math.max(0, left), width))}%`,
                              height: "100%",
                              background: appStyle.color,
                              opacity: 0.85,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {/* Current time marker */}
              <div
                style={{
                  marginLeft: 76,
                  position: "relative",
                  height: 12,
                  marginTop: 2,
                }}
              >
                {(() => {
                  const now = Date.now();
                  const nowPct = ((now - dayStart) / dayMs) * 100;
                  if (nowPct < 0 || nowPct > 100) return null;
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: `${nowPct}%`,
                        top: 0,
                        width: 1,
                        height: "100%",
                        background: "#4F7FFF",
                        opacity: 0.6,
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug Log */}
      {debugLog && (
        <div
          className="px-3 py-2 text-[10px] font-mono break-all"
          style={{ background: "#0D0E14", color: "#525675", borderTop: "1px solid #1A1D29" }}
        >
          {debugLog}
        </div>
      )}

      {/* Native 诊断面板 */}
      {isAndroid && (
        <div style={{ borderTop: "1px solid #1A1D29" }}>
          <button
            onClick={() => { setShowDiag(!showDiag); if (!diagInfo) fetchDiagnosticInfo(); }}
            className="w-full flex items-center justify-between px-4 py-2.5"
            style={{ background: "#0D0E14" }}
          >
            <span style={{ fontSize: 11, color: "#06B6D4", fontWeight: 600 }}>
              Native 诊断面板
            </span>
            <span style={{ fontSize: 10, color: "#525675" }}>
              {showDiag ? "收起 ▲" : "展开 ▼"}
            </span>
          </button>

          {showDiag && diagInfo && (
            <div className="px-4 py-3 flex flex-col gap-2" style={{ background: "#0D0E14" }}>
              {/* 设备信息 */}
              <p style={{ fontSize: 11, color: "#C4C8E0", fontWeight: 600 }}>
                {diagInfo.manufacturer} {diagInfo.model} (API {diagInfo.sdkVersion}, Android {diagInfo.release})
              </p>

              {/* 权限状态徽章 */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { ok: diagInfo.canDrawOverlays, label: diagInfo.canDrawOverlays ? "悬浮窗 ON" : "悬浮窗 OFF" },
                  { ok: diagInfo.usageStatsPermissionMode === 0, label: `UsageStats: ${diagInfo.usageStatsPermissionLabel}` },
                  { ok: diagInfo.isIgnoringBatteryOptimizations, label: diagInfo.isIgnoringBatteryOptimizations ? "电池已豁免" : "电池未豁免" },
                  { ok: diagInfo.foregroundServiceRunning, label: diagInfo.foregroundServiceRunning ? "服务运行中" : "服务未运行" },
                ].map((badge, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: badge.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                      color: badge.ok ? "#10B981" : "#EF4444",
                    }}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>

              {/* UsageStats 计数 */}
              <p style={{ fontSize: 10, color: "#525675", fontFamily: "monospace" }}>
                UsageStats: DAILY={diagInfo.usageStatsDailyCount} BEST={diagInfo.usageStatsBestCount}
                &nbsp;| 进程重要性: {diagInfo.currentProcessImportance}
              </p>

              {/* 刷新按钮 */}
              <button
                onClick={fetchDiagnosticInfo}
                className="self-start px-3 py-1 rounded-lg"
                style={{ fontSize: 10, fontWeight: 600, background: "rgba(6,182,212,0.12)", color: "#06B6D4" }}
              >
                刷新诊断
              </button>

              {/* Native 日志展开 */}
              <div>
                <button
                  onClick={() => setShowNativeLogs(!showNativeLogs)}
                  style={{ fontSize: 10, color: "#06B6D4", textDecoration: "underline" }}
                >
                  {showNativeLogs ? "收起" : "展开"} Native 日志 ({diagInfo.recentNativeLogs?.length ?? 0} 条)
                </button>
                {showNativeLogs && diagInfo.recentNativeLogs && diagInfo.recentNativeLogs.length > 0 && (
                  <pre
                    className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded-lg p-2"
                    style={{
                      maxHeight: 240,
                      fontSize: 9,
                      lineHeight: "14px",
                      fontFamily: "monospace",
                      background: "#0A0C12",
                      color: "#10B981",
                    }}
                  >
                    {(Array.isArray(diagInfo.recentNativeLogs) ? diagInfo.recentNativeLogs : []).join("\n")}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
