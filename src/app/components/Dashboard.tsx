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
  PictureInPicture2,
  Moon,
  Check,
  Pencil,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Trash2,
  Boxes,
  RotateCcw,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { motion, AnimatePresence } from "motion/react";
import {
  useApp,
  formatElapsed,
  getCategoryInfo,
  getEvalTagInfo,
  CATEGORIES,
  Task,
  SleepSuggestion,
  LongTask,
} from "../context/AppContext";
import { AICommandBar } from "./AICommandBar";
import { AIInsightList } from "./AIInsightCard";



function formatSleepTime(ms: number) {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

function formatSleepDuration(startMs: number, endMs: number) {
  const mins = Math.round((endMs - startMs) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function isYesterday(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth();
}

function SleepCard({ suggestion }: { suggestion: SleepSuggestion }) {
  const { confirmSleep, dismissSleep, openManualWithPrefill } = useApp();
  const startLabel = (isYesterday(suggestion.start) ? "昨晚" : "") + formatSleepTime(suggestion.start);
  const endLabel = formatSleepTime(suggestion.end);
  const duration = formatSleepDuration(suggestion.start, suggestion.end);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-xl px-4 py-3 flex items-center gap-3"
      style={{
        background: "rgba(6, 182, 212, 0.06)",
        border: "1px solid rgba(6, 182, 212, 0.20)",
        boxShadow: "0 0 16px rgba(6, 182, 212, 0.05), inset 0 1px 0 rgba(6, 182, 212, 0.03)",
      }}
    >
      <Moon size={16} style={{ color: "#06B6D4", flexShrink: 0, filter: "drop-shadow(0 0 4px rgba(6, 182, 212, 0.3))" }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13, color: "#06B6D4", fontWeight: 600 }}>推测睡眠</p>
        <p className="tb-mono" style={{ fontSize: 12, color: "#8B8FA8", marginTop: 1 }}>
          {startLabel} — {endLabel} · {duration}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => confirmSleep(suggestion.id)}
          className="flex items-center justify-center rounded-lg transition-colors"
          title="确认"
          style={{ width: 30, height: 30, background: "rgba(16,185,129,0.15)", color: "#10B981" }}
        >
          <Check size={14} />
        </button>
        <button
          onClick={() =>
            openManualWithPrefill({
              name: "睡觉",
              category: "睡觉",
              startTime: new Date(suggestion.start),
              endTime: new Date(suggestion.end),
            })
          }
          className="flex items-center justify-center rounded-lg transition-colors"
          title="修改"
          style={{ width: 30, height: 30, background: "rgba(79,127,255,0.12)", color: "#4F7FFF" }}
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => dismissSleep(suggestion.id)}
          className="flex items-center justify-center rounded-lg transition-colors"
          title="忽略"
          style={{ width: 30, height: 30, background: "#252836", color: "#525675" }}
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

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
        background: task.isRunning
          ? `linear-gradient(135deg, rgba(22, 24, 32, 0.95), rgba(22, 24, 32, 0.85))`
          : "#161820",
        border: `1px solid ${hovered || task.isRunning ? cat.color + "40" : "#252836"}`,
        boxShadow: task.isRunning
          ? `0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px ${cat.color}15, inset 0 1px 0 rgba(255, 255, 255, 0.03)`
          : `0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.02)`,
        transition: "border-color 0.3s, box-shadow 0.3s",
      }}
    >
      {/* Left color bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{
          background: cat.color,
          boxShadow: task.isRunning ? `0 0 8px ${cat.color}66` : "none",
        }}
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
            style={{ color: "#525675" }}
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
              <span className="tb-mono" style={{ fontSize: 11, color: "#8B8FA8" }}>预计 {estLabel}</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: "#252836" }}>
                <div
                  className="rounded-full"
                  style={{
                    height: "100%",
                    width: `${Math.min(ratio * 100, 100)}%`,
                    background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`,
                    boxShadow: `0 0 6px ${statusColor}44`,
                    transition: "width 1s linear, background 0.3s",
                  }}
                />
              </div>
              <span className="tb-mono" style={{ fontSize: 10, color: statusColor, fontWeight: 600, minWidth: 32, textAlign: "right" }}>
                {Math.round(ratio * 100)}%
              </span>
            </div>
          );
        })()}

        {/* Timer */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2.5">
            {/* Running indicator with pulse ring */}
            <div className="relative flex items-center justify-center" style={{ width: 14, height: 14 }}>
              <span
                className="rounded-full inline-block"
                style={{
                  width: 7,
                  height: 7,
                  background: task.isRunning ? "#10B981" : "#525675",
                  boxShadow: task.isRunning ? "0 0 6px #10B98188" : "none",
                  transition: "all 0.3s",
                }}
              />
              {task.isRunning && (
                <span
                  className="absolute rounded-full"
                  style={{
                    width: 14,
                    height: 14,
                    border: "1.5px solid #10B981",
                    animation: "pulse-ring 2s ease-out infinite",
                  }}
                />
              )}
            </div>
            <span
              className="tb-timer"
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: task.isRunning ? "#E8EAF0" : "#8B8FA8",
                textShadow: task.isRunning
                  ? `0 0 12px ${cat.color}40, 0 0 4px rgba(232, 234, 240, 0.1)`
                  : "none",
                transition: "color 0.3s, text-shadow 0.3s",
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
                width: 36,
                height: 36,
                background: task.isRunning ? "rgba(79, 127, 255, 0.12)" : "rgba(16, 185, 129, 0.12)",
                color: task.isRunning ? "#4F7FFF" : "#10B981",
                border: `1px solid ${task.isRunning ? "rgba(79, 127, 255, 0.15)" : "rgba(16, 185, 129, 0.15)"}`,
                boxShadow: `0 0 8px ${task.isRunning ? "rgba(79, 127, 255, 0.1)" : "rgba(16, 185, 129, 0.1)"}`,
              }}
            >
              {task.isRunning ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              onClick={handleStop}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{
                width: 36,
                height: 36,
                background: "rgba(239, 68, 68, 0.08)",
                color: "#EF4444",
                border: "1px solid rgba(239, 68, 68, 0.12)",
              }}
            >
              <Square size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar (simulated daily 8h) */}
      <div style={{ height: 3, background: "#1A1D29" }}>
        <div
          style={{
            height: "100%",
            width: `${Math.min((task.elapsed / (8 * 3600)) * 100, 100)}%`,
            background: `linear-gradient(90deg, ${cat.color}66, ${cat.color})`,
            boxShadow: task.isRunning ? `0 0 8px ${cat.color}44` : "none",
            transition: "width 1s linear",
          }}
        />
      </div>
    </motion.div>
  );
}


