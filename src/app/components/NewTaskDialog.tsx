import { useState, useRef } from "react";
import { X, Plus, Hash, Clock } from "lucide-react";
import { motion } from "motion/react";
import { useApp, CATEGORIES, EVAL_TAGS } from "../context/AppContext";

export function NewTaskDialog() {
  const { setShowNewTaskDialog, addTask, userTags, addUserTag } = useApp();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("工作");
  const [evalTag, setEvalTag] = useState<string>("必须/有意义");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | undefined>(undefined);
  const [error, setError] = useState("");
  const [useCustomStart, setUseCustomStart] = useState(false);
  // default: 30 min ago, formatted as datetime-local string
  function defaultCustomStart() {
    const d = new Date(Date.now() - 30 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const [customStartISO, setCustomStartISO] = useState(defaultCustomStart);
  function nowISO() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

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
    // 保存用户自定义标签
    tags.forEach((t) => addUserTag(t));
    addTask({
      name: name.trim(),
      description: description.trim(),
      category,
      evalTag,
      tags,
      estimatedMinutes: estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : undefined,
      startTime: useCustomStart && customStartISO ? new Date(customStartISO) : undefined,
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
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="relative rounded-t-2xl flex flex-col"
        style={{
          width: "100%",
          maxHeight: "85vh",
          background: "#161820",
          border: "1px solid #252836",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header — fixed top */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
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

        {/* Body — scrollable, min-height:0 is the key CSS fix for flex overflow */}
        <div
          className="px-5 py-4 flex-1 flex flex-col gap-4"
          style={{ overflowY: "auto", minHeight: 0, WebkitOverflowScrolling: "touch" }}
        >
          {/* Task name */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              任务名称 <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
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
            />
          </div>

          {/* 预计时间 */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              预计时间（分钟）
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                value={estimatedMinutes ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setEstimatedMinutes(v ? parseInt(v, 10) : undefined);
                }}
                placeholder="自定义"
                className="w-20 rounded-lg px-3 py-2 outline-none transition-colors"
                style={{
                  background: "#0B0D14",
                  border: "1px solid #252836",
                  color: "#E8EAF0",
                  fontSize: 14,
                }}
              />
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEstimatedMinutes(m)}
                  className="px-2.5 py-1 rounded-md transition-all text-xs"
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

          {/* 提前开始时间 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#8B8FA8" }}>
                <Clock size={13} style={{ color: "#06B6D4" }} />
                提前开始时间
              </label>
              <button
                type="button"
                onClick={() => setUseCustomStart((v) => !v)}
                className="flex items-center rounded-full transition-colors"
                style={{
                  width: 36,
                  height: 20,
                  background: useCustomStart ? "#06B6D4" : "#252836",
                  padding: 2,
                  justifyContent: useCustomStart ? "flex-end" : "flex-start",
                }}
              >
                <span
                  className="rounded-full"
                  style={{ width: 16, height: 16, background: "#fff", display: "block" }}
                />
              </button>
            </div>
            {useCustomStart && (
              <div>
                <input
                  type="datetime-local"
                  value={customStartISO}
                  max={nowISO()}
                  onChange={(e) => setCustomStartISO(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 outline-none"
                  style={{
                    background: "#0B0D14",
                    border: "1px solid #06B6D4",
                    color: "#E8EAF0",
                    fontSize: 13,
                    colorScheme: "dark",
                  }}
                />
                {customStartISO && (
                  <p style={{ fontSize: 11, color: "#06B6D4", marginTop: 4 }}>
                    已计入约 {Math.round((Date.now() - new Date(customStartISO).getTime()) / 60000)} 分钟
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 定性标签 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label style={{ fontSize: 13, color: "#8B8FA8" }}>定性标签</label>
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
              <span style={{ fontSize: 11, color: "#525675" }}>回车添加</span>
            </div>
            <div className="relative">
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
                    if (e.key === "Tab" && tagInput.trim()) {
                      const suggestions = userTags
                        .filter((ut) => ut.name.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(ut.name))
                        .sort((a, b) => b.usageCount - a.usageCount);
                      if (suggestions.length > 0) {
                        e.preventDefault();
                        setTags([...tags, suggestions[0].name]);
                        setTagInput("");
                      }
                    }
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
              {/* Autocomplete dropdown */}
              {tagInput.trim() && (() => {
                const suggestions = userTags
                  .filter((ut) => ut.name.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(ut.name))
                  .sort((a, b) => b.usageCount - a.usageCount)
                  .slice(0, 5);
                if (suggestions.length === 0) return null;
                return (
                  <div
                    className="absolute left-0 right-0 rounded-lg overflow-hidden z-10"
                    style={{
                      top: "100%",
                      marginTop: 4,
                      background: "#1A1D29",
                      border: "1px solid #252836",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    {suggestions.map((s) => (
                      <button
                        key={s.name}
                        onClick={() => {
                          setTags([...tags, s.name]);
                          setTagInput("");
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left transition-colors"
                        style={{ fontSize: 13, color: "#E8EAF0" }}
                      >
                        <Hash size={10} style={{ color: "#525675" }} />
                        <span className="flex-1">{s.name}</span>
                        <span className="tb-mono" style={{ fontSize: 10, color: "#525675" }}>
                          {s.usageCount}次
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Footer — single fixed bottom bar */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{
            borderTop: "1px solid #252836",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <button
            onClick={() => setShowNewTaskDialog(false)}
            className="px-4 py-2.5 rounded-lg transition-colors"
            style={{ background: "#252836", color: "#8B8FA8", fontSize: 14 }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Plus size={16} />
            开始计时
          </button>
        </div>
      </motion.div>
    </div>
  );
}
