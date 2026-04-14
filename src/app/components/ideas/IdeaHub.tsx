import { useState } from "react";
import { Lightbulb, Inbox, Flame, CheckCircle2, Archive, ChevronDown, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "../../context/AppContext";
import { QuickCapture } from "./QuickCapture";
import { IdeaCard } from "./IdeaCard";
import { EvaluationSheet } from "./EvaluationSheet";

export function IdeaHub() {
  const { ideas, ideaTasks, archiveIdea, deleteIdeaFn, updateIdea } = useApp();
  const [showInbox, setShowInbox] = useState(true);
  const [showActive, setShowActive] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  const inboxIdeas = ideas.filter((i) => i.stage === "inbox");
  const activeIdeas = ideas.filter((i) => i.stage === "active" || i.stage === "evaluated");
  const completedIdeas = ideas.filter((i) => i.stage === "completed");
  const archivedIdeas = ideas.filter((i) => i.stage === "archived");

  function getTasksForIdea(ideaId: string) {
    return ideaTasks.filter((t) => t.ideaId === ideaId);
  }

  const evaluatingIdea = evaluatingId ? ideas.find((i) => i.id === evaluatingId) || null : null;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="mb-4">
          <h1
            className="flex items-center gap-2"
            style={{ fontSize: 18, fontWeight: 700, color: "#E8EAF0" }}
          >
            <Lightbulb size={18} style={{ color: "#F59E0B", filter: "drop-shadow(0 0 4px rgba(245, 158, 11, 0.3))" }} />
            我的点子
          </h1>
          <p className="tb-mono" style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
            {inboxIdeas.length} 待评估 · {activeIdeas.length} 进行中 · {completedIdeas.length} 已完成
          </p>
        </div>

        {/* Quick capture */}
        <div className="mb-5">
          <QuickCapture />
        </div>

        {/* ── 收件箱 ───────────────────────────────────────────── */}
        <SectionHeader
          icon={<Inbox size={14} style={{ color: "#F59E0B" }} />}
          title="收件箱"
          count={inboxIdeas.length}
          color="#F59E0B"
          expanded={showInbox}
          onToggle={() => setShowInbox(!showInbox)}
        />
        <AnimatePresence>
          {showInbox && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 mb-4">
                <AnimatePresence>
                  {inboxIdeas.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#525675", padding: "12px 0" }}>
                      没有未评估的点子
                    </p>
                  ) : (
                    inboxIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        tasks={getTasksForIdea(idea.id)}
                        onArchive={() => archiveIdea(idea.id)}
                        onDelete={() => deleteIdeaFn(idea.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 进行中 ───────────────────────────────────────────── */}
        <SectionHeader
          icon={<Flame size={14} style={{ color: "#10B981" }} />}
          title="进行中"
          count={activeIdeas.length}
          color="#10B981"
          expanded={showActive}
          onToggle={() => setShowActive(!showActive)}
        />
        <AnimatePresence>
          {showActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 mb-4">
                <AnimatePresence>
                  {activeIdeas.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#525675", padding: "12px 0" }}>
                      还没有进行中的点子
                    </p>
                  ) : (
                    activeIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        tasks={getTasksForIdea(idea.id)}
                        onArchive={() => archiveIdea(idea.id)}
                        onDelete={() => deleteIdeaFn(idea.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 已完成 ───────────────────────────────────────────── */}
        <SectionHeader
          icon={<CheckCircle2 size={14} style={{ color: "#4F7FFF" }} />}
          title="已完成"
          count={completedIdeas.length}
          color="#4F7FFF"
          expanded={showCompleted}
          onToggle={() => setShowCompleted(!showCompleted)}
        />
        <AnimatePresence>
          {showCompleted && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 mb-4">
                <AnimatePresence>
                  {completedIdeas.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#525675", padding: "12px 0" }}>
                      还没有已完成的点子
                    </p>
                  ) : (
                    completedIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        tasks={getTasksForIdea(idea.id)}
                        onArchive={() => archiveIdea(idea.id)}
                        onDelete={() => deleteIdeaFn(idea.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 已归档 ───────────────────────────────────────────── */}
        <SectionHeader
          icon={<Archive size={14} style={{ color: "#525675" }} />}
          title="已归档"
          count={archivedIdeas.length}
          color="#525675"
          expanded={showArchived}
          onToggle={() => setShowArchived(!showArchived)}
        />
        <AnimatePresence>
          {showArchived && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 mb-4">
                <AnimatePresence>
                  {archivedIdeas.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#525675", padding: "12px 0" }}>
                      没有已归档的点子
                    </p>
                  ) : (
                    archivedIdeas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        tasks={getTasksForIdea(idea.id)}
                        onRestore={() => updateIdea(idea.id, { stage: "inbox" })}
                        onDelete={() => deleteIdeaFn(idea.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Evaluation bottom sheet */}
      <AnimatePresence>
        {evaluatingIdea && (
          <EvaluationSheet
            idea={evaluatingIdea}
            onClose={() => setEvaluatingId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  count,
  color,
  expanded,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full py-2 mb-1 transition-colors"
    >
      {icon}
      <span style={{ fontSize: 13, fontWeight: 700, color: "#E8EAF0" }}>{title}</span>
      <span className="tb-mono" style={{ fontSize: 12, color, fontWeight: 600 }}>
        ({count})
      </span>
      <div className="flex-1" />
      {expanded ? (
        <ChevronDown size={14} style={{ color: "#525675" }} />
      ) : (
        <ChevronRight size={14} style={{ color: "#525675" }} />
      )}
    </button>
  );
}
