import { useState } from "react";
import { X, Archive, Rocket, Star } from "lucide-react";
import { motion } from "motion/react";
import { useApp, type Idea, IDEA_CATEGORIES } from "../../context/AppContext";

export function EvaluationSheet({
  idea,
  onClose,
}: {
  idea: Idea;
  onClose: () => void;
}) {
  const { evaluateIdea, promoteIdea, archiveIdea, updateIdea } = useApp();

  const [feasibility, setFeasibility] = useState(idea.evaluation.feasibility ?? 3);
  const [necessity, setNecessity] = useState(idea.evaluation.necessity ?? 3);
  const [impact, setImpact] = useState(idea.evaluation.impact ?? 3);
  const [timeEstimate, setTimeEstimate] = useState(idea.evaluation.timeEstimate ?? 10);
  const [category, setCategory] = useState(idea.category);

  const score = Math.round(((feasibility + necessity + impact) / 3) * 10) / 10;
  const scoreLabel = score >= 4 ? "非常值得做" : score >= 3 ? "值得做" : score >= 2 ? "考虑一下" : "优先级低";
  const scoreColor = score >= 4 ? "#10B981" : score >= 3 ? "#4F7FFF" : score >= 2 ? "#F59E0B" : "#8B8FA8";

  function handleEvaluateAndPromote() {
    evaluateIdea(idea.id, { feasibility, necessity, impact, timeEstimate });
    if (category !== idea.category) {
      updateIdea(idea.id, { category });
    }
    // 直接立项
    setTimeout(() => promoteIdea(idea.id), 50);
    onClose();
  }

  function handleEvaluateAndArchive() {
    evaluateIdea(idea.id, { feasibility, necessity, impact, timeEstimate });
    setTimeout(() => archiveIdea(idea.id), 50);
    onClose();
  }

  const dimensions = [
    { label: "可行性", sub: "技术难度 + 资源", value: feasibility, setter: setFeasibility },
    { label: "必要性/紧迫度", sub: "不做会怎样?", value: necessity, setter: setNecessity },
    { label: "预期收益", sub: "论文/收入/粉丝/技能", value: impact, setter: setImpact },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "85vh",
          background: "#161820",
          border: "1px solid #252836",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid #252836" }}
        >
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#E8EAF0" }}>
              评估: {idea.title}
            </h2>
            <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 1 }}>四维打分</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 30, height: 30, background: "#252836", color: "#8B8FA8" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          className="px-5 py-4 flex flex-col gap-5 flex-1"
          style={{ overflowY: "auto", minHeight: 0 }}
        >
          {/* Category selector */}
          <div>
            <label style={{ fontSize: 12, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              分类
            </label>
            <div className="flex flex-wrap gap-2">
              {IDEA_CATEGORIES.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCategory(c.name)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: category === c.name ? c.bg : "#1A1D29",
                    color: category === c.name ? c.color : "#8B8FA8",
                    border: `1px solid ${category === c.name ? c.color + "44" : "#252836"}`,
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* 3 scoring dimensions */}
          {dimensions.map((dim) => (
            <div key={dim.label}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span style={{ fontSize: 13, color: "#E8EAF0", fontWeight: 600 }}>{dim.label}</span>
                  <span style={{ fontSize: 11, color: "#525675", marginLeft: 6 }}>{dim.sub}</span>
                </div>
                <span className="tb-mono" style={{ fontSize: 14, fontWeight: 700, color: "#4F7FFF" }}>
                  {dim.value}/5
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => dim.setter(n)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: n <= dim.value ? "rgba(79, 127, 255, 0.15)" : "#1A1D29",
                      color: n <= dim.value ? "#4F7FFF" : "#525675",
                      border: `1px solid ${n <= dim.value ? "rgba(79, 127, 255, 0.2)" : "#252836"}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Time estimate */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: "#E8EAF0", fontWeight: 600 }}>时间投入预估</span>
              <span className="tb-mono" style={{ fontSize: 14, color: "#8B8FA8" }}>
                {timeEstimate}小时
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[2, 5, 10, 20, 40, 80].map((h) => (
                <button
                  key={h}
                  onClick={() => setTimeEstimate(h)}
                  className="px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    background: timeEstimate === h ? "rgba(168, 85, 247, 0.15)" : "#1A1D29",
                    color: timeEstimate === h ? "#A855F7" : "#8B8FA8",
                    border: `1px solid ${timeEstimate === h ? "rgba(168, 85, 247, 0.2)" : "#252836"}`,
                    fontWeight: timeEstimate === h ? 600 : 400,
                  }}
                >
                  {h}h
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={timeEstimate}
                onChange={(e) => setTimeEstimate(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1.5 rounded-lg text-xs tb-mono outline-none"
                style={{ background: "#0B0D14", border: "1px solid #252836", color: "#E8EAF0" }}
              />
            </div>
          </div>

          {/* Score display */}
          <div
            className="rounded-xl p-4 text-center"
            style={{
              background: `${scoreColor}08`,
              border: `1px solid ${scoreColor}25`,
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Star size={16} style={{ color: "#F59E0B", fill: "#F59E0B" }} />
              <span className="tb-timer" style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>
                {score.toFixed(1)}
              </span>
              <span style={{ fontSize: 13, color: "#8B8FA8" }}>/5</span>
            </div>
            <p style={{ fontSize: 13, color: scoreColor, fontWeight: 600 }}>
              {scoreLabel}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-5 py-3 flex-shrink-0"
          style={{
            borderTop: "1px solid #252836",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <button
            onClick={handleEvaluateAndArchive}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5"
            style={{ background: "#252836", color: "#8B8FA8", fontSize: 14, fontWeight: 600 }}
          >
            <Archive size={14} />
            归档
          </button>
          <button
            onClick={handleEvaluateAndPromote}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5"
            style={{
              background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 2px 12px rgba(79, 127, 255, 0.25)",
            }}
          >
            <Rocket size={14} />
            立项
          </button>
        </div>
      </motion.div>
    </div>
  );
}