// ─── 应用桶检测横幅 ────────────────────────────────────────────────────
function BucketDetectionBanner() {
  const { bucketDetection, confirmBucketDetection, dismissBucketDetection } = useApp();
  if (!bucketDetection) return null;

  const det = bucketDetection as any;
  const segCount = det._pendingSegments?.length || 1;
  const startLabel = formatSleepTime(bucketDetection.trueStart);
  const endLabel = formatSleepTime(bucketDetection.trueEnd);
  const durMins = bucketDetection.detectedMinutes;
  const durLabel = durMins >= 60
    ? `${Math.floor(durMins / 60)}h${durMins % 60 > 0 ? `${durMins % 60}m` : ""}`
    : `${durMins}m`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3"
      style={{ background: `${bucketDetection.color}12`, border: `1px solid ${bucketDetection.color}40` }}
    >
      <Boxes size={16} style={{ color: bucketDetection.color, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13, color: bucketDetection.color, fontWeight: 600 }}>
          {`「${bucketDetection.bucketName}」使用记录`}
        </p>
        <p style={{ fontSize: 11, color: "#8B8FA8", marginTop: 1 }}>
          {segCount > 1
            ? `累计 ${durLabel} · ${segCount} 个片段`
            : `${startLabel} — ${endLabel} · ${durLabel}`}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={confirmBucketDetection}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: bucketDetection.color, color: "#fff" }}
        >
          <Check size={12} />
          记录使用
        </button>
        <button
          onClick={dismissBucketDetection}
          className="p-1.5 rounded-lg"
          style={{ background: "#252836", color: "#525675" }}
        >
          <X size={13} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── 长线任务卡片 ──────────────────────────────────────────────────────
