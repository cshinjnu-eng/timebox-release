import { useState } from "react";
import {
  Play,
  Pause,
  Square,
  Plus,
  Clock,
  Flame,
  MoreHorizontal,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  useApp,
  formatElapsed,
  getCategoryInfo,
  getEvalTagInfo,
  CATEGORIES,
  Task,
} from "../context/AppContext";



function TimerCard({ task }: { task: Task }) {
  const { toggleTimer, setTaskToEnd, setShowEndTaskDialog } = useApp();
  const [hovered, setHovered] = useState(false);

  const cat = getCategoryInfo(task.category);
  const evalInfo = task.evalTag ? getEvalTagInfo(task.evalTag) : null;

  function handleStop() {
    setTaskToEnd(task);
    setShowEndTaskDialog(true);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-xl overflow-hidden flex flex-col"
      style={{
        background: "#161820",
        border: `1px solid ${hovered ? cat.color + "55" : "#252836"}`,
        transition: "border-color 0.2s",
      }}
    >
      {/* Left color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ background: cat.color }}
      />

      <div className="pl-4 pr-4 pt-4 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0"
                style={{ background: cat.bg, color: cat.color }}
              >
                {task.category}
              </span>
              {evalInfo && (
                <span
                  className="px-1.5 py-0.5 rounded-md text-xs flex-shrink-0"
                  style={{ background: evalInfo.bg, color: evalInfo.color }}
                >
                  {task.evalTag}
                </span>
              )}
              {task.tags.slice(0, 1).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{ background: "#252836", color: "#8B8FA8" }}
                >
                  #{tag}
                </span>
              ))}
            </div>
            <h3
              className="truncate"
              style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}
            >
              {task.name}
            </h3>
            {task.description && (
              <p
                className="truncate mt-0.5"
                style={{ fontSize: 12, color: "#8B8FA8" }}
              >
                {task.description}
              </p>
            )}
          </div>
          <button
            className="flex-shrink-0 p-1 rounded-md transition-colors"
            style={{ color: "#8B8FA8" }}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Estimated vs actual */}
        {task.estimatedMinutes && task.estimatedMinutes > 0 && (() => {
          const estSeconds = task.estimatedMinutes * 60;
          const ratio = task.elapsed / estSeconds;
          const statusColor = ratio < 0.75 ? "#10B981" : ratio < 1 ? "#F59E0B" : "#EF4444";
          const estLabel = task.estimatedMinutes >= 60
            ? `${Math.floor(task.estimatedMinutes / 60)}h${task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ""}`
            : `${task.estimatedMinutes}m`;
          return (
            <div className="flex items-center gap-2 mt-1 mb-1">
              <Target size={12} style={{ color: "#06B6D4", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#8B8FA8" }}>预计 {estLabel}</span>
              <div className="flex-1 rounded-full" style={{ height: 3, background: "#252836" }}>
                <div
                  className="rounded-full"
                  style={{
                    height: "100%",
                    width: `${Math.min(ratio * 100, 100)}%`,
                    background: statusColor,
                    transition: "width 1s linear, background 0.3s",
                  }}
                />
              </div>
              <span style={{ fontSize: 10, color: statusColor, fontWeight: 600, minWidth: 32, textAlign: "right" }}>
                {Math.round(ratio * 100)}%
              </span>
            </div>
          );
        })()}

        {/* Timer */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-full px-1.5"
              style={{
                background: task.isRunning ? "rgba(16,185,129,0.15)" : "#252836",
              }}
            >
              <span
                className="rounded-full inline-block"
                style={{
                  width: 6,
                  height: 6,
                  background: task.isRunning ? "#10B981" : "#8B8FA8",
                  animation: task.isRunning ? "pulse 1.5s infinite" : "none",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 26,
                fontWeight: 700,
                fontFamily: "monospace",
                letterSpacing: "0.04em",
                color: task.isRunning ? "#E8EAF0" : "#8B8FA8",
              }}
            >
              {formatElapsed(task.elapsed)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleTimer(task.id)}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{
                width: 34,
                height: 34,
                background: task.isRunning ? "rgba(79,127,255,0.15)" : "rgba(16,185,129,0.15)",
                color: task.isRunning ? "#4F7FFF" : "#10B981",
              }}
            >
              {task.isRunning ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={handleStop}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{
                width: 34,
                height: 34,
                background: "rgba(239,68,68,0.1)",
                color: "#EF4444",
              }}
            >
              <Square size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar (simulated daily 8h) */}
      <div style={{ height: 3, background: "#252836" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min((task.elapsed / (8 * 3600)) * 100, 100)}%`,
            background: `linear-gradient(90deg, ${cat.color}99, ${cat.color})`,
            transition: "width 1s linear",
          }}
        />
      </div>
    </motion.div>
  );
}


export function Dashboard() {
  const { tasks, setShowNewTaskDialog } = useApp();

  const runningCount = tasks.filter((t) => t.isRunning).length;
  const pausedCount = tasks.filter((t) => !t.isRunning).length;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 pb-24">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              style={{ fontSize: 18, fontWeight: 700, color: "#E8EAF0" }}
              className="flex items-center gap-2"
            >
              <Flame size={18} style={{ color: "#F59E0B" }} />
              并行计时
            </h1>
            <p style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
              {runningCount} 个运行中 · {pausedCount} 个已暂停
            </p>
          </div>
          <button
            onClick={() => setShowNewTaskDialog(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors"
            style={{
              background: "rgba(79,127,255,0.12)",
              color: "#4F7FFF",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus size={15} />
            新建计时
          </button>
        </div>

        {/* Timer cards - single column for mobile */}
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {tasks.map((task) => (
              <TimerCard key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>

        {tasks.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl"
            style={{ border: "1.5px dashed #252836", color: "#8B8FA8" }}
          >
            <Clock size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ fontSize: 14 }}>暂无进行中的计时任务</p>
            <button
              onClick={() => setShowNewTaskDialog(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
              style={{ background: "rgba(79,127,255,0.15)", color: "#4F7FFF" }}
            >
              + 新建计时任务
            </button>
          </div>
        )}

        {/* Category summary */}
        {tasks.length > 0 && (
          <div className="mt-6">
            <p style={{ fontSize: 12, color: "#8B8FA8", marginBottom: 10 }}>分类分布</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const catTasks = tasks.filter((t) => t.category === cat.name);
                if (catTasks.length === 0) return null;
                const total = catTasks.reduce((s, t) => s + t.elapsed, 0);
                const h = Math.floor(total / 3600);
                const m = Math.floor((total % 3600) / 60);
                return (
                  <div
                    key={cat.name}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: cat.bg, border: `1px solid ${cat.color}33` }}
                  >
                    <span
                      className="rounded-sm"
                      style={{ width: 8, height: 8, background: cat.color, display: "inline-block" }}
                    />
                    <span style={{ fontSize: 12, color: cat.color }}>{cat.name}</span>
                    <span style={{ fontSize: 12, color: "#8B8FA8", fontFamily: "monospace" }}>
                      {h > 0 ? `${h}h` : ""}{m}m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}