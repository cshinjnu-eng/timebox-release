import { useState } from "react";
import { X, Plus, Hash } from "lucide-react";
import { motion } from "motion/react";
import { useApp, CATEGORIES, EVAL_TAGS } from "../context/AppContext";

export function NewTaskDialog() {
  const { setShowNewTaskDialog, addTask } = useApp();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("工作");
  const [evalTag, setEvalTag] = useState<string>("必须/有意义");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  }

  function removeTag(t: string) {
    setTags(tags.filter((x) => x !== t));
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("请输入任务名称");
      return;
    }
    addTask({
      name: name.trim(),
      description: description.trim(),
      category,
      evalTag,
      tags,
      estimatedMinutes: estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : undefined,
    });
    setShowNewTaskDialog(false);
  }

  const selectedCat = CATEGORIES.find((c) => c.name === category)!;
  const selectedEval = EVAL_TAGS.find((e) => e.label === evalTag)!;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowNewTaskDialog(false);
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative rounded-t-2xl flex flex-col"
        style={{
          width: "100%",
          maxHeight: "90vh",
          background: "#161820",
          border: "1px solid #252836",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #252836" }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0" }}>新建计时任务</h2>
            <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 2 }}>开始后将自动计时</p>
          </div>
          <button
            onClick={() => setShowNewTaskDialog(false)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 30, height: 30, background: "#252836", color: "#8B8FA8" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Task name */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              任务名称 <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="输入任务名称..."
              className="w-full rounded-lg px-3 py-2.5 outline-none transition-colors"
              style={{
                background: "#0B0D14",
                border: `1px solid ${error ? "#EF4444" : "#252836"}`,
                color: "#E8EAF0",
                fontSize: 14,
              }}
              onFocus={(e) => (e.target.style.borderColor = "#4F7FFF")}
              onBlur={(e) => (e.target.style.borderColor = error ? "#EF4444" : "#252836")}
            />
            {error && (
              <p style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>{error}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              任务描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加任务描述（可选）..."
              rows={2}
              className="w-full rounded-lg px-3 py-2.5 outline-none resize-none transition-colors"
              style={{
                background: "#0B0D14",
                border: "1px solid #252836",
                color: "#E8EAF0",
                fontSize: 14,
              }}
              onFocus={(e) => (e.target.style.borderColor = "#4F7FFF")}
              onBlur={(e) => (e.target.style.borderColor = "#252836")}
            />
          </div>

          {/* 预计时间 */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              预计时间（分钟）
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={estimatedMinutes ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setEstimatedMinutes(v ? parseInt(v, 10) : undefined);
                }}
                placeholder="输入预计时间..."
                className="w-24 rounded-lg px-3 py-2.5 outline-none transition-colors"
                style={{
                  background: "#0B0D14",
                  border: "1px solid #252836",
                  color: "#E8EAF0",
                  fontSize: 14,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#4F7FFF")}
                onBlur={(e) => (e.target.style.borderColor = "#252836")}
              />
              <div className="flex flex-wrap gap-1.5">
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEstimatedMinutes(m)}
                    className="px-2 py-1 rounded-md transition-all text-xs"
                    style={{
                      background: estimatedMinutes === m ? "rgba(79,127,255,0.15)" : "#1A1D29",
                      border: `1px solid ${estimatedMinutes === m ? "#4F7FFF" : "#252836"}`,
                      color: estimatedMinutes === m ? "#4F7FFF" : "#8B8FA8",
                      fontWeight: estimatedMinutes === m ? 600 : 400,
                    }}
                  >
                    {m >= 60 ? `${m / 60}h` : `${m}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 定性标签 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label style={{ fontSize: 13, color: "#8B8FA8" }}>定性标签</label>
              <span style={{ fontSize: 11, color: "#525675" }}>五选一</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: category === cat.name ? cat.bg : "#1A1D29",
                    border: `1.5px solid ${category === cat.name ? cat.color : "#252836"}`,
                    color: category === cat.name ? cat.color : "#8B8FA8",
                    fontSize: 13,
                    fontWeight: category === cat.name ? 600 : 400,
                  }}
                >
                  <span
                    className="rounded-full inline-block"
                    style={{ width: 7, height: 7, background: category === cat.name ? cat.color : "#525675" }}
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 评估标签 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label style={{ fontSize: 13, color: "#8B8FA8" }}>评估标签</label>
              <span style={{ fontSize: 11, color: "#525675" }}>四选一</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EVAL_TAGS.map((et) => (
                <button
                  key={et.label}
                  onClick={() => setEvalTag(et.label)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
                  style={{
                    background: evalTag === et.label ? et.bg : "#1A1D29",
                    border: `1.5px solid ${evalTag === et.label ? et.color : "#252836"}`,
                    color: evalTag === et.label ? et.color : "#8B8FA8",
                    fontSize: 13,
                    fontWeight: evalTag === et.label ? 600 : 400,
                  }}
                >
                  <span
                    className="rounded-sm inline-block flex-shrink-0"
                    style={{
                      width: 8,
                      height: 8,
                      background: evalTag === et.label ? et.color : "#525675",
                    }}
                  />
                  {et.label}
                </button>
              ))}
            </div>
          </div>

          {/* 自定义标签 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label style={{ fontSize: 13, color: "#8B8FA8" }}>自定义标签</label>
              <span style={{ fontSize: 11, color: "#525675" }}>多选，回车添加</span>
            </div>
            <div
              className="flex items-center flex-wrap gap-1.5 px-3 py-2 rounded-lg min-h-10"
              style={{ background: "#0B0D14", border: "1px solid #252836" }}
            >
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                  style={{ background: "#252836", color: "#A0A3B8", fontSize: 12 }}
                >
                  <Hash size={10} style={{ color: "#525675" }} />
                  {t}
                  <button
                    onClick={() => removeTag(t)}
                    style={{ color: "#8B8FA8", lineHeight: 1, marginLeft: 2 }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder={tags.length === 0 ? "输入标签后按 Enter..." : ""}
                className="outline-none flex-1 min-w-16 bg-transparent"
                style={{ color: "#E8EAF0", fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: "1px solid #252836" }}
        >
          {/* Tag preview */}
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-md"
              style={{ background: selectedCat.bg, color: selectedCat.color, fontSize: 12, fontWeight: 600 }}
            >
              {selectedCat.name}
            </span>
            <span
              className="px-2 py-0.5 rounded-md"
              style={{ background: selectedEval.bg, color: selectedEval.color, fontSize: 12 }}
            >
              {selectedEval.label}
            </span>
            {estimatedMinutes && estimatedMinutes > 0 && (
              <span
                className="px-2 py-0.5 rounded-md"
                style={{ background: "rgba(6,182,212,0.12)", color: "#06B6D4", fontSize: 12 }}
              >
                ≈{estimatedMinutes >= 60 ? `${Math.floor(estimatedMinutes / 60)}h${estimatedMinutes % 60 > 0 ? `${estimatedMinutes % 60}m` : ""}` : `${estimatedMinutes}m`}
              </span>
            )}
          </div>
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{
            borderTop: "1px solid #252836",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
            <button
              onClick={() => setShowNewTaskDialog(false)}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{ background: "#252836", color: "#8B8FA8", fontSize: 13 }}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <Plus size={15} />
              开始计时
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
