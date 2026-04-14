import { CheckCircle2, Circle, Play, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { type IdeaTask } from "../../context/AppContext";

const PRIORITY_COLORS: Record<number, { color: string; label: string }> = {
  0: { color: "#EF4444", label: "P0" },
  1: { color: "#F97316", label: "P1" },
  2: { color: "#F59E0B", label: "P2" },
  3: { color: "#4F7FFF", label: "P3" },
  4: { color: "#8B8FA8", label: "P4" },
  5: { color: "#525675", label: "P5" },
};

function formatTime(seconds: number) {
  if (seconds === 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  return `${m}m`;
}

export function TaskItem({
  task,
  onToggle,
  onDelete,
  onStartTimer,
}: {
  task: IdeaTask;
  onToggle: () => void;
  onDelete: () => void;
  onStartTimer?: () => void;
}) {
  const pInfo = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS[3];
  const isDone = task.status === "completed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg group"
      style={{
        background: isDone ? "rgba(22, 24, 32, 0.5)" : "#1A1D29",
        border: "1px solid #252836",
      }}
    >
      {/* Checkbox */}
      <button onClick={onToggle} className="flex-shrink-0">
        {isDone ? (
          <CheckCircle2 size={18} style={{ color: "#10B981" }} />
        ) : (
          <Circle size={18} style={{ color: "#525675" }} />
        )}
      </button>

      {/* Title */}
      <span
        className="flex-1 text-sm min-w-0 truncate"
        style={{
          color: isDone ? "#525675" : "#E8EAF0",
          textDecoration: isDone ? "line-through" : "none",
        }}
      >
        {task.title}
      </span>

      {/* Priority badge */}
      <span
        className="tb-mono text-xs px-1.5 py-0.5 rounded flex-shrink-0"
        style={{
          background: `${pInfo.color}15`,
          color: pInfo.color,
          fontSize: 10,
          fontWeight: 600,
        }}
      >
        {pInfo.label}
      </span>

      {/* Estimated time */}
      {task.estimatedMinutes > 0 && (
        <span className="tb-mono text-xs flex-shrink-0" style={{ color: "#525675" }}>
          {task.estimatedMinutes >= 60
            ? `${Math.floor(task.estimatedMinutes / 60)}h${task.estimatedMinutes % 60 > 0 ? `${task.estimatedMinutes % 60}m` : ""}`
            : `${task.estimatedMinutes}m`
          }
        </span>
      )}

      {/* Time spent */}
      {task.totalTimeSpent > 0 && (
        <span className="tb-mono text-xs flex-shrink-0" style={{ color: "#8B8FA8" }}>
          {formatTime(task.totalTimeSpent)}
        </span>
      )}

      {/* Timer button */}
      {onStartTimer && !isDone && (
        <button
          onClick={onStartTimer}
          className="flex-shrink-0 p-1 rounded transition-colors"
          style={{ color: "#4F7FFF" }}
          title="开始计时"
        >
          <Play size={12} fill="#4F7FFF" />
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: "#525675" }}
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}
