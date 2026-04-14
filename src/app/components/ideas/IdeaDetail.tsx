import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Star,
  Clock,
  Plus,
  Mountain,
  ListTodo,
  CheckCircle2,
  Rocket,
  Archive,
  Trash2,
  ClipboardList,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useApp,
  getIdeaCategoryInfo,
  type Idea,
} from "../../context/AppContext";
import { MilestoneSection } from "./MilestoneSection";
import { TaskItem } from "./TaskItem";
import { EvaluationSheet } from "./EvaluationSheet";

function formatTime(seconds: number) {
  if (seconds === 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`;
  return `${m}m`;
}

export function IdeaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    ideas,
    milestones,
    ideaTasks,
    addMilestone,
    addIdeaTask,
    completeIdeaTask,
    deleteIdeaTaskFn,
    startIdeaTimer,
    promoteIdea,
    archiveIdea,
    completeIdea,
    deleteIdeaFn,
  } = useApp();

  const idea = ideas.find((i) => i.id === id);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  if (!idea) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "#525675" }}>
        <ClipboardList size={40} />
        <p style={{ fontSize: 14 }}>点子不存在或已被删除</p>
        <button
          onClick={() => navigate("/ideas")}
          className="px-4 py-2 rounded-lg text-sm"
          style={{ background: "#252836", color: "#8B8FA8" }}
        >
          返回点子列表
        </button>
      </div>
    );
  }

  const cat = getIdeaCategoryInfo(idea.category);
  const ideaMilestones = milestones
    .filter((m) => m.ideaId === idea.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const ideaTasksAll = ideaTasks.filter((t) => t.ideaId === idea.id);
  const flatTasks = ideaTasksAll.filter((t) => !t.milestoneId);

  const totalTasks = ideaTasksAll.length;
  const doneTasks = ideaTasksAll.filter((t) => t.status === "completed").length;
  const progress = totalTasks > 0 ? doneTasks / totalTasks : 0;

  // 聚合时间（优先用 idea.totalTimeSpent，因为 endTask 回写的是 idea 层面的）
  const totalTime = idea.totalTimeSpent || ideaTasksAll.reduce((s, t) => s + t.totalTimeSpent, 0);
  const estimateHours = idea.evaluation.timeEstimate;
  const estimateSeconds = estimateHours ? estimateHours * 3600 : 0;
  const timeProgress = estimateSeconds > 0 ? Math.min(totalTime / estimateSeconds, 1) : 0;

  const stageLabels: Record<string, { text: string; color: string; bg: string }> = {
    inbox: { text: "收件箱", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    evaluated: { text: "已评估", color: "#A855F7", bg: "rgba(168,85,247,0.12)" },
    active: { text: "进行中", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
    completed: { text: "已完成", color: "#4F7FFF", bg: "rgba(79,127,255,0.12)" },
    archived: { text: "已归档", color: "#525675", bg: "rgba(82,86,117,0.12)" },
  };
  const stageInfo = stageLabels[idea.stage] || stageLabels.inbox;

  function handleAddMilestone() {
    if (!newMilestoneTitle.trim()) return;
    addMilestone(idea.id, { title: newMilestoneTitle.trim() });
    setNewMilestoneTitle("");
    setShowAddMilestone(false);
  }

  function handleAddFlatTask() {
    if (!newTaskTitle.trim()) return;
    addIdeaTask(idea.id, null, { title: newTaskTitle.trim() });
    setNewTaskTitle("");
    setShowAddTask(false);
  }

  function handleDelete() {
    deleteIdeaFn(idea.id);
    navigate("/ideas");
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 pb-28">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate("/ideas")}
            className="flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ width: 34, height: 34, background: "#252836", color: "#8B8FA8" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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
              {idea.evaluation.score !== null && (
                <span className="flex items-center gap-0.5 text-xs tb-mono" style={{ color: "#F59E0B" }}>
                  <Star size={10} fill="#F59E0B" />
                  {idea.evaluation.score.toFixed(1)}
                </span>
              )}
            </div>
            <h1 className="truncate" style={{ fontSize: 17, fontWeight: 700, color: "#E8EAF0" }}>
              {idea.title}
            </h1>
          </div>
        </div>

        {/* ── Description ────────────────────────────────────── */}
        {idea.description && (
          <p className="mb-4" style={{ fontSize: 13, color: "#8B8FA8", lineHeight: 1.6 }}>
            {idea.description}
          </p>
        )}

        {/* ── Stats bar ──────────────────────────────────────── */}
        <div
          className="rounded-xl p-3 mb-5"
          style={{ background: "#161820", border: "1px solid #252836" }}
        >
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Clock size={12} style={{ color: "#8B8FA8" }} />
              <span className="tb-mono text-xs" style={{ color: "#E8EAF0" }}>
                {formatTime(totalTime)}
              </span>
              {estimateSeconds > 0 ? (
                <span style={{ fontSize: 10, color: "#525675" }}>
                  / {estimateHours}h ({Math.round(timeProgress * 100)}%)
                </span>
              ) : (
                <span style={{ fontSize: 10, color: "#525675" }}>已投入</span>
              )}
            </div>
            {totalTasks > 0 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={12} style={{ color: "#10B981" }} />
                <span className="tb-mono text-xs" style={{ color: "#E8EAF0" }}>
                  {doneTasks}/{totalTasks}
                </span>
                <span style={{ fontSize: 10, color: "#525675" }}>任务</span>
              </div>
            )}
            {totalTasks > 0 && (
              <span className="tb-mono text-xs" style={{ color: cat.color }}>
                {Math.round(progress * 100)}%
              </span>
            )}
          </div>
          {/* Time progress bar */}
          {estimateSeconds > 0 && (
            <div className="rounded-full overflow-hidden mb-1.5" style={{ height: 3, background: "#252836" }}>
              <div
                className="rounded-full"
                style={{
                  height: "100%",
                  width: `${timeProgress * 100}%`,
                  background: timeProgress >= 1
                    ? "linear-gradient(90deg, #F59E0B88, #F59E0B)"
                    : "linear-gradient(90deg, #A855F788, #A855F7)",
                  boxShadow: `0 0 6px ${timeProgress >= 1 ? "#F59E0B33" : "#A855F733"}`,
                  transition: "width 0.3s",
                }}
              />
            </div>
          )}
          {/* Task progress bar */}
          {totalTasks > 0 && (
            <div className="rounded-full overflow-hidden" style={{ height: 3, background: "#252836" }}>
              <div
                className="rounded-full"
                style={{
                  height: "100%",
                  width: `${progress * 100}%`,
                  background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})`,
                  boxShadow: `0 0 6px ${cat.color}33`,
                  transition: "width 0.3s",
                }}
              />
            </div>
          )}
        </div>

        {/* ── Action buttons (stage-dependent) ───────────────── */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(idea.stage === "inbox" || idea.stage === "evaluated") && (
            <button
              onClick={() => setShowEvaluation(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(168, 85, 247, 0.12)",
                color: "#A855F7",
                border: "1px solid rgba(168, 85, 247, 0.2)",
              }}
            >
              <Star size={12} />
              {idea.stage === "inbox" ? "评估" : "重新评估"}
            </button>
          )}
          {idea.stage === "evaluated" && (
            <button
              onClick={() => promoteIdea(idea.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(79,127,255,0.15), rgba(168,85,247,0.15))",
                color: "#4F7FFF",
                border: "1px solid rgba(79,127,255,0.2)",
              }}
            >
              <Rocket size={12} />
              立项
            </button>
          )}
          {idea.stage === "active" && (
            <button
              onClick={() => { completeIdea(idea.id); navigate("/ideas"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(16, 185, 129, 0.12)",
                color: "#10B981",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              <CheckCircle2 size={12} />
              标记完成
            </button>
          )}
          {idea.stage !== "archived" && idea.stage !== "completed" && (
            <button
              onClick={() => { archiveIdea(idea.id); navigate("/ideas"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: "#252836", color: "#8B8FA8" }}
            >
              <Archive size={12} />
              归档
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(239, 68, 68, 0.08)", color: "#EF4444", border: "1px solid rgba(239, 68, 68, 0.12)" }}
          >
            <Trash2 size={12} />
            删除
          </button>
        </div>

        {/* ── Milestones ─────────────────────────────────────── */}
        {ideaMilestones.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Mountain size={14} style={{ color: "#A855F7" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>里程碑</span>
              <span className="tb-mono text-xs" style={{ color: "#525675" }}>
                ({ideaMilestones.length})
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {ideaMilestones.map((ms) => (
                <MilestoneSection
                  key={ms.id}
                  milestone={ms}
                  tasks={ideaTasksAll.filter((t) => t.milestoneId === ms.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Flat tasks (no milestone) ──────────────────────── */}
        {flatTasks.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <ListTodo size={14} style={{ color: "#4F7FFF" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>任务</span>
              <span className="tb-mono text-xs" style={{ color: "#525675" }}>
                ({flatTasks.filter((t) => t.status === "completed").length}/{flatTasks.length})
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <AnimatePresence>
                {flatTasks
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => completeIdeaTask(task.id)}
                      onDelete={() => deleteIdeaTaskFn(task.id)}
                      onStartTimer={() => startIdeaTimer(task.id)}
                    />
                  ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────── */}
        {ideaMilestones.length === 0 && flatTasks.length === 0 && (
          <div
            className="rounded-xl p-6 text-center mb-5"
            style={{
              background: "radial-gradient(ellipse at center, rgba(79,127,255,0.04) 0%, transparent 70%)",
              border: "1px solid #1A1D29",
            }}
          >
            <ListTodo size={32} style={{ color: "#525675", margin: "0 auto 8px", filter: "drop-shadow(0 0 4px rgba(82,86,117,0.3))" }} />
            <p style={{ fontSize: 13, color: "#525675" }}>还没有里程碑和任务</p>
            <p style={{ fontSize: 11, color: "#3A3D52", marginTop: 2 }}>点击下方按钮开始规划</p>
          </div>
        )}

        {/* ── Add buttons ────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Add milestone inline form */}
          <AnimatePresence>
            {showAddMilestone && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-xl p-3 flex items-center gap-2"
                  style={{ background: "#161820", border: "1px solid #252836" }}
                >
                  <Mountain size={14} style={{ color: "#A855F7" }} />
                  <input
                    autoFocus
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddMilestone();
                      if (e.key === "Escape") { setShowAddMilestone(false); setNewMilestoneTitle(""); }
                    }}
                    placeholder="里程碑名称..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: "#E8EAF0" }}
                  />
                  <button
                    onClick={handleAddMilestone}
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: newMilestoneTitle.trim() ? "rgba(168, 85, 247, 0.12)" : "transparent",
                      color: newMilestoneTitle.trim() ? "#A855F7" : "#525675",
                    }}
                  >
                    添加
                  </button>
                  <button
                    onClick={() => { setShowAddMilestone(false); setNewMilestoneTitle(""); }}
                    className="px-2 py-1 text-xs"
                    style={{ color: "#525675" }}
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add task inline form */}
          <AnimatePresence>
            {showAddTask && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-xl p-3 flex items-center gap-2"
                  style={{ background: "#161820", border: "1px solid #252836" }}
                >
                  <ListTodo size={14} style={{ color: "#4F7FFF" }} />
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddFlatTask();
                      if (e.key === "Escape") { setShowAddTask(false); setNewTaskTitle(""); }
                    }}
                    placeholder="任务名称..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: "#E8EAF0" }}
                  />
                  <button
                    onClick={handleAddFlatTask}
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: newTaskTitle.trim() ? "rgba(79, 127, 255, 0.12)" : "transparent",
                      color: newTaskTitle.trim() ? "#4F7FFF" : "#525675",
                    }}
                  >
                    添加
                  </button>
                  <button
                    onClick={() => { setShowAddTask(false); setNewTaskTitle(""); }}
                    className="px-2 py-1 text-xs"
                    style={{ color: "#525675" }}
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toggle buttons */}
          <div className="flex gap-2">
            {!showAddMilestone && (
              <button
                onClick={() => { setShowAddMilestone(true); setShowAddTask(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: "#161820",
                  border: "1px solid #252836",
                  color: "#A855F7",
                }}
              >
                <Plus size={12} />
                <Mountain size={12} />
                里程碑
              </button>
            )}
            {!showAddTask && (
              <button
                onClick={() => { setShowAddTask(true); setShowAddMilestone(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: "#161820",
                  border: "1px solid #252836",
                  color: "#4F7FFF",
                }}
              >
                <Plus size={12} />
                <ListTodo size={12} />
                任务
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Evaluation bottom sheet */}
      <AnimatePresence>
        {showEvaluation && (
          <EvaluationSheet
            idea={idea}
            onClose={() => setShowEvaluation(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
