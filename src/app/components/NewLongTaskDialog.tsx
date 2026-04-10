import { useState } from "react";
import { X, Layers, Hash, Clock } from "lucide-react";
import { motion } from "motion/react";
import { useApp, CATEGORIES, EVAL_TAGS } from "../context/AppContext";

function pad(n: number) { return String(n).padStart(2, "0"); }
function nowISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultStart() {
  const d = new Date(Date.now() - 30 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewLongTaskDialog() {
  const { setShowNewLongTaskDialog, addLongTask } = useApp();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("工作");
  const [evalTag, setEvalTag] = useState<string>("必须/有意义");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [useCustomStart, setUseCustomStart] = useState(false);
  const [customStartISO, setCustomStartISO] = useState(defaultStart);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  function handleSubmit() {
    if (!name.trim()) { setError("请输入任务名称"); return; }
    addLongTask({
      name: name.trim(),
      description: description.trim(),
      category,
      evalTag,
      tags,
      startTime: useCustomStart && customStartISO ? new Date(customStartISO) : undefined,
    });
    setShowNewLongTaskDialog(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowNewLongTaskDialog(false); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        className="relative rounded-t-2xl flex flex-col"
        style={{ width: "100%", maxHeight: "85vh", background: "#161820", border: "1px solid #252836", boxShadow: "0 -12px 40px rgba(0,0,0,0.5)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: "1px solid #252836" }}>
          <div>
            <h2 className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0" }}>
              <Layers size={16} style={{ color: "#A855F7" }} />
              新建长线任务
            </h2>
            <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 2 }}>持续挂载，子打点记录进度</p>
          </div>
          <button onClick={() => setShowNewLongTaskDialog(false)} className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: "#252836", color: "#8B8FA8" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex-1 flex flex-col gap-4" style={{ overflowY: "auto", minHeight: 0 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>任务名称 <span style={{ color: "#EF4444" }}>*</span></label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="例如：写论文、跑代码、写设计稿"
              className="w-full rounded-lg px-3 py-2.5 outline-none"
              style={{ background: "#0B0D14", border: `1px solid ${error ? "#EF4444" : "#252836"}`, color: "#E8EAF0", fontSize: 14 }}
            />
            {error && <p style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>任务描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这个任务要完成什么？（可选）"
              rows={2}
              className="w-full rounded-lg px-3 py-2.5 outline-none resize-none"
              style={{ background: "#0B0D14", border: "1px solid #252836", color: "#E8EAF0", fontSize: 14 }}
            />
          </div>

          {/* Custom start time */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5" style={{ fontSize: 13, color: "#8B8FA8" }}>
                <Clock size={13} style={{ color: "#06B6D4" }} />
                提前开始时间
              </label>
              <button
                type="button"
                onClick={() => setUseCustomStart(v => !v)}
                className="flex items-center rounded-full transition-colors"
                style={{ width: 36, height: 20, background: useCustomStart ? "#06B6D4" : "#252836", padding: 2, justifyContent: useCustomStart ? "flex-end" : "flex-start" }}
              >
                <span className="rounded-full" style={{ width: 16, height: 16, background: "#fff", display: "block" }} />
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
                  style={{ background: "#0B0D14", border: "1px solid #06B6D4", color: "#E8EAF0", fontSize: 13, colorScheme: "dark" }}
                />
                {customStartISO && (
                  <p style={{ fontSize: 11, color: "#06B6D4", marginTop: 4 }}>
                    已计入约 {Math.round((Date.now() - new Date(customStartISO).getTime()) / 60000)} 分钟
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>定性标签</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat.name} onClick={() => setCategory(cat.name)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: category === cat.name ? cat.bg : "#1A1D29", border: `1.5px solid ${category === cat.name ? cat.color : "#252836"}`, color: category === cat.name ? cat.color : "#8B8FA8", fontSize: 13, fontWeight: category === cat.name ? 600 : 400 }}>
                  <span className="rounded-full inline-block" style={{ width: 7, height: 7, background: category === cat.name ? cat.color : "#525675" }} />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Eval Tag */}
          <div>
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>评估标签</label>
            <div className="grid grid-cols-2 gap-2">
              {EVAL_TAGS.map((et) => (
                <button key={et.label} onClick={() => setEvalTag(et.label)} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
                  style={{ background: evalTag === et.label ? et.bg : "#1A1D29", border: `1.5px solid ${evalTag === et.label ? et.color : "#252836"}`, color: evalTag === et.label ? et.color : "#8B8FA8", fontSize: 13, fontWeight: evalTag === et.label ? 600 : 400 }}>
                  <span className="rounded-sm inline-block flex-shrink-0" style={{ width: 8, height: 8, background: evalTag === et.label ? et.color : "#525675" }} />
                  {et.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label style={{ fontSize: 13, color: "#8B8FA8" }}>自定义标签</label>
              <span style={{ fontSize: 11, color: "#525675" }}>回车添加</span>
            </div>
            <div className="flex items-center flex-wrap gap-1.5 px-3 py-2 rounded-lg min-h-10" style={{ background: "#0B0D14", border: "1px solid #252836" }}>
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: "#252836", color: "#A0A3B8", fontSize: 12 }}>
                  <Hash size={10} style={{ color: "#525675" }} />
                  {t}
                  <button onClick={() => setTags(tags.filter(x => x !== t))} style={{ color: "#8B8FA8", lineHeight: 1, marginLeft: 2 }}>
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                placeholder={tags.length === 0 ? "输入标签后按 Enter..." : ""}
                className="outline-none flex-1 min-w-16 bg-transparent"
                style={{ color: "#E8EAF0", fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderTop: "1px solid #252836", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button onClick={() => setShowNewLongTaskDialog(false)} className="px-4 py-2.5 rounded-lg" style={{ background: "#252836", color: "#8B8FA8", fontSize: 14 }}>取消</button>
          <button onClick={handleSubmit} className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #A855F7, #4F7FFF)", color: "#fff", fontSize: 14, fontWeight: 600 }}>
            <Layers size={15} />
            创建长线任务
          </button>
        </div>
      </motion.div>
    </div>
  );
}
