import { useMemo, useState, useEffect } from "react";
import { X, Copy, Share2, Check, Smartphone, Moon, CheckSquare } from "lucide-react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { WorkSession, getCategoryInfo, getEvalTagInfo, CATEGORIES, useApp } from "../context/AppContext";

const FloatingWindow: any =
  Capacitor.getPlatform() === "android" ? registerPlugin("FloatingWindow") : null;

interface Props {
  open: boolean;
  onClose: () => void;
  sessions: WorkSession[];
  date: Date;
}

interface UsageSession { appName: string; start: number; end: number; }
interface AppStat { appName: string; totalTimeMs: number; }

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"];

function fmtTime(d: Date) {
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function barChars(pct: number, total = 10): string {
  const filled = Math.round((pct / 100) * total);
  return "█".repeat(filled) + "░".repeat(total - filled);
}

function detectSleep(
  sessions: UsageSession[],
  dateStart: number
): Array<{ start: number; end: number }> {
  if (sessions.length === 0) return [];
  const MIN_SLEEP_MS = 4.5 * 3600 * 1000;
  const sorted = [...sessions].sort((a, b) => a.start - b.start);
  const gaps: Array<{ start: number; end: number }> = [];

  // Gap from midnight to first session
  if (sorted[0].start - dateStart >= MIN_SLEEP_MS) {
    gaps.push({ start: dateStart, end: sorted[0].start });
  }
  // Gaps between sessions
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].end;
    const gapEnd = sorted[i + 1].start;
    if (gapEnd - gapStart >= MIN_SLEEP_MS) {
      gaps.push({ start: gapStart, end: gapEnd });
    }
  }
  return gaps;
}

