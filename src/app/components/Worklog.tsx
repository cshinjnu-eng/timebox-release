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
  Search,
  Download,
  Target,
  Trash2,
  Plus,
  Newspaper,
  Pencil,
  X,
  Check,
  Flag,
} from "lucide-react";
import { useApp, formatDuration, getCategoryInfo, getEvalTagInfo, CATEGORIES, EVAL_TAGS, WorkSession } from "../context/AppContext";
import { DailyReportDialog } from "./DailyReportDialog";

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
      className="rounded-xl p-4 flex items-start gap-3 flex-shrink-0"
      style={{ background: "#161820", border: "1px solid #252836", minWidth: 140 }}
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

// ─── Edit Session Dialog ────────────────────────────────────────────────
function EditSessionDialog({
  session,
  onClose,
}: {
  session: WorkSession;
  onClose: () => void;
}) {
  const { updateSession } = useApp();
  const [taskName, setTaskName] = useState(session.taskName);
  const [category, setCategory] = useState(session.category);
  const [evalTag, setEvalTag] = useState(session.evalTag || "");
  const [startVal, setStartVal] = useState(() => {
    const d = session.startTime;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  });
  const [endVal, setEndVal] = useState(() => {
    const d = session.endTime;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  });
  const [feeling, setFeeling] = useState(session.feeling || "");
  const [outcome, setOutcome] = useState<"completed" | "abandoned" | "">(session.outcome || "");

  function handleSave() {
    const st = new Date(startVal);
    const et = new Date(endVal);
    if (isNaN(st.getTime()) || isNaN(et.getTime()) || et <= st) return;
    const cat = getCategoryInfo(category);
    const updated: WorkSession = {
      ...session,
      taskName: taskName.trim() || session.taskName,
      category,
      evalTag: evalTag || undefined,
      color: cat.color,
      startTime: st,
      endTime: et,
      duration: Math.round((et.getTime() - st.getTime()) / 1000),
      feeling: feeling.trim() || undefined,
      outcome: outcome || undefined,
    };
    updateSession(updated);
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0B0D14",
    border: "1px solid #252836",
    borderRadius: 8,
    padding: "8px 12px",
    color: "#E8EAF0",
    fontSize: 13,
    outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#8B8FA8", marginBottom: 6, display: "block" };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-t-2xl overflow-auto"
        style={{ background: "#161820", border: "1px solid #252836", maxHeight: "85vh", paddingBottom: "max(16px,env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #252836" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#E8EAF0" }}>编辑记录</span>
          <button onClick={onClose} style={{ color: "#8B8FA8" }}><X size={16} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Task Name */}
          <div>
            <label style={labelStyle}>任务名称</label>
            <input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              style={inputStyle}
            />
          </div>
          {/* Category */}
          <div>
            <label style={labelStyle}>定性标签</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCategory(c.name)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: category === c.name ? c.bg : "#1A1D29",
                    color: category === c.name ? c.color : "#8B8FA8",
                    border: `1px solid ${category === c.name ? c.color + "44" : "transparent"}`,
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          {/* Eval Tag */}
          <div>
            <label style={labelStyle}>评估标签 <span style={{ color: "#525675" }}>（可选）</span></label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEvalTag("")}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: evalTag === "" ? "#252836" : "#1A1D29",
                  color: evalTag === "" ? "#E8EAF0" : "#8B8FA8",
                }}
              >
                无
              </button>
              {EVAL_TAGS.map((e) => (
                <button
                  key={e.label}
                  onClick={() => setEvalTag(e.label)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: evalTag === e.label ? e.bg : "#1A1D29",
                    color: evalTag === e.label ? e.color : "#8B8FA8",
                    border: `1px solid ${evalTag === e.label ? e.color + "44" : "transparent"}`,
                  }}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>开始时间</label>
              <input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>结束时间</label>
              <input type="datetime-local" value={endVal} onChange={(e) => setEndVal(e.target.value)} style={inputStyle} />
            </div>
          </div>
          {/* Outcome */}
          <div>
            <label style={labelStyle}>完成结果</label>
            <div className="flex gap-2">
              {(["", "completed", "abandoned"] as const).map((o) => {
                const labels: Record<string, string> = { "": "未标记", completed: "已完成", abandoned: "已放弃" };
                const colors: Record<string, string> = { "": "#8B8FA8", completed: "#10B981", abandoned: "#F59E0B" };
                return (
                  <button
                    key={o}
                    onClick={() => setOutcome(o)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: outcome === o ? `${colors[o]}22` : "#1A1D29",
                      color: outcome === o ? colors[o] : "#525675",
                      border: `1px solid ${outcome === o ? colors[o] + "44" : "transparent"}`,
                    }}
                  >
                    {labels[o]}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Feeling */}
          <div>
            <label style={labelStyle}>感受备注</label>
            <textarea
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              rows={2}
              placeholder="记录一下..."
              style={{ ...inputStyle, resize: "none" }}
            />
          </div>
        </div>
        {/* Footer */}
        <div className="flex gap-3 px-5 pb-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg py-2.5"
            style={{ background: "#252836", color: "#8B8FA8", fontSize: 14, fontWeight: 600 }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5"
            style={{ background: "linear-gradient(135deg,#4F7FFF,#A855F7)", color: "#fff", fontSize: 14, fontWeight: 600 }}
          >
            <Check size={14} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function Worklog() {
  const { sessions, exportToCSV, deleteSession, setShowManualSessionDialog, clearAllData } = useApp();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dateFilter, setDateFilter] = useState("今天");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<WorkSession | null>(null);
  const [showDailyReport, setShowDailyReport] = useState(false);
  const [chartMode, setChartMode] = useState<"category" | "eval">("category");

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
  const productiveTime = filteredSessions
    .filter((s) => s.category === "工作" || s.category === "学习")
    .reduce((s, sess) => s + sess.duration, 0);
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

  // Bar chart data (hourly, stacked by category or eval tag)
  const hourlyData = useMemo(() => {
    const hours = [];
    for (let i = 0; i <= 23; i++) {
      const entry: Record<string, any> = { hour: `${i}` };
      const keys = chartMode === "category"
        ? CATEGORIES.map((c) => c.name)
        : ["必须/有意义", "必须/没意义", "不必须/有意义", "不必须/没意义"];
      for (const key of keys) {
        const secs = filteredSessions
          .filter((s) => chartMode === "category" ? s.category === key : s.evalTag === key)
          .reduce((sum, s) => {
            const start = Math.max(s.startTime.getHours() * 60 + s.startTime.getMinutes(), i * 60);
            const end = Math.min(s.endTime.getHours() * 60 + s.endTime.getMinutes(), (i + 1) * 60);
            return sum + Math.max(0, end - start);
          }, 0);
        entry[key] = Math.round(secs);
      }
      hours.push(entry);
    }
    return hours;
  }, [filteredSessions, chartMode]);

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
      <div className="flex flex-col gap-3 mb-6">
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

        <div className="flex items-center gap-2 flex-wrap">
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

          <div className="flex-1" />

          {/* Manual Add */}
          <button
            onClick={() => setShowManualSessionDialog(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
            style={{
              background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus size={14} />
            手动记录
          </button>

          {/* Daily Report */}
          <button
            onClick={() => setShowDailyReport(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
            style={{
              background: "rgba(79,127,255,0.12)",
              color: "#4F7FFF",
              border: "1px solid rgba(79,127,255,0.2)",
              fontSize: 13,
              fontWeight: 600,
            }}
            title="生成日报"
          >
            <Newspaper size={14} />
            日报
          </button>

          {/* CSV Export */}
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 32,
              height: 32,
              background: "rgba(16,185,129,0.12)",
              color: "#10B981",
              border: "1px solid rgba(16,185,129,0.2)",
            }}
            title="导出 CSV"
          >
            <Download size={14} />
          </button>

          {/* Clear All Data */}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 32,
              height: 32,
              background: "rgba(239,68,68,0.10)",
              color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
            title="清空所有数据"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Edit Session Dialog */}
      {editingSession && (
        <EditSessionDialog
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}

      {/* Clear Confirm Dialog */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="rounded-2xl p-6 mx-4"
            style={{ background: "#161820", border: "1px solid #EF444455", maxWidth: 320, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0", marginBottom: 8 }}>清空所有数据？</p>
            <p style={{ fontSize: 13, color: "#8B8FA8", marginBottom: 20 }}>
              将删除所有任务、记录和待办事项，且无法恢复。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-lg py-2.5"
                style={{ background: "#252836", color: "#C4C8E0", fontSize: 14, fontWeight: 600 }}
              >
                取消
              </button>
              <button
                onClick={async () => {
                  await clearAllData();
                  setShowClearConfirm(false);
                }}
                className="flex-1 rounded-lg py-2.5"
                style={{ background: "#EF444422", color: "#EF4444", border: "1px solid #EF444444", fontSize: 14, fontWeight: 600 }}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards - horizontal scroll on mobile */}
      <div className="flex gap-3 mb-4 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
        <StatCard
          label="学习/工作"
          value={`${Math.floor(productiveTime / 3600)}h ${Math.floor((productiveTime % 3600) / 60)}m`}
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

      <div className="flex flex-col gap-4">
        {/* Main content */}
        <div className="flex flex-col gap-5">
          {/* Hourly bar chart */}
          <div
            className="rounded-xl p-4"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>
                时间分布
              </h3>
              <div
                className="flex gap-1 p-0.5 rounded-lg"
                style={{ background: "#0B0D14", border: "1px solid #252836" }}
              >
                {(["category", "eval"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setChartMode(mode)}
                    className="px-2.5 py-1 rounded-md text-xs transition-all"
                    style={{
                      background: chartMode === mode ? "#252836" : "transparent",
                      color: chartMode === mode ? "#E8EAF0" : "#8B8FA8",
                      fontWeight: chartMode === mode ? 600 : 400,
                    }}
                  >
                    {mode === "category" ? "定性" : "评估"}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={hourlyData} barSize={14} stackOffset="none">
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#8B8FA8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                {chartMode === "category"
                  ? CATEGORIES.map((c) => (
                      <Bar key={c.name} dataKey={c.name} stackId="a" fill={c.color} radius={[0,0,0,0]} />
                    ))
                  : ["必须/有意义", "必须/没意义", "不必须/有意义", "不必须/没意义"].map((label) => {
                      const info = getEvalTagInfo(label);
                      return (
                        <Bar key={label} dataKey={label} stackId="a" fill={info?.color ?? "#525675"} radius={[0,0,0,0]} />
                      );
                    })
                }
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {(chartMode === "category" ? CATEGORIES : ["必须/有意义", "必须/没意义", "不必须/有意义", "不必须/没意义"].map((l) => ({ name: l, color: getEvalTagInfo(l)?.color ?? "#525675" }))).map((item) => (
                <div key={item.name} className="flex items-center gap-1">
                  <span className="rounded-sm" style={{ width: 8, height: 8, background: item.color, display: "inline-block" }} />
                  <span style={{ fontSize: 10, color: "#8B8FA8" }}>{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2 rounded-lg"
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
              className="flex gap-1 p-1 rounded-lg overflow-x-auto"
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
                        <div key={session.id} className="flex flex-col">
                        <div
                          className={`flex items-center gap-3 px-4 py-3 group ${confirmDeleteId === session.id ? "rounded-t-xl" : "rounded-xl"}`}
                          style={{
                            background: "#161820",
                            border: confirmDeleteId === session.id ? "1px solid rgba(239,68,68,0.3)" : "1px solid #252836",
                            borderBottom: confirmDeleteId === session.id ? "none" : undefined,
                            transition: "border-color 0.2s",
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
                              {session.outcome === "abandoned" && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-xs flex items-center gap-1"
                                  style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
                                >
                                  <Flag size={9} />
                                  放弃
                                </span>
                              )}
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
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                            <button
                              onClick={() => setEditingSession(session)}
                              className="flex items-center justify-center rounded-lg transition-all"
                              style={{
                                width: 30, height: 30,
                                background: "#1A1D29",
                                color: "#525675",
                              }}
                              title="编辑记录"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(
                                confirmDeleteId === session.id ? null : session.id
                              )}
                              className="flex items-center justify-center rounded-lg transition-all"
                              style={{
                                width: 30, height: 30,
                                background: confirmDeleteId === session.id ? "rgba(239,68,68,0.15)" : "#1A1D29",
                                color: confirmDeleteId === session.id ? "#EF4444" : "#525675",
                              }}
                              title="删除记录"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {/* Delete confirmation */}
                        {confirmDeleteId === session.id && (
                          <div
                            className="flex items-center justify-end gap-2 px-4 py-2 rounded-b-xl"
                            style={{
                              background: "rgba(239,68,68,0.06)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              borderTop: "1px solid rgba(239,68,68,0.15)",
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#EF4444", flex: 1 }}>
                              确认删除这条记录？
                            </span>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-3 py-1 rounded-md text-xs transition-colors"
                              style={{ background: "#252836", color: "#8B8FA8" }}
                            >
                              取消
                            </button>
                            <button
                              onClick={() => {
                                deleteSession(session.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-3 py-1 rounded-md text-xs transition-colors"
                              style={{ background: "#EF4444", color: "#fff", fontWeight: 600 }}
                            >
                              确认删除
                            </button>
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Daily Report Dialog */}
        <DailyReportDialog
          open={showDailyReport}
          onClose={() => setShowDailyReport(false)}
          sessions={filteredSessions}
          date={dateFilter === "昨天" ? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })() : new Date()}
        />

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