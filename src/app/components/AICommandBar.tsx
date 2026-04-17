import { useState, useRef } from "react";
import { Zap, Send, Loader2, FileText, BarChart3, Lightbulb, X, ChevronUp, ChevronDown, Calendar, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";

function getRecentDays(): { label: string; date: Date }[] {
  const days: { label: string; date: Date }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const label = i === 0 ? "今天" : i === 1 ? "昨天" : i === 2 ? "前天" : `${d.getMonth() + 1}/${d.getDate()}`;
    days.push({ label, date: d });
  }
  return days;
}

export function AICommandBar() {
  const { executeNLCommand, generateDailyReport, generateWeeklyReport, analyzeTime, aiConfig, aiLoading, setShowAISettings, cancelAI } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConfigured = aiConfig && aiConfig.apiKey;

  async function handleSubmit() {
    if (!input.trim() || aiLoading) return;
    setError(null);
    setResponse(null);
    try {
      const result = await executeNLCommand(input.trim());
      setResponse(result);
      setInput("");
    } catch (e: any) {
      setError(e.message || "操作失败");
    }
  }

  async function handleDailyReport(targetDate?: Date) {
    setError(null);
    setResponse(null);
    setShowDatePicker(false);
    try {
      await generateDailyReport(targetDate);
      if (targetDate) {
        const label = targetDate.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
        setResponse(`${label} 日报已生成`);
      } else {
        setResponse("今日日报已生成");
      }
    } catch (e: any) {
      setError(e.message || "操作失败");
    }
  }

  async function handleQuickAction(action: "weekly" | "analyze") {
    setError(null);
    setResponse(null);
    try {
      if (action === "weekly") {
        await generateWeeklyReport();
        setResponse("周报已生成");
      } else {
        await analyzeTime();
        setResponse("时间分析已生成");
      }
    } catch (e: any) {
      setError(e.message || "操作失败");
    }
  }

  if (!isConfigured) {
    return (
      <button
        onClick={() => setShowAISettings(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(249,115,22,0.06))",
          border: "1px solid rgba(245,158,11,0.15)",
        }}
      >
        <Zap size={14} style={{ color: "#F59E0B" }} />
        <span style={{ fontSize: 12, color: "#8B8FA8" }}>配置 AI 助手，解锁智能分析</span>
        <div className="flex-1" />
        <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 500 }}>设置</span>
      </button>
    );
  }

  const recentDays = getRecentDays();

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "#161820",
        border: `1px solid ${expanded ? "rgba(245,158,11,0.2)" : "#252836"}`,
        boxShadow: expanded ? "0 4px 16px rgba(245,158,11,0.06)" : "none",
      }}
    >
      {/* 收起状态：一行提示 */}
      <div className="w-full flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => {
            if (!aiLoading) {
              setExpanded(!expanded);
              setShowDatePicker(false);
              if (!expanded) setTimeout(() => inputRef.current?.focus(), 100);
            }
          }}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <Zap size={14} style={{ color: "#F59E0B", filter: "drop-shadow(0 0 3px rgba(245,158,11,0.3))" }} />
          <span style={{ fontSize: 12, color: "#8B8FA8" }}>
            {aiLoading ? "AI 处理中..." : "对我说点什么..."}
          </span>
        </button>
        {aiLoading ? (
          <button
            onClick={(e) => { e.stopPropagation(); cancelAI(); setError("已手动停止"); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md"
            style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#EF4444",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <Square size={10} fill="#EF4444" />
            停止
          </button>
        ) : (
          <button
            onClick={() => {
              setExpanded(!expanded);
              setShowDatePicker(false);
              if (!expanded) setTimeout(() => inputRef.current?.focus(), 100);
            }}
          >
            {expanded ? (
              <ChevronUp size={12} style={{ color: "#525675" }} />
            ) : (
              <ChevronDown size={12} style={{ color: "#525675" }} />
            )}
          </button>
        )}
      </div>

      {/* 展开状态 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {/* 输入框 */}
              <div className="flex items-center gap-2 mb-2.5">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  placeholder="例如：帮我建一个30分钟的论文写作任务"
                  disabled={aiLoading}
                  className="flex-1 rounded-lg px-3 py-2 outline-none"
                  style={{
                    background: "#0B0D14",
                    border: "1px solid #252836",
                    color: "#E8EAF0",
                    fontSize: 13,
                  }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || aiLoading}
                  className="flex items-center justify-center rounded-lg"
                  style={{
                    width: 36,
                    height: 36,
                    background: input.trim() ? "rgba(245,158,11,0.15)" : "#1A1D29",
                    color: input.trim() ? "#F59E0B" : "#525675",
                  }}
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>

              {/* 快捷操作 */}
              <div className="flex gap-2 mb-2 flex-wrap">
                {/* 日报按钮 — 点击展开日期选择 */}
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  disabled={aiLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{
                    background: showDatePicker ? "rgba(79,127,255,0.18)" : "rgba(79,127,255,0.08)",
                    border: `1px solid ${showDatePicker ? "rgba(79,127,255,0.35)" : "rgba(79,127,255,0.15)"}`,
                    color: "#4F7FFF",
                  }}
                >
                  <Calendar size={10} />
                  日报
                  <ChevronDown size={8} style={{ transform: showDatePicker ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                <button
                  onClick={() => handleQuickAction("weekly")}
                  disabled={aiLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{
                    background: "rgba(168,85,247,0.08)",
                    border: "1px solid rgba(168,85,247,0.15)",
                    color: "#A855F7",
                  }}
                >
                  <FileText size={10} />
                  周报
                </button>
                <button
                  onClick={() => handleQuickAction("analyze")}
                  disabled={aiLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.15)",
                    color: "#10B981",
                  }}
                >
                  <BarChart3 size={10} />
                  分析
                </button>
                <button
                  onClick={() => setShowAISettings(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs ml-auto"
                  style={{
                    background: "#1A1D29",
                    border: "1px solid #252836",
                    color: "#525675",
                  }}
                >
                  <Zap size={10} />
                  设置
                </button>
              </div>

              {/* 日期选择器 */}
              <AnimatePresence>
                {showDatePicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden mb-2"
                  >
                    <div
                      className="flex gap-1.5 flex-wrap px-1 py-2 rounded-lg"
                      style={{ background: "rgba(79,127,255,0.04)", border: "1px solid rgba(79,127,255,0.1)" }}
                    >
                      <span style={{ fontSize: 11, color: "#525675", width: "100%", paddingLeft: 4, marginBottom: 2 }}>
                        选择日期生成日报：
                      </span>
                      {recentDays.map(({ label, date }) => (
                        <button
                          key={label}
                          onClick={() => handleDailyReport(date)}
                          disabled={aiLoading}
                          className="px-3 py-1.5 rounded-md text-xs transition-all"
                          style={{
                            background: "rgba(79,127,255,0.1)",
                            border: "1px solid rgba(79,127,255,0.2)",
                            color: "#4F7FFF",
                            fontWeight: 500,
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 响应/错误 */}
              <AnimatePresence>
                {response && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}
                  >
                    <Lightbulb size={12} style={{ color: "#10B981", marginTop: 2, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: "#E8EAF0", lineHeight: 1.5, flex: 1 }}>{response}</p>
                    <button onClick={() => setResponse(null)} style={{ color: "#525675", flexShrink: 0 }}>
                      <X size={10} />
                    </button>
                  </motion.div>
                )}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}
                  >
                    <p style={{ fontSize: 12, color: "#EF4444", lineHeight: 1.5, flex: 1 }}>{error}</p>
                    <button onClick={() => setError(null)} style={{ color: "#525675", flexShrink: 0 }}>
                      <X size={10} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
