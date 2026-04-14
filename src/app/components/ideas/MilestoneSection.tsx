import { useState } from "react";
import { ChevronDown, ChevronRight, Mountain, Plus, CheckCircle2, Clock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useApp, type Milestone, type IdeaTask } from "../../context/AppContext";
import { TaskItem } from "./TaskItem";

function formatTime(seconds: number) {
  if (seconds === 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  return `${m}m`;
}

const statusInfo: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: { icon: null, color: "#8B8FA8" },
  in_progress: { icon: null, color: "#F59E0B" },
  completed: { icon: <CheckCircle2 size={12} style={{ color: "#10B981" }} />, color: "#10B981" },
};

export function MilestoneSection({
  milestone,
  tasks,
}: {
  milestone: Milestone;
  tasks: IdeaTask[];
}) {
  const { addIdeaTask, completeIdeaTask, deleteIdeaTaskFn, updateMilestone, startIdeaTimer } = useApp();
  const [expanded, setExpanded] = useState(milestone.status !== "completed");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const doneTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const sInfo = statusInfo[milestone.status] || statusInfo.pending;

  // 聚合时间
  const totalTime = tasks.reduce((s, t) => s + t.totalTimeSpent, 0);

  function handleAddTask() {
    if (!newTaskTitle.trim()) return;
    addIdeaTask(milestone.ideaId, milestone.id, { title: newTaskTitle.trim() });
    setNewTaskTitle("");
  }

  // 自动更新里程碑状态
  function checkMilestoneCompletion() {
    const allDone = tasks.length > 0 && tasks.every((t) => t.status === "completed");
    if (allDone && milestone.status !== "completed") {
      updateMilestone(milestone.id, { status: "completed", completedAt: new Date().toISOString() });
    } else if (!allDone && milestone.status === "completed") {
      updateMilestone(milestone.id, { status: "in_progress", completedAt: null });
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "#161820",
        border: `1px solid ${milestone.status === "completed" ? "rgba(16, 185, 129, 0.15)" : "#252836"}`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full px-4 py-3 transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} style={{ color: "#525675" }} />
        ) : (
          <ChevronRight size={14} style={{ color: "#525675" }} />
        )}
        <Mountain size={14} style={{ color: sInfo.color }} />
        <span className="flex-1 text-left truncate" style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>
          {milestone.title}
        </span>
        {sInfo.icon}
        {totalTasks > 0 && (
          <span className="tb-mono text-xs" style={{ color: "#8B8FA8" }}>
            {doneTasks}/{totalTasks}
          </span>
        )}
        {totalTime > 0 && (
          <span className="flex items-center gap-1 tb-mono text-xs" style={{ color: "#525675" }}>
            <Clock size={10} />
            {formatTime(totalTime)}
          </span>
        )}
      </button>

      {/* Tasks list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3" style={{ borderTop: "1px solid #1A1D29" }}>
              {/* Progress bar */}
              {totalTasks > 0 && (
                <div className="rounded-full overflow-hidden mt-2 mb-3" style={{ height: 2, background: "#252836" }}>
                  <div
                    className="rounded-full"
                    style={{
                      height: "100%",
                      width: `${(doneTasks / totalTasks) * 100}%`,
                      background: "linear-gradient(90deg, #10B98188, #10B981)",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              )}

              {/* Task items */}
              <div className="flex flex-col gap-1.5">
                <AnimatePresence>
                  {tasks
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => {
                          completeIdeaTask(task.id);
                          setTimeout(checkMilestoneCompletion, 100);
                        }}
                        onDelete={() => deleteIdeaTaskFn(task.id)}
                        onStartTimer={() => startIdeaTimer(task.id)}
                      />
                    ))}
                </AnimatePresence>
              </div>

              {/* Add task input */}
              <div className="flex items-center gap-2 mt-3">
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTask(); }}
                  placeholder="添加子任务..."
                  className="flex-1 px-3 py-1.5 rounded-lg outline-none text-sm"
                  style={{ background: "#0B0D14", border: "1px solid #252836", color: "#E8EAF0" }}
                />
                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                  style={{
                    background: newTaskTitle.trim() ? "rgba(79, 127, 255, 0.12)" : "transparent",
                    color: newTaskTitle.trim() ? "#4F7FFF" : "#525675",
                  }}
                >
                  <Plus size={12} />
                  添加
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
