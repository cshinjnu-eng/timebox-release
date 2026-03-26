import { useMemo, useState } from "react";
import { GitBranch, ChevronLeft, ChevronRight, Clock, Layers } from "lucide-react";
import { useApp, formatDuration, getCategoryInfo, CATEGORIES } from "../context/AppContext";

function formatHour(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 8;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;

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
  top,
  height,
  color,
  bg,
  label,
  category,
  time,
  duration,
  notes,
  overlap = 1,
  overlapIndex = 0,
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
        top,
        height: Math.max(height, 28),
        width,
        left,
        background: bg,
        border: `1.5px solid ${hovered ? color : color + "55"}`,
        boxShadow: hovered ? `0 0 12px ${color}33` : "none",
        zIndex: hovered ? 10 : 1,
        cursor: "default",
        padding: "4px 8px",
        overflow: "hidden",
      }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
        style={{ background: color }}
      />
      <div className="pl-2">
        {height >= 40 ? (
          <>
            <p
              className="truncate"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color,
                lineHeight: 1.3,
              }}
            >
              {label}
            </p>
            {height >= 56 && (
              <p style={{ fontSize: 10, color: "#8B8FA8", lineHeight: 1.2 }}>{time}</p>
            )}
          </>
        ) : (
          <p
            className="truncate"
            style={{ fontSize: 10, fontWeight: 600, color, lineHeight: "20px" }}
          >
            {label}
          </p>
        )}
      </div>
      {/* Tooltip on hover */}
      {hovered && (
        <div
          className="absolute z-20 rounded-xl p-3 pointer-events-none"
          style={{
            bottom: "calc(100% + 6px)",
            left: 0,
            minWidth: 200,
            background: "#1A1D29",
            border: `1px solid ${color}55`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="px-1.5 py-0.5 rounded text-xs"
              style={{ background: bg, color }}
            >
              {category}
            </span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 4 }}>
            {label}
          </p>
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

export function Timeline() {
  const { sessions } = useApp();
  const [dayOffset, setDayOffset] = useState(0); // 0 = today, -1 = yesterday
  const [selectedCategory, setSelectedCategory] = useState("全部");

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

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const sameDay = s.startTime.toDateString() === targetDate.toDateString();
      const catMatch = selectedCategory === "全部" || s.category === selectedCategory;
      return sameDay && catMatch;
    });
  }, [sessions, targetDate, selectedCategory]);

  // Compute overlap groups
  type BlockData = {
    session: typeof sessions[0];
    top: number;
    height: number;
    overlapIndex: number;
    overlap: number;
  };

  const blocks: BlockData[] = useMemo(() => {
    const sorted = [...filteredSessions].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );

    const results: BlockData[] = sorted.map((s) => {
      const startFrac =
        s.startTime.getHours() +
        s.startTime.getMinutes() / 60 -
        START_HOUR;
      const endFrac =
        s.endTime.getHours() + s.endTime.getMinutes() / 60 - START_HOUR;
      const top = Math.max(0, startFrac) * HOUR_HEIGHT;
      const height = Math.max(0, endFrac - Math.max(0, startFrac)) * HOUR_HEIGHT;
      return { session: s, top, height, overlapIndex: 0, overlap: 1 };
    });

    // ─── Sweep-line column assignment ────────────────────────────
    // For each block, assign it to the first available column.
    // Track the end position of each column to know when it's free.
    const columnEnds: number[] = []; // columnEnds[col] = bottom-y of the last block in that column

    for (let i = 0; i < results.length; i++) {
      const block = results[i];
      const blockTop = block.top;
      const blockBottom = block.top + block.height;

      // Find the first column where this block fits (no overlap)
      let assignedCol = -1;
      for (let col = 0; col < columnEnds.length; col++) {
        if (columnEnds[col] <= blockTop + 0.5) { // 0.5px tolerance
          assignedCol = col;
          break;
        }
      }

      if (assignedCol === -1) {
        // Need a new column
        assignedCol = columnEnds.length;
        columnEnds.push(blockBottom);
      } else {
        columnEnds[assignedCol] = blockBottom;
      }

      block.overlapIndex = assignedCol;
    }

    // ─── Compute max concurrent columns per overlap group ────────
    // For each block, determine how many columns are active at its position
    for (let i = 0; i < results.length; i++) {
      let maxCols = results[i].overlapIndex + 1;
      for (let j = 0; j < results.length; j++) {
        if (i === j) continue;
        const a = results[i];
        const b = results[j];
        // Check if blocks overlap vertically
        if (b.top < a.top + a.height && b.top + b.height > a.top) {
          maxCols = Math.max(maxCols, b.overlapIndex + 1);
        }
      }
      results[i].overlap = maxCols;
    }

    return results;
  }, [filteredSessions]);

  const totalTime = filteredSessions.reduce((s, sess) => s + sess.duration, 0);
  const totalHours = Math.floor(totalTime / 3600);
  const totalMin = Math.floor((totalTime % 3600) / 60);

  // Current time line
  const now = new Date();
  const isToday = dayOffset === 0;
  const nowFrac = now.getHours() + now.getMinutes() / 60 - START_HOUR;
  const nowLineTop = nowFrac * HOUR_HEIGHT;
  const showNowLine = isToday && nowFrac >= 0 && nowFrac <= TOTAL_HOURS;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="flex items-center gap-2"
            style={{ fontSize: 20, fontWeight: 700, color: "#E8EAF0" }}
          >
            <GitBranch size={20} style={{ color: "#A855F7" }} />
            时间轴
          </h1>
          <p style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
            Timeline · 可视化工作时间分布
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Day nav */}
          <div
            className="flex items-center gap-1 rounded-lg p-1"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <button
              onClick={() => setDayOffset((d) => d - 1)}
              className="flex items-center justify-center rounded-md transition-colors"
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
              className="flex items-center justify-center rounded-md transition-colors"
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

      <div className="flex gap-6">
        {/* Timeline grid */}
        <div className="flex-1 min-w-0">
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
                <span style={{ fontSize: 12, color: "#8B8FA8" }}>总计</span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: "#4F7FFF",
                  }}
                >
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
            </div>

            {/* Grid */}
            <div className="flex" style={{ paddingBottom: 16 }}>
              {/* Hour labels */}
              <div
                className="flex flex-col flex-shrink-0 select-none"
                style={{ width: 52, paddingTop: 8 }}
              >
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

              {/* Grid lines + blocks */}
              <div
                className="flex-1 relative"
                style={{
                  height: TOTAL_HOURS * HOUR_HEIGHT + 8,
                  marginTop: 8,
                  marginRight: 16,
                }}
              >
                {/* Hour grid lines */}
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0"
                    style={{
                      top: i * HOUR_HEIGHT,
                      height: 1,
                      background: "#1E2130",
                    }}
                  />
                ))}

                {/* Half-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`h${i}`}
                    className="absolute left-0 right-0"
                    style={{
                      top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                      height: 1,
                      background: "#181B28",
                    }}
                  />
                ))}

                {/* Now line */}
                {showNowLine && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: nowLineTop }}
                  >
                    <div
                      className="flex items-center"
                      style={{ transform: "translateY(-50%)" }}
                    >
                      <div
                        className="rounded-full flex-shrink-0"
                        style={{ width: 8, height: 8, background: "#EF4444" }}
                      />
                      <div
                        className="flex-1"
                        style={{ height: 1.5, background: "#EF444466" }}
                      />
                    </div>
                  </div>
                )}

                {/* Session blocks */}
                {blocks.map(({ session, top, height, overlap, overlapIndex }) => {
                  const cat = getCategoryInfo(session.category);
                  const startStr = session.startTime.toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const endStr = session.endTime.toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <TimelineBlock
                      key={session.id}
                      top={top}
                      height={height}
                      color={cat.color}
                      bg={cat.bg}
                      label={session.taskName}
                      category={session.category}
                      time={`${startStr} – ${endStr}`}
                      duration={formatDuration(session.duration)}
                      notes={session.feeling}
                      overlap={overlap}
                      overlapIndex={overlapIndex}
                    />
                  );
                })}

                {/* Empty state */}
                {filteredSessions.length === 0 && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ color: "#8B8FA8" }}
                  >
                    <GitBranch size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                    <p style={{ fontSize: 13 }}>该时段暂无工作记录</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Legend / summary */}
        <div className="flex flex-col gap-4" style={{ width: 200, flexShrink: 0 }}>
          <div
            className="rounded-xl p-4"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 12 }}>
              分类汇总
            </h3>
            <div className="flex flex-col gap-3">
              {CATEGORIES.map((cat) => {
                const catSessions = filteredSessions.filter(
                  (s) => s.category === cat.name
                );
                if (catSessions.length === 0) return null;
                const total = catSessions.reduce((s, sess) => s + sess.duration, 0);
                const pct =
                  totalTime > 0 ? Math.round((total / totalTime) * 100) : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="rounded-sm"
                          style={{
                            width: 8,
                            height: 8,
                            background: cat.color,
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontSize: 12, color: "#C4C8E0" }}>{cat.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#8B8FA8" }}>{pct}%</span>
                    </div>
                    <div
                      className="rounded-full overflow-hidden"
                      style={{ height: 3, background: "#252836" }}
                    >
                      <div
                        className="rounded-full"
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: cat.color,
                          transition: "width 0.5s ease",
                        }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: 11,
                        color: cat.color,
                        fontFamily: "monospace",
                        marginTop: 2,
                      }}
                    >
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

          {/* Session list */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 10 }}>
              记录列表
            </h3>
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
                      <div
                        key={s.id}
                        className="flex items-start gap-2"
                      >
                        <div
                          className="rounded-sm flex-shrink-0 mt-0.5"
                          style={{
                            width: 8,
                            height: 8,
                            background: cat.color,
                            marginTop: 5,
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontSize: 12, color: "#C4C8E0" }}>
                            {s.taskName}
                          </p>
                          <p style={{ fontSize: 10, color: "#525675" }}>
                            {formatDuration(s.duration)}
                          </p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
