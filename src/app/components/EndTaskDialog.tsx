import { useState } from "react";
import { AlertTriangle, X, Clock } from "lucide-react";
import { motion } from "motion/react";
import { useApp, formatElapsed, formatDuration, getEvalTagInfo } from "../context/AppContext";

export function EndTaskDialog() {
  const { taskToEnd, endTask, setShowEndTaskDialog, setTaskToEnd } = useApp();
  const [feeling, setFeeling] = useState("");

  if (!taskToEnd) return null;

  const evalInfo = taskToEnd.evalTag ? getEvalTagInfo(taskToEnd.evalTag) : null;

  function handleConfirm() {
    if (taskToEnd) {
      endTask(taskToEnd.id, feeling.trim() || undefined);
    }
    setShowEndTaskDialog(false);
    setTaskToEnd(null);
  }

  function handleCancel() {
    setShowEndTaskDialog(false);
    setTaskToEnd(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative rounded-2xl"
        style={{
          width: 440,
          background: "#161820",
          border: "1px solid #252836",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid #252836" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ width: 40, height: 40, background: "rgba(239,68,68,0.12)" }}
            >
              <AlertTriangle size={20} style={{ color: "#EF4444" }} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E8EAF0" }}>
                结束计时任务
              </h2>
              <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 2 }}>
                任务结束后将保存到工作日志
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 28, height: 28, background: "#252836", color: "#8B8FA8" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Task info */}
        <div className="px-6 py-4">
          <div
            className="rounded-xl p-4"
            style={{
              background: "#0B0D14",
              border: `1px solid ${taskToEnd.color}33`,
            }}
          >
            {/* Tags row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className="px-2 py-0.5 rounded-md text-xs font-medium"
                style={{ background: taskToEnd.bgColor, color: taskToEnd.color }}
              >
                {taskToEnd.category}
              </span>
              {evalInfo && (
                <span
                  className="px-2 py-0.5 rounded-md text-xs"
                  style={{ background: evalInfo.bg, color: evalInfo.color }}
                >
                  {taskToEnd.evalTag}
                </span>
              )}
              {taskToEnd.tags.length > 0 && (
                <span style={{ fontSize: 12, color: "#8B8FA8" }}>
                  {taskToEnd.tags.map((t) => `#${t}`).join(" ")}
                </span>
              )}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#E8EAF0", marginBottom: 10 }}>
              {taskToEnd.name}
            </p>
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: "#161820" }}
              >
                <Clock size={14} style={{ color: "#8B8FA8" }} />
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: taskToEnd.color,
                    letterSpacing: "0.04em",
                  }}
                >
                  {formatElapsed(taskToEnd.elapsed)}
                </span>
              </div>
              <span style={{ fontSize: 13, color: "#8B8FA8" }}>
                共 {formatDuration(taskToEnd.elapsed)}
              </span>
            </div>
          </div>

          {/* 完成感受 */}
          <div className="mt-4">
            <label style={{ fontSize: 13, color: "#8B8FA8", display: "block", marginBottom: 6 }}>
              完成感受
              <span style={{ fontSize: 11, color: "#525675", marginLeft: 6 }}>记录一下做完之后的感受</span>
            </label>
            <textarea
              value={feeling}
              onChange={(e) => setFeeling(e.target.value)}
              placeholder="比如：比预期花了更多时间，但很有收获..."
              rows={3}
              className="w-full rounded-lg px-3 py-2.5 outline-none resize-none transition-colors"
              style={{
                background: "#0B0D14",
                border: "1px solid #252836",
                color: "#E8EAF0",
                fontSize: 13,
              }}
              onFocus={(e) => (e.target.style.borderColor = "#4F7FFF")}
              onBlur={(e) => (e.target.style.borderColor = "#252836")}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid #252836" }}
        >
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ background: "#252836", color: "#8B8FA8", fontSize: 13 }}
          >
            继续计时
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg transition-opacity hover:opacity-90"
            style={{
              background: "#EF4444",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            确认结束
          </button>
        </div>
      </motion.div>
    </div>
  );
}
