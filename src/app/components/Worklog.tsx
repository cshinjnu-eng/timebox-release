import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  FileText,
  Clock,
  TrendingUp,
  Calendar,
  ChevronDown,
  Search,
  Download,
  Target,
} from "lucide-react";
import { useApp, formatDuration, getCategoryInfo, getEvalTagInfo, CATEGORIES, WorkSession } from "../context/AppContext";

function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "今天";
  if (date.toDateString() === yesterday.toDateString()) return "昨天";
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: any;
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-start gap-3"
      style={{ background: "#161820", border: "1px solid #252836" }}
    >
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 36, height: 36, background: `${color}1A` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p style={{ fontSize: 12, color: "#8B8FA8" }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#E8EAF0", fontFamily: "monospace" }}>{value}</p>
        {sub && <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-lg px-3 py-2"
        style={{ background: "#1A1D29", border: "1px solid #252836", fontSize: 12 }}
      >
        <p style={{ color: "#8B8FA8", marginBottom: 4 }}>{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color }}>
            {entry.name}: {formatDuration(entry.value * 60)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function Worklog() {
  const { sessions, exportToCSV } = useApp();
  const [dateFilter, setDateFilter] = useState("今天");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");

  // Filter sessions
  const filteredSessions = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return sessions.filter((s) => {
      // Date filter
      if (dateFilter === "今天" && s.startTime.toDateString() !== today.toDateString()) return false;
      if (dateFilter === "昨天" && s.startTime.toDateString() !== yesterday.toDateString()) return false;
      // Category filter
      if (categoryFilter !== "全部" && s.category !== categoryFilter) return false;
      // Search filter
      if (searchQuery && !s.taskName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [sessions, dateFilter, searchQuery, categoryFilter]);

  // Stats
  const totalTime = filteredSessions.reduce((s, sess) => s + sess.duration, 0);
  const sessionCount = filteredSessions.length;
  const avgTime = sessionCount > 0 ? Math.round(totalTime / sessionCount) : 0;

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSessions.forEach((s) => {
      map[s.category] = (map[s.category] || 0) + s.duration;
    });
    return CATEGORIES.filter((c) => map[c.name]).map((c) => ({
      name: c.name,
      color: c.color,
      bg: c.bg,
      minutes: Math.round((map[c.name] || 0) / 60),
    })).sort((a, b) => b.minutes - a.minutes);
  }, [filteredSessions]);

  // Bar chart data (hourly)
  const hourlyData = useMemo(() => {
    const hours: { hour: string; minutes: number }[] = [];
    for (let i = 8; i <= 20; i++) {
      const hourSessions = filteredSessions.filter(
        (s) => s.startTime.getHours() === i || s.endTime.getHours() === i
      );
      const total = hourSessions.reduce((sum, s) => {
        const start = Math.max(s.startTime.getHours() * 60 + s.startTime.getMinutes(), i * 60);
        const end = Math.min(s.endTime.getHours() * 60 + s.endTime.getMinutes(), (i + 1) * 60);
        return sum + Math.max(0, end - start);
      }, 0);
      hours.push({ hour: `${i}:00`, minutes: Math.round(total) });
    }
    return hours;
  }, [filteredSessions]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, WorkSession[]>();
    filteredSessions.forEach((s) => {
      const key = s.startTime.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [filteredSessions]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="flex items-center gap-2"
            style={{ fontSize: 20, fontWeight: 700, color: "#E8EAF0" }}
          >
            <FileText size={20} style={{ color: "#4F7FFF" }} />
            数据审查
          </h1>
          <p style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
            Worklog · 工作记录与统计分析
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* CSV Export */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
            style={{
              background: "rgba(16,185,129,0.12)",
              color: "#10B981",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid rgba(16,185,129,0.2)",
            }}
          >
            <Download size={14} />
            导出 CSV
          </button>

          {/* Date filter */}
        <div
          className="flex gap-1 p-1 rounded-lg"
          style={{ background: "#161820", border: "1px solid #252836" }}
        >
          {["今天", "昨天", "全部"].map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className="px-3 py-1.5 rounded-md text-sm transition-all"
              style={{
                background: dateFilter === f ? "#252836" : "transparent",
                color: dateFilter === f ? "#E8EAF0" : "#8B8FA8",
                fontWeight: dateFilter === f ? 600 : 400,
              }}
            >
              {f}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="总工时"
          value={`${Math.floor(totalTime / 3600)}h ${Math.floor((totalTime % 3600) / 60)}m`}
          sub={`${sessionCount} 条记录`}
          color="#4F7FFF"
          icon={Clock}
        />
        <StatCard
          label="平均时长"
          value={formatDuration(avgTime)}
          sub="每条记录"
          color="#A855F7"
          icon={TrendingUp}
        />
        <StatCard
          label="记录数"
          value={String(sessionCount)}
          sub={`${catBreakdown.length} 个分类`}
          color="#10B981"
          icon={Calendar}
        />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 240px" }}>
        {/* Main content */}
        <div className="flex flex-col gap-5">
          {/* Hourly bar chart */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0", marginBottom: 12 }}>
              时间分布
            </h3>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={hourlyData} barSize={14}>
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#8B8FA8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                  {hourlyData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.minutes > 30 ? "#4F7FFF" : "#252836"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg"
              style={{ background: "#161820", border: "1px solid #252836" }}
            >
              <Search size={14} style={{ color: "#8B8FA8" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索任务..."
                className="flex-1 outline-none bg-transparent"
                style={{ fontSize: 13, color: "#E8EAF0" }}
              />
            </div>
            <div
              className="flex gap-1 p-1 rounded-lg"
              style={{ background: "#161820", border: "1px solid #252836" }}
            >
              {["全部", ...CATEGORIES.map((c) => c.name)].map((f) => (
                <button
                  key={f}
                  onClick={() => setCategoryFilter(f)}
                  className="px-2.5 py-1 rounded-md text-xs transition-all"
                  style={{
                    background: categoryFilter === f ? "#252836" : "transparent",
                    color:
                      categoryFilter === f
                        ? f === "全部"
                          ? "#E8EAF0"
                          : getCategoryInfo(f).color
                        : "#8B8FA8",
                    fontWeight: categoryFilter === f ? 600 : 400,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Session list */}
          <div className="flex flex-col gap-4">
            {grouped.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12 rounded-xl"
                style={{ border: "1.5px dashed #252836", color: "#8B8FA8" }}
              >
                <FileText size={30} style={{ marginBottom: 10, opacity: 0.4 }} />
                <p style={{ fontSize: 14 }}>暂无工作记录</p>
              </div>
            ) : (
              grouped.map(([dateKey, daySessions]) => (
                <div key={dateKey}>
                  <div className="flex items-center gap-3 mb-2">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#8B8FA8" }}>
                      {formatDate(new Date(dateKey))}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "#252836" }} />
                    <span style={{ fontSize: 12, color: "#8B8FA8" }}>
                      {formatDuration(daySessions.reduce((s, sess) => s + sess.duration, 0))}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {daySessions.map((session) => {
                      const cat = getCategoryInfo(session.category);
                      return (
                        <div
                          key={session.id}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl"
                          style={{
                            background: "#161820",
                            border: "1px solid #252836",
                          }}
                        >
                          <div
                            className="w-1 self-stretch rounded-full flex-shrink-0"
                            style={{ background: cat.color, minHeight: 32 }}
                          />
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>
                              {session.taskName}
                            </p>
                            {/* Tag row */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {session.evalTag && (() => {
                                const ei = getEvalTagInfo(session.evalTag);
                                return ei ? (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-xs"
                                    style={{ background: ei.bg, color: ei.color }}
                                  >
                                    {session.evalTag}
                                  </span>
                                ) : null;
                              })()}
                              {session.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 rounded text-xs"
                                  style={{ background: "#1E2130", color: "#8B8FA8" }}
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                            {session.feeling && (
                              <p className="truncate" style={{ fontSize: 12, color: "#8B8FA8", marginTop: 2, fontStyle: "italic" }}>
                                "{session.feeling}"
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right">
                              <p style={{ fontSize: 11, color: "#8B8FA8" }}>
                                {formatTime(session.startTime)} – {formatTime(session.endTime)}
                              </p>
                              <p
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  fontFamily: "monospace",
                                  color: cat.color,
                                }}
                              >
                                {formatDuration(session.duration)}
                              </p>
                              {session.estimatedMinutes && session.estimatedMinutes > 0 && (() => {
                                const estSec = session.estimatedMinutes * 60;
                                const over = session.duration > estSec;
                                return (
                                  <div className="flex items-center gap-1 mt-0.5 justify-end">
                                    <Target size={10} style={{ color: over ? "#EF4444" : "#10B981" }} />
                                    <span style={{ fontSize: 10, color: over ? "#EF4444" : "#10B981" }}>
                                      预计 {session.estimatedMinutes}m
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                            <span
                              className="px-2 py-1 rounded-md text-xs font-medium"
                              style={{ background: cat.bg, color: cat.color }}
                            >
                              {session.category}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Category breakdown */}
        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl p-4"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0", marginBottom: 12 }}>
              分类占比
            </h3>
            {catBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={catBreakdown}
                      dataKey="minutes"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {catBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 mt-2">
                  {catBreakdown.map((cat) => {
                    const pct =
                      totalTime > 0
                        ? Math.round((cat.minutes * 60 * 100) / totalTime)
                        : 0;
                    return (
                      <div key={cat.name} className="flex items-center gap-2">
                        <span
                          className="rounded-sm flex-shrink-0"
                          style={{ width: 10, height: 10, background: cat.color }}
                        />
                        <span style={{ fontSize: 12, color: "#C4C8E0", flex: 1 }}>
                          {cat.name}
                        </span>
                        <span style={{ fontSize: 12, color: "#8B8FA8" }}>
                          {pct}%
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontFamily: "monospace",
                            color: cat.color,
                            minWidth: 40,
                            textAlign: "right",
                          }}
                        >
                          {cat.minutes}m
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8" style={{ color: "#8B8FA8" }}>
                <p style={{ fontSize: 12 }}>暂无数据</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}