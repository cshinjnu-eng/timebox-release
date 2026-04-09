import { useMemo, useState, useEffect } from "react";
import { GitBranch, ChevronLeft, ChevronRight, Clock, Layers, Smartphone } from "lucide-react";
import { useApp, formatDuration, getCategoryInfo, CATEGORIES } from "../context/AppContext";
import { ScreenUsageTimeline } from "./ScreenUsageTimeline";
import { Capacitor, registerPlugin } from "@capacitor/core";

const FloatingWindow: any =
  Capacitor.getPlatform() === "android" ? registerPlugin("FloatingWindow") : null;

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

const HOUR_HEIGHT = 48;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;

// ─── App color helper (shared palette — same as ScreenUsageTimeline) ──
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

function getScreenAppColor(name: string): string {
  for (const key of Object.keys(APP_COLOR_KNOWN)) {
    if (name.includes(key)) return APP_COLOR_KNOWN[key];
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return APP_COLOR_PALETTE[Math.abs(hash) % APP_COLOR_PALETTE.length];
}

interface BlockProps {
  top: number;
  height: number;
  color: string;
  bg: string;
  label: string;
  category: string;
  time: string;
  duration: string;
  notes?: string;
  overlap?: number;
  overlapIndex?: number;
}

function TimelineBlock({
  top, height, color, bg, label, category, time, duration, notes,
  overlap = 1, overlapIndex = 0,
}: BlockProps) {
  const [hovered, setHovered] = useState(false);
  const width = `calc((100% - ${(overlap - 1) * 4}px) / ${overlap})`;
  const left = `calc(((100% - ${(overlap - 1) * 4}px) / ${overlap}) * ${overlapIndex} + ${overlapIndex * 4}px)`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute rounded-lg overflow-hidden transition-all duration-150"
      style={{
        top, height: Math.max(height, 28), width, left,
        background: bg,
        border: `1.5px solid ${hovered ? color : color + "55"}`,
        boxShadow: hovered ? `0 0 12px ${color}33` : "none",
        zIndex: hovered ? 10 : 1,
        cursor: "default",
        padding: "4px 8px",
        overflow: "hidden",
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l" style={{ background: color }} />
      <div className="pl-2">
        {height >= 40 ? (
          <>
            <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color, lineHeight: 1.3 }}>
              {label}
            </p>
            {height >= 56 && (
              <p style={{ fontSize: 10, color: "#8B8FA8", lineHeight: 1.2 }}>{time}</p>
            )}
          </>
        ) : (
          <p className="truncate" style={{ fontSize: 10, fontWeight: 600, color, lineHeight: "20px" }}>
            {label}
          </p>
        )}
      </div>
      {hovered && (
        <div
          className="absolute z-20 rounded-xl p-3 pointer-events-none"
          style={{
            bottom: "calc(100% + 6px)", left: 0, minWidth: 200,
            background: "#1A1D29", border: `1px solid ${color}55`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: bg, color }}>
              {category}
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 4 }}>{label}</p>
          <p style={{ fontSize: 11, color: "#8B8FA8" }}>{time}</p>
          <p style={{ fontSize: 11, color, fontFamily: "monospace", marginTop: 2 }}>{duration}</p>
          {notes && (
            <p style={{ fontSize: 11, color: "#8B8FA8", marginTop: 4, fontStyle: "italic" }}>
              {notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Screen usage session block (for the right column) ───────────────
function ScreenBlock({
  top, height, color, appName, duration,
}: {
  top: number; height: number; color: string; appName: string; duration: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute w-full rounded-sm"
      style={{
        top,
        height: Math.max(height, 3),
        background: color,
        opacity: hovered ? 0.95 : 0.65,
        zIndex: hovered ? 10 : 1,
        cursor: "default",
        transition: "opacity 0.15s",
      }}
    >
      {hovered && (
        <div
          className="absolute z-20 rounded-lg p-2 pointer-events-none whitespace-nowrap"
          style={{
            bottom: "calc(100% + 4px)",
            right: 0,
            background: "#1A1D29",
            border: `1px solid ${color}66`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: "#E8EAF0" }}>{appName}</p>
          <p style={{ fontSize: 10, color, fontFamily: "monospace" }}>{duration}</p>
        </div>
      )}
    </div>
  );
}

interface UsageSession {
  appName: string;
  start: number;
  end: number;
}

function formatMs(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 > 0 ? `${m % 60}m` : ""}`;
}

export function Timeline() {
  const { sessions } = useApp();
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [usageSessions, setUsageSessions] = useState<UsageSession[]>([]);
  const [hasUsagePerm, setHasUsagePerm] = useState(false);

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dayOffset]);

  const dayLabel = useMemo(() => {
    if (dayOffset === 0) return "今天";
    if (dayOffset === -1) return "昨天";
    return targetDate.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  }, [dayOffset, targetDate]);

  const dayStart = targetDate.getTime();

  // ─── Load screen usage events ──────────────────────────────────────
  useEffect(() => {
    if (!FloatingWindow) return;
    (async () => {
      try {
        const perm = await FloatingWindow.checkUsagePermission();
        setHasUsagePerm(perm.granted);
        if (!perm.granted) return;
        const start = targetDate.getTime();
        const end = start + 24 * 60 * 60 * 1000;
        const res = await FloatingWindow.getUsageEvents({
          startTime: start,
          endTime: Math.min(end, Date.now()),
        });
        setUsageSessions(res.sessions || []);
      } catch (e) {
        console.warn("Timeline: usage events failed", e);
      }
    })();
  }, [targetDate]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const sameDay = s.startTime.toDateString() === targetDate.toDateString();
      const catMatch = selectedCategory === "全部" || s.category === selectedCategory;
      return sameDay && catMatch;
    });
  }, [sessions, targetDate, selectedCategory]);

  type BlockData = {
    session: typeof sessions[0];
    top: number; height: number; overlapIndex: number; overlap: number;
  };

  const blocks: BlockData[] = useMemo(() => {
    const sorted = [...filteredSessions].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    const results: BlockData[] = sorted.map((s) => {
      const startFrac = s.startTime.getHours() + s.startTime.getMinutes() / 60 - START_HOUR;
      const endFrac = s.endTime.getHours() + s.endTime.getMinutes() / 60 - START_HOUR;
      const top = Math.max(0, startFrac) * HOUR_HEIGHT;
      const height = Math.max(0, endFrac - Math.max(0, startFrac)) * HOUR_HEIGHT;
      return { session: s, top, height, overlapIndex: 0, overlap: 1 };
    });

    const columnEnds: number[] = [];
    for (let i = 0; i < results.length; i++) {
      const block = results[i];
      let assignedCol = -1;
      for (let col = 0; col < columnEnds.length; col++) {
        if (columnEnds[col] < block.top) {
          assignedCol = col;
          break;
        }
      }
      if (assignedCol === -1) {
        assignedCol = columnEnds.length;
        columnEnds.push(block.top + block.height);
      } else {
        columnEnds[assignedCol] = block.top + block.height;
      }
      block.overlapIndex = assignedCol;
    }

    for (let i = 0; i < results.length; i++) {
      let maxCols = results[i].overlapIndex + 1;
      for (let j = 0; j < results.length; j++) {
        if (i === j) continue;
        const a = results[i];
        const b = results[j];
        if (b.top < a.top + a.height + 1 && b.top + b.height + 1 > a.top) {
          maxCols = Math.max(maxCols, b.overlapIndex + 1);
        }
      }
      results[i].overlap = maxCols;
    }

    return results;
  }, [filteredSessions]);

  // ─── Screen usage blocks for the right column ─────────────────────
  const screenBlocks = useMemo(() => {
    return usageSessions.map((s) => {
      const startFrac = (s.start - dayStart) / (1000 * 60 * 60) - START_HOUR;
      const endFrac = (s.end - dayStart) / (1000 * 60 * 60) - START_HOUR;
      const top = Math.max(0, startFrac) * HOUR_HEIGHT;
      const height = Math.max(0, endFrac - Math.max(0, startFrac)) * HOUR_HEIGHT;
      const color = getScreenAppColor(s.appName);
      const durationMs = s.end - s.start;
      return { top, height, color, appName: s.appName, duration: formatMs(durationMs), durationMs };
    }).filter((b) => b.height >= 1 && b.top >= 0 && b.top <= TOTAL_HOURS * HOUR_HEIGHT);
  }, [usageSessions, dayStart]);

  const totalTime = filteredSessions
    .filter((s) => s.category === "工作" || s.category === "学习")
    .reduce((s, sess) => s + sess.duration, 0);
  const totalHours = Math.floor(totalTime / 3600);
  const totalMin = Math.floor((totalTime % 3600) / 60);

  const now = new Date();
  const isToday = dayOffset === 0;
  const nowFrac = now.getHours() + now.getMinutes() / 60 - START_HOUR;
  const nowLineTop = nowFrac * HOUR_HEIGHT;
  const showNowLine = isToday && nowFrac >= 0 && nowFrac <= TOTAL_HOURS;

  const SCREEN_COL_WIDTH = 52; // px

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="flex items-center gap-2" style={{ fontSize: 20, fontWeight: 700, color: "#E8EAF0" }}>
            <GitBranch size={20} style={{ color: "#A855F7" }} />
            时间轴
          </h1>
          <p style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
            Timeline · 可视化工作时间分布
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1 rounded-lg p-1"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <button
              onClick={() => setDayOffset((d) => d - 1)}
              className="flex items-center justify-center rounded-md"
              style={{ width: 28, height: 28, color: "#8B8FA8" }}
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="px-3"
              style={{ fontSize: 13, color: "#E8EAF0", fontWeight: 600, minWidth: 48, textAlign: "center" }}
            >
              {dayLabel}
            </span>
            <button
              onClick={() => setDayOffset((d) => Math.min(d + 1, 0))}
              className="flex items-center justify-center rounded-md"
              style={{ width: 28, height: 28, color: dayOffset >= 0 ? "#252836" : "#8B8FA8" }}
              disabled={dayOffset >= 0}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Category filter */}
      <div
        className="flex gap-1 p-1 rounded-lg mb-5 flex-wrap"
        style={{ background: "#161820", border: "1px solid #252836", width: "fit-content" }}
      >
        {["全部", ...CATEGORIES.map((c) => c.name)].map((cat) => {
          const info = cat !== "全部" ? getCategoryInfo(cat) : null;
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="px-3 py-1 rounded-md text-xs transition-all"
              style={{
                background: isActive ? "#252836" : "transparent",
                color: isActive ? (info ? info.color : "#E8EAF0") : "#8B8FA8",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        {/* Main Timeline card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "#161820", border: "1px solid #252836" }}
        >
          {/* Stats bar */}
          <div
            className="flex items-center gap-6 px-5 py-3"
            style={{ borderBottom: "1px solid #252836" }}
          >
            <div className="flex items-center gap-2">
              <Clock size={13} style={{ color: "#4F7FFF" }} />
              <span style={{ fontSize: 12, color: "#8B8FA8" }}>学习/工作</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#4F7FFF" }}>
                {totalHours}h {totalMin}m
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Layers size={13} style={{ color: "#A855F7" }} />
              <span style={{ fontSize: 12, color: "#8B8FA8" }}>记录数</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#A855F7" }}>
                {filteredSessions.length}
              </span>
            </div>
            {hasUsagePerm && screenBlocks.length > 0 && (
              <div className="flex items-center gap-2">
                <Smartphone size={13} style={{ color: "#06B6D4" }} />
                <span style={{ fontSize: 12, color: "#8B8FA8" }}>屏幕会话</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#06B6D4" }}>
                  {screenBlocks.length}
                </span>
              </div>
            )}
          </div>

          {/* Column headers */}
          <div
            className="flex"
            style={{ paddingLeft: 52, paddingRight: hasUsagePerm ? SCREEN_COL_WIDTH + 8 + 16 : 16, paddingTop: 6, paddingBottom: 0 }}
          >
            <div className="flex-1" style={{ fontSize: 11, color: "#525675", fontWeight: 600 }}>
              任务记录
            </div>
            {hasUsagePerm && (
              <div
                style={{
                  width: SCREEN_COL_WIDTH,
                  fontSize: 10,
                  color: "#06B6D4",
                  fontWeight: 600,
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                <Smartphone size={10} />
                屏幕
              </div>
            )}
          </div>

          {/* Grid */}
          <div className="flex" style={{ paddingBottom: 16 }}>
            {/* Hour labels */}
            <div className="flex flex-col flex-shrink-0 select-none" style={{ width: 52, paddingTop: 8 }}>
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i + START_HOUR).map((h) => (
                <div
                  key={h}
                  style={{
                    height: HOUR_HEIGHT,
                    display: "flex",
                    alignItems: "flex-start",
                    paddingTop: 4,
                    paddingRight: 10,
                    justifyContent: "flex-end",
                  }}
                >
                  <span style={{ fontSize: 10, color: "#525675" }}>{formatHour(h)}</span>
                </div>
              ))}
            </div>

            {/* Task blocks area */}
            <div
              className="flex-1 relative"
              style={{ height: TOTAL_HOURS * HOUR_HEIGHT + 8, marginTop: 8, marginRight: 8 }}
            >
              {/* Hour grid lines */}
              {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0"
                  style={{ top: i * HOUR_HEIGHT, height: 1, background: "#1E2130" }}
                />
              ))}
              {/* Half-hour lines */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={`h${i}`}
                  className="absolute left-0 right-0"
                  style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2, height: 1, background: "#181B28" }}
                />
              ))}

              {/* Now line */}
              {showNowLine && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: nowLineTop }}
                >
                  <div className="flex items-center" style={{ transform: "translateY(-50%)" }}>
                    <div className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: "#EF4444" }} />
                    <div className="flex-1" style={{ height: 1.5, background: "#EF444466" }} />
                  </div>
                </div>
              )}

              {/* Session blocks */}
              {blocks.map(({ session, top, height, overlap, overlapIndex }) => {
                const cat = getCategoryInfo(session.category);
                const startStr = session.startTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
                const endStr = session.endTime.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
                return (
                  <TimelineBlock
                    key={session.id}
                    top={top} height={height}
                    color={cat.color} bg={cat.bg}
                    label={session.taskName}
                    category={session.category}
                    time={`${startStr} – ${endStr}`}
                    duration={formatDuration(session.duration)}
                    notes={session.feeling}
                    overlap={overlap} overlapIndex={overlapIndex}
                  />
                );
              })}

              {filteredSessions.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color: "#8B8FA8" }}>
                  <GitBranch size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                  <p style={{ fontSize: 13 }}>该时段暂无工作记录</p>
                </div>
              )}
            </div>

            {/* ── Screen usage column ─────────────────────────── */}
            {hasUsagePerm && (
              <div
                className="relative flex-shrink-0"
                style={{
                  width: SCREEN_COL_WIDTH,
                  height: TOTAL_HOURS * HOUR_HEIGHT + 8,
                  marginTop: 8,
                  marginRight: 16,
                }}
              >
                {/* Same grid lines */}
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0"
                    style={{ top: i * HOUR_HEIGHT, height: 1, background: "#1E2130" }}
                  />
                ))}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`h${i}`}
                    className="absolute left-0 right-0"
                    style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2, height: 1, background: "#181B28" }}
                  />
                ))}

                {/* Vertical separator */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: -5, width: 1, background: "#252836" }}
                />

                {/* Now line continuation */}
                {showNowLine && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: nowLineTop, height: 1.5, background: "#EF444444" }}
                  />
                )}

                {/* Screen usage blocks */}
                {screenBlocks.length === 0 ? (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ opacity: 0.3 }}
                  >
                    <Smartphone size={16} style={{ color: "#525675" }} />
                  </div>
                ) : (
                  screenBlocks.map((b, i) => (
                    <ScreenBlock
                      key={i}
                      top={b.top}
                      height={b.height}
                      color={b.color}
                      appName={b.appName}
                      duration={b.duration}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: 分类汇总 + 记录列表 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ background: "#161820", border: "1px solid #252836" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 12 }}>分类汇总</h3>
            <div className="flex flex-col gap-3">
              {CATEGORIES.map((cat) => {
                const catSessions = filteredSessions.filter((s) => s.category === cat.name);
                if (catSessions.length === 0) return null;
                const total = catSessions.reduce((s, sess) => s + sess.duration, 0);
                const pct = totalTime > 0 ? Math.round((total / totalTime) * 100) : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="rounded-sm"
                          style={{ width: 8, height: 8, background: cat.color, display: "inline-block" }}
                        />
                        <span style={{ fontSize: 12, color: "#C4C8E0" }}>{cat.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#8B8FA8" }}>{pct}%</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 3, background: "#252836" }}>
                      <div
                        className="rounded-full"
                        style={{ height: "100%", width: `${pct}%`, background: cat.color, transition: "width 0.5s ease" }}
                      />
                    </div>
                    <p style={{ fontSize: 11, color: cat.color, fontFamily: "monospace", marginTop: 2 }}>
                      {formatDuration(total)}
                    </p>
                  </div>
                );
              })}
              {filteredSessions.length === 0 && (
                <p style={{ fontSize: 12, color: "#525675" }}>暂无数据</p>
              )}
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: "#161820", border: "1px solid #252836" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 10 }}>记录列表</h3>
            <div className="flex flex-col gap-2">
              {filteredSessions.length === 0 ? (
                <p style={{ fontSize: 12, color: "#525675" }}>暂无记录</p>
              ) : (
                filteredSessions
                  .slice()
                  .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                  .map((s) => {
                    const cat = getCategoryInfo(s.category);
                    return (
                      <div key={s.id} className="flex items-start gap-2">
                        <div
                          className="rounded-sm flex-shrink-0"
                          style={{ width: 8, height: 8, background: cat.color, marginTop: 5 }}
                        />
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontSize: 12, color: "#C4C8E0" }}>{s.taskName}</p>
                          <p style={{ fontSize: 10, color: "#525675" }}>{formatDuration(s.duration)}</p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Screen Usage Stats (stats list + permission) */}
        <ScreenUsageTimeline selectedDate={targetDate} />
      </div>
    </div>
  );
}
