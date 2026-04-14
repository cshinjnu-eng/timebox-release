import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Star, Clock, ChevronRight, Archive, RotateCcw, Trash2, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type Idea, type IdeaTask, getIdeaCategoryInfo } from "../../context/AppContext";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function formatTimeSpent(seconds: number) {
  if (seconds === 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  return `${m}m`;
}

export function IdeaCard({
  idea,
  tasks,
  onArchive,
  onRestore,
  onDelete,
}: {
  idea: Idea;
  tasks: IdeaTask[];
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const cat = getIdeaCategoryInfo(idea.category);
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "completed").length;
  const progress = totalTasks > 0 ? doneTasks / totalTasks : 0;
  const hasScore = idea.evaluation.score !== null;

  const stageLabels: Record<string, { text: string; color: string; bg: string }> = {
    inbox: { text: "收件箱", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    evaluated: { text: "已评估", color: "#A855F7", bg: "rgba(168,85,247,0.12)" },
    active: { text: "进行中", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
    completed: { text: "已完成", color: "#4F7FFF", bg: "rgba(79,127,255,0.12)" },
    archived: { text: "已归档", color: "#525675", bg: "rgba(82,86,117,0.12)" },
  };
  const stageInfo = stageLabels[idea.stage] || stageLabels.inbox;

  function handlePointerDown() {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowMenu(true);
    }, 500);
  }

  function handlePointerUp() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleClick() {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    navigate(`/ideas/${idea.id}`);
  }

  const hasActions = onArchive || onRestore || onDelete;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="relative rounded-xl overflow-hidden cursor-pointer group"
        style={{
          background: "#161820",
          border: `1px solid ${showMenu ? "#4F7FFF33" : "#252836"}`,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.02)",
          transition: "border-color 0.2s",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
      >
        {/* Left color bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
          style={{ background: cat.color }}
        />

        <div className="pl-4 pr-3 py-3">
          {/* Top row: title + badges */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{ background: cat.bg, color: cat.color }}
                >
                  {idea.category}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-xs"
                  style={{ background: stageInfo.bg, color: stageInfo.color }}
                >
                  {stageInfo.text}
                </span>
                {hasScore && (
                  <span className="flex items-center gap-0.5 text-xs tb-mono" style={{ color: "#F59E0B" }}>
                    <Star size={10} fill="#F59E0B" />
                    {idea.evaluation.score!.toFixed(1)}
                  </span>
                )}
              </div>
              <h3 className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0" }}>
                {idea.title}
              </h3>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Menu trigger — always visible on this side */}
              {hasActions && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="p-1 rounded-md transition-opacity"
                  style={{ color: "#525675", opacity: showMenu ? 1 : 0.5 }}
                >
                  <MoreVertical size={14} />
                </button>
              )}
              <ChevronRight size={14} style={{ color: "#525675" }} />
            </div>
          </div>

          {/* Bottom row: progress + time */}
          {(idea.stage === "active" || idea.stage === "evaluated") && (
            <div className="flex items-center gap-3 mt-2">
              {totalTasks > 0 && (
                <>
                  <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: "#252836" }}>
                    <div
                      className="rounded-full"
                      style={{
                        height: "100%",
                        width: `${progress * 100}%`,
                        background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})`,
                        boxShadow: `0 0 4px ${cat.color}44`,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <span className="tb-mono text-xs flex-shrink-0" style={{ color: "#8B8FA8" }}>
                    {doneTasks}/{totalTasks}
                  </span>
                </>
              )}
              {idea.totalTimeSpent > 0 && (
                <span className="flex items-center gap-1 tb-mono text-xs flex-shrink-0" style={{ color: "#8B8FA8" }}>
                  <Clock size={10} />
                  {formatTimeSpent(idea.totalTimeSpent)}
                </span>
              )}
            </div>
          )}

          {/* Inbox: show time ago */}
          {idea.stage === "inbox" && (
            <p className="mt-1" style={{ fontSize: 11, color: "#525675" }}>
              {timeAgo(idea.createdAt)}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Action menu overlay ──────────────────────────────── */}
      <AnimatePresence>
        {showMenu && (
          <div
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setShowMenu(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute left-4 right-4 bottom-0 rounded-t-2xl overflow-hidden"
              style={{
                background: "#1A1D29",
                border: "1px solid #252836",
                boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
                paddingBottom: "max(12px, env(safe-area-inset-bottom))",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title */}
              <div className="px-4 py-3" style={{ borderBottom: "1px solid #252836" }}>
                <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>
                  {idea.title}
                </p>
                <p style={{ fontSize: 11, color: "#525675", marginTop: 1 }}>
                  选择操作
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col">
                {onArchive && (
                  <button
                    onClick={() => { onArchive(); setShowMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{ color: "#8B8FA8" }}
                  >
                    <Archive size={16} />
                    <span style={{ fontSize: 14 }}>归档</span>
                  </button>
                )}
                {onRestore && (
                  <button
                    onClick={() => { onRestore(); setShowMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{ color: "#10B981" }}
                  >
                    <RotateCcw size={16} />
                    <span style={{ fontSize: 14 }}>恢复到收件箱</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{ color: "#EF4444" }}
                  >
                    <Trash2 size={16} />
                    <span style={{ fontSize: 14 }}>删除</span>
                  </button>
                )}
              </div>

              {/* Cancel */}
              <div style={{ borderTop: "1px solid #252836" }}>
                <button
                  onClick={() => setShowMenu(false)}
                  className="flex items-center justify-center w-full py-3"
                  style={{ fontSize: 14, color: "#525675" }}
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