function buildReportText(
  sessions: WorkSession[],
  date: Date,
  appStats: AppStat[],
  sleepPeriods: Array<{ start: number; end: number }>,
  todos: { text: string; completed: boolean }[]
): string {
  const dateStr = date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  const weekDay = WEEK_DAYS[date.getDay()];
  const totalSec = sessions.reduce((s, sess) => s + sess.duration, 0);
  const totalH = Math.floor(totalSec / 3600);
  const totalM = Math.floor((totalSec % 3600) / 60);

  // Category breakdown
  const catMap: Record<string, number> = {};
  sessions.forEach((s) => { catMap[s.category] = (catMap[s.category] || 0) + s.duration; });
  const catRows = CATEGORIES.filter((c) => catMap[c.name])
    .map((c) => ({ name: c.name, sec: catMap[c.name] }))
    .sort((a, b) => b.sec - a.sec);

  const catLines = catRows.map((cat) => {
    const pct = totalSec > 0 ? Math.round((cat.sec / totalSec) * 100) : 0;
    const h = Math.floor(cat.sec / 3600);
    const m = Math.floor((cat.sec % 3600) / 60);
    const timeStr = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
    return `  ${cat.name.padEnd(4)}  ${timeStr.padEnd(7)}  ${String(pct).padStart(2)}%  ${barChars(pct)}`;
  });

  // Session detail
  const sorted = [...sessions].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const sessionLines: string[] = [];
  sorted.forEach((s) => {
    const timeRange = `${fmtTime(s.startTime)}–${fmtTime(s.endTime)}`;
    const dur = fmtDuration(s.duration);
    const outcomeStr = s.outcome === "abandoned" ? " [放弃]" : "";
    sessionLines.push(`  ${timeRange}  【${s.category}】${s.taskName}  ${dur}${outcomeStr}`);
    const extras: string[] = [];
    if (s.evalTag) extras.push(s.evalTag);
    if (s.feeling) extras.push(`感受：${s.feeling}`);
    if (s.tags && s.tags.length > 0) extras.push(s.tags.map((t) => `#${t}`).join(" "));
    if (extras.length > 0) sessionLines.push(`    ↳ ${extras.join("  ·  ")}`);
  });

  // Estimate accuracy
  const withEst = sessions.filter((s) => s.estimatedMinutes && s.estimatedMinutes > 0);
  const overTime = withEst.filter((s) => s.duration > (s.estimatedMinutes! * 60)).length;
  const onTime = withEst.length - overTime;

  const lines = [
    `📅 TimeBox 日报 · ${dateStr}（周${weekDay}）`,
    "",
    `⏱ 今日总工时：${totalH}h ${totalM}m（${sessions.length} 条记录）`,
    "",
    "📊 分类分布：",
    ...catLines,
    "",
    "📝 记录明细：",
    ...sessionLines,
  ];

  if (withEst.length > 0) {
    lines.push("", `✦ 时间预估：超时 ${overTime} 条 / 准时 ${onTime} 条`);
  }

  // Screen usage
  if (appStats.length > 0) {
    const topApps = appStats.slice(0, 8);
    const totalUsageMs = topApps.reduce((s, a) => s + a.totalTimeMs, 0);
    lines.push("", "📱 屏幕使用（应用时长）：");
    topApps.forEach(({ appName, totalTimeMs }) => {
      const pct = totalUsageMs > 0 ? Math.round((totalTimeMs / totalUsageMs) * 100) : 0;
      const t = fmtMs(totalTimeMs);
      lines.push(`  ${appName.slice(0, 10).padEnd(11)} ${t.padEnd(8)} ${barChars(pct, 8)}`);
    });
  }

  // Sleep
  if (sleepPeriods.length > 0) {
    lines.push("", "🌙 推测睡眠（无屏幕时段 > 4.5h）：");
    sleepPeriods.forEach((p) => {
      const s = new Date(p.start);
      const e = new Date(p.end);
      const durMs = p.end - p.start;
      const startStr = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
      const endStr = `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
      lines.push(`  ${startStr}–${endStr}  ${fmtMs(durMs)}`);
    });
  }

  // Todos
  const completedTodos = todos.filter((t) => t.completed);
  const pendingTodos = todos.filter((t) => !t.completed);
  if (todos.length > 0) {
    lines.push("", `✅ 待办完成：${completedTodos.length} / ${todos.length}`);
    completedTodos.forEach((t) => lines.push(`  ✓ ${t.text}`));
    if (pendingTodos.length > 0) {
      lines.push(`  ○ 未完成 ${pendingTodos.length} 条`);
      pendingTodos.slice(0, 5).forEach((t) => lines.push(`    · ${t.text}`));
    }
  }

  lines.push("", "#TimeBox #日报");
  return lines.join("\n");
}

export function DailyReportDialog({ open, onClose, sessions, date }: Props) {
  const { todos } = useApp();
  const [copied, setCopied] = useState(false);
  const [appStats, setAppStats] = useState<AppStat[]>([]);
  const [usageSessions, setUsageSessions] = useState<UsageSession[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Load screen usage data when dialog opens
  useEffect(() => {
    if (!open || !FloatingWindow) return;
    setLoadingUsage(true);
    (async () => {
      try {
        const perm = await FloatingWindow.checkUsagePermission();
        if (!perm.granted) return;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const start = d.getTime();
        const end = start + 24 * 3600 * 1000;
        const now = Date.now();

        const [evRes, statsRes] = await Promise.all([
          FloatingWindow.getUsageEvents({ startTime: start, endTime: Math.min(end, now) }),
          FloatingWindow.getUsageStats({ startTime: start, endTime: Math.min(end, now) }),
        ]);
        setUsageSessions(evRes.sessions || []);
        const stats: AppStat[] = (statsRes.stats || [])
          .sort((a: AppStat, b: AppStat) => b.totalTimeMs - a.totalTimeMs)
          .slice(0, 10);
        setAppStats(stats);
      } catch (e) {
        console.warn("DailyReport: usage fetch failed", e);
      } finally {
        setLoadingUsage(false);
      }
    })();
  }, [open, date]);

  const dateStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [date]);

  const sleepPeriods = useMemo(
    () => detectSleep(usageSessions, dateStart),
    [usageSessions, dateStart]
  );

  const reportText = useMemo(
    () => buildReportText(sessions, date, appStats, sleepPeriods, todos),
    [sessions, date, appStats, sleepPeriods, todos]
  );

  if (!open) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = reportText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title: "TimeBox 日报", text: reportText, dialogTitle: "分享日报" });
      } catch { /* cancelled */ }
    } else {
      await handleCopy();
    }
  }

  const totalSec = sessions.reduce((s, sess) => s + sess.duration, 0);
  const catMap: Record<string, number> = {};
  sessions.forEach((s) => { catMap[s.category] = (catMap[s.category] || 0) + s.duration; });
  const catRows = CATEGORIES.filter((c) => catMap[c.name])
    .map((c) => ({ name: c.name, sec: catMap[c.name], color: getCategoryInfo(c.name).color, bg: getCategoryInfo(c.name).bg }))
    .sort((a, b) => b.sec - a.sec);

  const dateStr = date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  const weekDay = WEEK_DAYS[date.getDay()];
  const completedCount = todos.filter((t) => t.completed).length;
  const totalScreenMs = appStats.reduce((s, a) => s + a.totalTimeMs, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="rounded-t-2xl flex flex-col"
        style={{ background: "#0D0E14", maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #1A1D29" }}
        >
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0" }}>📅 日报预览</p>
            <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 1 }}>
              {dateStr}（周{weekDay}）· {sessions.length} 条记录
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, background: "#1A1D29", color: "#8B8FA8" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* Summary cards */}
        <div className="flex gap-2 px-5 pt-4 pb-3 flex-shrink-0 overflow-x-auto">
          <div className="flex-1 rounded-xl p-3 flex-shrink-0" style={{ background: "#161820", border: "1px solid #252836", minWidth: 90 }}>
            <p style={{ fontSize: 10, color: "#8B8FA8" }}>总工时</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#E8EAF0", fontFamily: "monospace" }}>
              {Math.floor(totalSec / 3600)}h {Math.floor((totalSec % 3600) / 60)}m
            </p>
          </div>
          {catRows.slice(0, 1).map((cat) => (
            <div key={cat.name} className="flex-1 rounded-xl p-3 flex-shrink-0" style={{ background: "#161820", border: "1px solid #252836", minWidth: 90 }}>
              <p style={{ fontSize: 10, color: "#8B8FA8" }}>{cat.name}</p>
              <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: cat.color }}>
                {Math.floor(cat.sec / 3600)}h{Math.floor((cat.sec % 3600) / 60) > 0 ? ` ${Math.floor((cat.sec % 3600) / 60)}m` : ""}
              </p>
            </div>
          ))}
          {totalScreenMs > 0 && (
            <div className="flex-1 rounded-xl p-3 flex-shrink-0" style={{ background: "#161820", border: "1px solid #252836", minWidth: 90 }}>
              <div className="flex items-center gap-1">
                <Smartphone size={9} style={{ color: "#06B6D4" }} />
                <p style={{ fontSize: 10, color: "#8B8FA8" }}>屏幕</p>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#06B6D4" }}>
                {fmtMs(totalScreenMs)}
              </p>
            </div>
          )}
          {sleepPeriods.length > 0 && (
            <div className="flex-1 rounded-xl p-3 flex-shrink-0" style={{ background: "#161820", border: "1px solid #252836", minWidth: 90 }}>
              <div className="flex items-center gap-1">
                <Moon size={9} style={{ color: "#A855F7" }} />
                <p style={{ fontSize: 10, color: "#8B8FA8" }}>睡眠</p>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#A855F7" }}>
                {fmtMs(sleepPeriods.reduce((s, p) => s + (p.end - p.start), 0))}
              </p>
            </div>
          )}
          {todos.length > 0 && (
            <div className="flex-1 rounded-xl p-3 flex-shrink-0" style={{ background: "#161820", border: "1px solid #252836", minWidth: 90 }}>
              <div className="flex items-center gap-1">
                <CheckSquare size={9} style={{ color: "#10B981" }} />
                <p style={{ fontSize: 10, color: "#8B8FA8" }}>待办</p>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, fontFamily: "monospace", color: "#10B981" }}>
                {completedCount}/{todos.length}
              </p>
            </div>
          )}
        </div>

        {/* Category bar */}
        {totalSec > 0 && catRows.length > 0 && (
          <div className="px-5 pb-3">
            <div className="flex rounded-full overflow-hidden" style={{ height: 6 }}>
              {catRows.map((cat) => (
                <div key={cat.name} style={{ width: `${(cat.sec / totalSec) * 100}%`, background: cat.color }} />
              ))}
            </div>
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {catRows.map((cat) => (
                <div key={cat.name} className="flex items-center gap-1">
                  <span className="rounded-sm" style={{ width: 7, height: 7, background: cat.color, display: "inline-block" }} />
                  <span style={{ fontSize: 10, color: "#8B8FA8" }}>
                    {cat.name} {Math.round((cat.sec / totalSec) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Screen usage section */}
        {appStats.length > 0 && (
          <div className="px-5 pb-3">
            <div
              className="rounded-xl p-3"
              style={{ background: "#161820", border: "1px solid #252836" }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Smartphone size={12} style={{ color: "#06B6D4" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#C4C8E0" }}>应用使用时长</span>
                {loadingUsage && <span style={{ fontSize: 10, color: "#525675" }}>加载中...</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                {appStats.slice(0, 6).map((app) => {
                  const pct = totalScreenMs > 0 ? (app.totalTimeMs / totalScreenMs) * 100 : 0;
                  return (
                    <div key={app.appName}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="truncate" style={{ fontSize: 11, color: "#C4C8E0", maxWidth: 120 }}>{app.appName}</span>
                        <span style={{ fontSize: 11, color: "#06B6D4", fontFamily: "monospace", fontWeight: 600 }}>
                          {fmtMs(app.totalTimeMs)}
                        </span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: 3, background: "#252836" }}>
                        <div
                          className="rounded-full"
                          style={{ height: "100%", width: `${pct}%`, background: "#06B6D4", opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Sleep & todos row */}
        {(sleepPeriods.length > 0 || todos.length > 0) && (
          <div className="px-5 pb-3 flex gap-2">
            {/* Sleep */}
            {sleepPeriods.length > 0 && (
              <div
                className="flex-1 rounded-xl p-3"
                style={{ background: "#161820", border: "1px solid #252836" }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Moon size={12} style={{ color: "#A855F7" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#C4C8E0" }}>推测睡眠</span>
                </div>
                {sleepPeriods.map((p, i) => {
                  const s = new Date(p.start);
                  const e = new Date(p.end);
                  const startStr = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
                  const endStr = `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: "#8B8FA8" }}>{startStr}–{endStr}</span>
                      <span style={{ fontSize: 11, color: "#A855F7", fontFamily: "monospace", fontWeight: 600 }}>
                        {fmtMs(p.end - p.start)}
                      </span>
                    </div>
                  );
                })}
                <p style={{ fontSize: 10, color: "#525675", marginTop: 4 }}>依据：无屏幕时段 &gt; 4.5h</p>
              </div>
            )}
            {/* Todos */}
            {todos.length > 0 && (
              <div
                className="flex-1 rounded-xl p-3"
                style={{ background: "#161820", border: "1px solid #252836" }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckSquare size={12} style={{ color: "#10B981" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#C4C8E0" }}>待办</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ background: "rgba(16,185,129,0.12)", color: "#10B981" }}
                  >
                    {completedCount}/{todos.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {todos.slice(0, 6).map((t) => (
                    <div key={t.text} className="flex items-center gap-1.5">
                      <span style={{ fontSize: 10, color: t.completed ? "#10B981" : "#525675" }}>
                        {t.completed ? "✓" : "○"}
                      </span>
                      <span
                        className="truncate"
                        style={{
                          fontSize: 11,
                          color: t.completed ? "#525675" : "#C4C8E0",
                          textDecoration: t.completed ? "line-through" : "none",
                        }}
                      >
                        {t.text}
                      </span>
                    </div>
                  ))}
                  {todos.length > 6 && (
                    <p style={{ fontSize: 10, color: "#525675" }}>还有 {todos.length - 6} 条...</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Raw text preview */}
        <div className="px-5 pb-2">
          <p style={{ fontSize: 10, color: "#525675", marginBottom: 6, fontWeight: 600, letterSpacing: "0.1em" }}>
            文本预览
          </p>
          <pre
            className="rounded-xl p-4 text-[11px] leading-5 whitespace-pre-wrap break-words"
            style={{ background: "#161820", border: "1px solid #252836", color: "#C4C8E0", fontFamily: "monospace" }}
          >
            {reportText}
          </pre>
        </div>

        </div>{/* end scrollable body */}

        {/* Action buttons */}
        <div
          className="px-5 py-4 flex gap-3 flex-shrink-0"
          style={{ borderTop: "1px solid #1A1D29", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95"
            style={{
              background: copied ? "rgba(16,185,129,0.15)" : "#1A1D29",
              border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "#252836"}`,
              color: copied ? "#10B981" : "#C4C8E0",
              fontSize: 14, fontWeight: 600,
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "已复制" : "复制文本"}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #4F7FFF, #A855F7)", color: "#fff", fontSize: 14, fontWeight: 600 }}
          >
            <Share2 size={16} />
            分享日报
          </button>
        </div>
      </div>
    </div>
  );
}