function LongTaskCard({ task }: { task: LongTask }) {
  const { toggleLongTask, endLongTask, addCheckpoint, toggleCheckpoint, deleteCheckpoint } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [newCp, setNewCp] = useState("");
  const cat = getCategoryInfo(task.category);
  const doneCount = task.checkpoints.filter(c => c.completed).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl overflow-hidden"
      style={{ background: "#161820", border: `1px solid ${task.isRunning ? cat.color + "40" : "#252836"}` }}
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="rounded-full flex-shrink-0"
          style={{ width: 10, height: 10, background: task.isRunning ? cat.color : "#525675",
            boxShadow: task.isRunning ? `0 0 8px ${cat.color}88, 0 0 2px ${cat.color}` : "none",
            transition: "all 0.3s" }}
        />
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: task.isRunning ? "#E8EAF0" : "#8B8FA8" }}>{task.name}</p>
          <p className="tb-mono" style={{ fontSize: 11, color: "#525675" }}>
            {formatElapsed(task.elapsed)}
            {task.checkpoints.length > 0 && ` · ${doneCount}/${task.checkpoints.length} 打点`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Pause/Resume */}
          <button
            onClick={() => toggleLongTask(task.id)}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: task.isRunning ? "rgba(79,127,255,0.12)" : "rgba(16,185,129,0.12)", color: task.isRunning ? "#4F7FFF" : "#10B981" }}
          >
            {task.isRunning ? <Pause size={13} /> : <RotateCcw size={13} />}
          </button>
          {/* Stop */}
          <button
            onClick={() => endLongTask(task.id)}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: "rgba(239,68,68,0.1)", color: "#EF4444" }}
          >
            <Square size={12} />
          </button>
          {/* Expand */}
          <button onClick={() => setExpanded(v => !v)} className="p-1 rounded-lg" style={{ color: "#525675" }}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {/* Checkpoint list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3" style={{ borderTop: "1px solid #1A1D29" }}>
              {task.checkpoints.length === 0 && (
                <p style={{ fontSize: 12, color: "#525675", paddingTop: 10, paddingBottom: 2 }}>
                  还没有打点记录，添加一个小节点
                </p>
              )}
              <div className="flex flex-col gap-1.5 mt-2">
                {task.checkpoints.map((cp) => (
                  <div key={cp.id} className="flex items-center gap-2">
                    <button onClick={() => toggleCheckpoint(task.id, cp.id)} className="flex-shrink-0">
                      {cp.completed
                        ? <CheckSquare size={16} style={{ color: "#10B981" }} />
                        : <div style={{ width: 16, height: 16, borderRadius: 4, border: "1.5px solid #525675" }} />
                      }
                    </button>
                    <span className="flex-1 text-sm" style={{ color: cp.completed ? "#525675" : "#C4C8E0", textDecoration: cp.completed ? "line-through" : "none" }}>
                      {cp.text}
                    </span>
                    <button onClick={() => deleteCheckpoint(task.id, cp.id)} className="flex-shrink-0 p-1 rounded" style={{ color: "#525675" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Add checkpoint */}
              <div className="flex items-center gap-2 mt-3">
                <input
                  value={newCp}
                  onChange={(e) => setNewCp(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newCp.trim()) {
                      addCheckpoint(task.id, newCp.trim());
                      setNewCp("");
                    }
                  }}
                  placeholder="添加打点节点..."
                  className="flex-1 px-3 py-1.5 rounded-lg outline-none text-sm"
                  style={{ background: "#0B0D14", border: "1px solid #252836", color: "#E8EAF0" }}
                />
                <button
                  onClick={() => { if (newCp.trim()) { addCheckpoint(task.id, newCp.trim()); setNewCp(""); } }}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "rgba(79,127,255,0.12)", color: "#4F7FFF" }}
                >
                  添加
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 长线任务区块 ──────────────────────────────────────────────────────
function LongTaskSection() {
  const { longTasks, setShowNewLongTaskDialog } = useApp();
  const runningCount = longTasks.filter(t => t.isRunning).length;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>
            <Layers size={14} style={{ color: "#A855F7" }} />
            长线任务
          </h2>
          {longTasks.length > 0 && (
            <p style={{ fontSize: 12, color: "#525675", marginTop: 1 }}>
              {runningCount} 个进行中 · 点击展开打点记录
            </p>
          )}
        </div>
        <button
          onClick={() => setShowNewLongTaskDialog(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2"
          style={{ background: "rgba(168,85,247,0.12)", color: "#A855F7", fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={14} />
          新建
        </button>
      </div>
      {longTasks.length > 0 ? (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {longTasks.map((task) => (
              <LongTaskCard key={task.id} task={task} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-8 rounded-xl"
          style={{
            border: "1px dashed #252836",
            color: "#8B8FA8",
            background: "radial-gradient(ellipse at center, rgba(168, 85, 247, 0.02) 0%, transparent 70%)",
          }}
        >
          <Layers size={28} style={{ marginBottom: 8, opacity: 0.3, filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.15))" }} />
          <p style={{ fontSize: 13 }}>还没有长线任务</p>
          <p style={{ fontSize: 11, color: "#525675", marginTop: 3, textAlign: "center" }}>适合持续多小时的任务，支持打点记录</p>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { tasks, setShowNewTaskDialog, showFloating, sleepSuggestions } = useApp();

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
              <Flame size={18} style={{ color: "#F59E0B", filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.3))" }} />
              并行计时
            </h1>
            <p className="tb-mono" style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
              {runningCount} 个运行中 · {pausedCount} 个已暂停
            </p>
          </div>
          <div className="flex items-center gap-2">
            {Capacitor.getPlatform() === "android" && runningCount > 0 && (
              <button
                onClick={showFloating}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all"
                style={{
                  background: "rgba(16, 185, 129, 0.10)",
                  color: "#10B981",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "1px solid rgba(16, 185, 129, 0.15)",
                }}
              >
                <PictureInPicture2 size={15} />
                悬浮窗
              </button>
            )}
            <button
              onClick={() => setShowNewTaskDialog(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all"
              style={{
                background: "rgba(79, 127, 255, 0.10)",
                color: "#4F7FFF",
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid rgba(79, 127, 255, 0.15)",
              }}
            >
              <Plus size={15} />
              新建计时
            </button>
          </div>
        </div>

        {/* AI 命令栏 */}
        <div className="mb-3">
          <AICommandBar />
        </div>

        {/* AI 洞察卡片 */}
        <div className="mb-3">
          <AIInsightList />
        </div>

        {/* Bucket detection banner */}
        <AnimatePresence>
          <BucketDetectionBanner />
        </AnimatePresence>

        {/* Sleep suggestion cards */}
        {sleepSuggestions.length > 0 && (
          <div className="mb-4">
            <p style={{ fontSize: 11, color: "#525675", marginBottom: 8, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              待确认
            </p>
            <div className="flex flex-col gap-2">
              <AnimatePresence>
                {sleepSuggestions.map((s) => (
                  <SleepCard key={s.id} suggestion={s} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

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
            style={{
              border: "1px dashed #252836",
              color: "#8B8FA8",
              background: "radial-gradient(ellipse at center, rgba(79, 127, 255, 0.03) 0%, transparent 70%)",
            }}
          >
            <div style={{
              filter: "drop-shadow(0 0 12px rgba(79, 127, 255, 0.15))",
              marginBottom: 12,
            }}>
              <Clock size={36} style={{ opacity: 0.4 }} />
            </div>
            <p style={{ fontSize: 14 }}>暂无进行中的计时任务</p>
            <button
              onClick={() => setShowNewTaskDialog(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm transition-all"
              style={{
                background: "rgba(79, 127, 255, 0.10)",
                color: "#4F7FFF",
                border: "1px solid rgba(79, 127, 255, 0.15)",
              }}
            >
              + 新建计时任务
            </button>
          </div>
        )}

        {/* Long tasks section */}
        <LongTaskSection />

        {/* Category summary */}
        {tasks.length > 0 && (
          <div className="mt-6">
            <p style={{ fontSize: 12, color: "#525675", marginBottom: 10, fontWeight: 600, letterSpacing: "0.05em" }}>分类分布</p>
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
                    style={{
                      background: cat.bg,
                      border: `1px solid ${cat.color}20`,
                      boxShadow: `0 0 8px ${cat.color}08`,
                    }}
                  >
                    <span
                      className="rounded-sm"
                      style={{
                        width: 8,
                        height: 8,
                        background: cat.color,
                        display: "inline-block",
                        boxShadow: `0 0 4px ${cat.color}66`,
                      }}
                    />
                    <span style={{ fontSize: 12, color: cat.color }}>{cat.name}</span>
                    <span className="tb-mono" style={{ fontSize: 12, color: "#8B8FA8" }}>
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