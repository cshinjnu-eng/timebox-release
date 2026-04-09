import { useState } from "react";
import { X, Clock, Tag, MessageSquare } from "lucide-react";
import { useApp, CATEGORIES, EVAL_TAGS, getCategoryInfo } from "../context/AppContext";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalISOString(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDurationPreview(startStr: string, endStr: string): string {
  if (!startStr || !endStr) return "";
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diff = Math.max(0, end.getTime() - start.getTime());
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}分钟`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

export function ManualSessionDialog() {
  const { addManualSession, showManualSessionDialog, setShowManualSessionDialog } = useApp();

  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [evalTag, setEvalTag] = useState("");
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const [startTime, setStartTime] = useState(toLocalISOString(oneHourAgo));
  const [endTime, setEndTime] = useState(toLocalISOString(now));
  const [feeling, setFeeling] = useState("");
  const [tagInput, setTagInput] = useState("");

  if (!showManualSessionDialog) return null;

  function handleSubmit() {
    if (!name.trim()) return;
    const st = new Date(startTime);
    const et = new Date(endTime);
    if (et <= st) return;

    const tags = tagInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    addManualSession({
      name: name.trim(),
      category,
      evalTag: evalTag || undefined,
      startTime: st,
      endTime: et,
      feeling: feeling.trim() || undefined,
      tags,
    });

    // Reset
    setName("");
    setFeeling("");
    setTagInput("");
    setShowManualSessionDialog(false);
  }

  function handleClose() {
    setShowManualSessionDialog(false);
  }

  const catInfo = getCategoryInfo(category);
  const durationPreview = formatDurationPreview(startTime, endTime);

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "#12141C",
          border: "1px solid #252836",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #252836" }}
        >
          <div className="flex items-center gap-2">
            <Clock size={18} style={{ color: "#A855F7" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0" }}>
              手动记录
            </span>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5"
            style={{ color: "#8B8FA8" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ minHeight: 0 }}>
          {/* Name */}
          <div className="mb-4">
            <label style={{ fontSize: 12, color: "#8B8FA8", fontWeight: 600, marginBottom: 6, display: "block" }}>
              事项名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="你完成了什么？"
              className="w-full px-3 py-2.5 rounded-lg outline-none"
              style={{
                background: "#1A1D29",
                border: "1px solid #252836",
                color: "#E8EAF0",
                fontSize: 14,
              }}
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label style={{ fontSize: 12, color: "#8B8FA8", fontWeight: 600, marginBottom: 6, display: "block" }}>
              分类
            </label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: category === cat.name ? cat.bg : "#1A1D29",
                    color: category === cat.name ? cat.color : "#8B8FA8",
                    border: `1px solid ${category === cat.name ? cat.color + "44" : "#252836"}`,
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Eval Tag */}
          <div className="mb-4">
            <label style={{ fontSize: 12, color: "#8B8FA8", fontWeight: 600, marginBottom: 6, display: "block" }}>
              评估标签
              <span style={{ fontSize: 11, color: "#525675", marginLeft: 4 }}>（可选）</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setEvalTag("")}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: evalTag === "" ? "#252836" : "#1A1D29",
                  color: evalTag === "" ? "#E8EAF0" : "#525675",
                  border: `1px solid ${evalTag === "" ? "#3A3D50" : "#252836"}`,
                }}
              >
                不设置
              </button>
              {EVAL_TAGS.map((et) => (
                <button
                  key={et.label}
                  onClick={() => setEvalTag(et.label)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: evalTag === et.label ? et.bg : "#1A1D29",
                    color: evalTag === et.label ? et.color : "#8B8FA8",
                    border: `1px solid ${evalTag === et.label ? et.color + "44" : "#252836"}`,
                  }}
                >
                  {et.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Range */}
          <div className="mb-4">
            <label style={{ fontSize: 12, color: "#8B8FA8", fontWeight: 600, marginBottom: 6, display: "block" }}>
              时间范围
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg outline-none"
                style={{
                  background: "#1A1D29",
                  border: "1px solid #252836",
                  color: "#E8EAF0",
                  fontSize: 13,
                  colorScheme: "dark",
                }}
              />
              <span style={{ color: "#525675", fontSize: 12 }}>→</span>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg outline-none"
                style={{
                  background: "#1A1D29",
                  border: "1px solid #252836",
                  color: "#E8EAF0",
                  fontSize: 13,
                  colorScheme: "dark",
                }}
              />
            </div>
            {durationPreview && (
              <div className="mt-2 flex items-center gap-1.5">
                <Clock size={12} style={{ color: catInfo.color }} />
                <span style={{ fontSize: 12, color: catInfo.color, fontWeight: 600 }}>
                  {durationPreview}
                </span>
              </div>
            )}
          </div>

          {/* Feeling */}
          <div className="mb-4">
            <label style={{ fontSize: 12, color: "#8B8FA8", fontWeight: 600, marginBottom: 6, display: "block" }}>
              <MessageSquare size={12} style={{ display: "inline", marginRight: 4 }} />
              感受（可选）
            </label>
            <textarea
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              placeholder="完成这件事后你的感受..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg outline-none resize-none"
              style={{
                background: "#1A1D29",
                border: "1px solid #252836",
                color: "#E8EAF0",
                fontSize: 13,
              }}
            />
          </div>

          {/* Tags */}
          <div className="mb-2">
            <label style={{ fontSize: 12, color: "#8B8FA8", fontWeight: 600, marginBottom: 6, display: "block" }}>
              <Tag size={12} style={{ display: "inline", marginRight: 4 }} />
              标签（可选，逗号分隔）
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="如：阅读, 会议, 运动"
              className="w-full px-3 py-2.5 rounded-lg outline-none"
              style={{
                background: "#1A1D29",
                border: "1px solid #252836",
                color: "#E8EAF0",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: "1px solid #252836" }}>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold transition-opacity"
            style={{
              background: name.trim()
                ? "linear-gradient(135deg, #A855F7, #4F7FFF)"
                : "#252836",
              color: name.trim() ? "#fff" : "#525675",
              opacity: name.trim() ? 1 : 0.6,
            }}
          >
            添加记录
          </button>
        </div>
      </div>
    </div>
  );
}
