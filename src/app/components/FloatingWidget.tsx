import { useState, useRef, useCallback, useEffect } from "react";
import {
  Pause,
  Play,
  Square,
  ChevronDown,
  ChevronUp,
  X,
  GripHorizontal,
  Timer,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  useApp,
  formatElapsed,
  getCategoryInfo,
  Task,
} from "../context/AppContext";

function MiniTimerRow({ task }: { task: Task }) {
  const { toggleTimer, setTaskToEnd, setShowEndTaskDialog } = useApp();
  const cat = getCategoryInfo(task.category);

  function handleStop() {
    setTaskToEnd(task);
    setShowEndTaskDialog(true);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: cat.color }}
      />
      <span
        className="flex-1 truncate"
        style={{ fontSize: 12, color: "#C4C8E0", maxWidth: 110 }}
      >
        {task.name}
      </span>
      <span
        style={{
          fontSize: 12,
          fontFamily: "monospace",
          color: task.isRunning ? "#E8EAF0" : "#8B8FA8",
          letterSpacing: "0.03em",
          minWidth: 60,
          textAlign: "right",
        }}
      >
        {formatElapsed(task.elapsed)}
      </span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => toggleTimer(task.id)}
          className="flex items-center justify-center rounded"
          style={{
            width: 20,
            height: 20,
            background: task.isRunning ? "rgba(79,127,255,0.2)" : "rgba(16,185,129,0.2)",
            color: task.isRunning ? "#4F7FFF" : "#10B981",
          }}
        >
          {task.isRunning ? <Pause size={10} /> : <Play size={10} />}
        </button>
        <button
          onClick={handleStop}
          className="flex items-center justify-center rounded"
          style={{
            width: 20,
            height: 20,
            background: "rgba(239,68,68,0.15)",
            color: "#EF4444",
          }}
        >
          <Square size={9} />
        </button>
      </div>
    </div>
  );
}

export function FloatingWidget() {
  const { tasks, setShowFloatingWidget, setShowNewTaskDialog } = useApp();
  const [expanded, setExpanded] = useState(true);
  const [pos, setPos] = useState({ x: window.innerWidth - 270, y: 80 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const runningTasks = tasks.filter((t) => t.isRunning);
  const totalElapsed = tasks.reduce((s, t) => s + t.elapsed, 0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragging.current = true;
    dragOffset.current = { x: touch.clientX - pos.x, y: touch.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 260, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
      });
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 260, touch.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, touch.clientY - dragOffset.current.y)),
      });
    }
    function onUp() {
      dragging.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-40 select-none"
      style={{ left: pos.x, top: pos.y, width: 250 }}
    >
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(22,24,32,0.95)",
          border: "1px solid #2A2D3A",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,127,255,0.1)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Header (draggable) */}
        <div
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          className="flex items-center justify-between px-3 py-2.5 cursor-grab active:cursor-grabbing"
          style={{ borderBottom: expanded ? "1px solid #252836" : "none" }}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal size={13} style={{ color: "#525675" }} />
            <Timer size={13} style={{ color: "#4F7FFF" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#C4C8E0" }}>
              并行计时
            </span>
            {runningTasks.length > 0 && (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", fontSize: 10, color: "#10B981" }}
              >
                <span
                  className="rounded-full inline-block"
                  style={{ width: 5, height: 5, background: "#10B981" }}
                />
                {runningTasks.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center rounded"
              style={{ width: 20, height: 20, color: "#8B8FA8" }}
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <button
              onClick={() => setShowFloatingWidget(false)}
              className="flex items-center justify-center rounded"
              style={{ width: 20, height: 20, color: "#8B8FA8" }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}
            >
              {tasks.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-5"
                  style={{ color: "#525675" }}
                >
                  <Timer size={20} style={{ marginBottom: 6, opacity: 0.5 }} />
                  <p style={{ fontSize: 11 }}>暂无计时任务</p>
                </div>
              ) : (
                <div className="py-1">
                  {tasks.map((task) => (
                    <MiniTimerRow key={task.id} task={task} />
                  ))}
                </div>
              )}

              {/* Footer */}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderTop: "1px solid #252836" }}
              >
                <div>
                  <p style={{ fontSize: 10, color: "#8B8FA8" }}>今日总计</p>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: "monospace",
                      color: "#4F7FFF",
                    }}
                  >
                    {formatElapsed(totalElapsed)}
                  </p>
                </div>
                <button
                  onClick={() => setShowNewTaskDialog(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80"
                  style={{
                    background: "rgba(79,127,255,0.15)",
                    color: "#4F7FFF",
                    fontWeight: 600,
                  }}
                >
                  <Plus size={11} />
                  新建
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
