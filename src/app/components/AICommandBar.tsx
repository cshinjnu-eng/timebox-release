import { useState, useRef, useEffect } from "react";
import {
  Zap, Send, Loader2, FileText, BarChart3, X,
  ChevronUp, ChevronDown, Calendar, Square, Plus, Bot, User,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../context/AppContext";
import type { AIMessage } from "../services/ai";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isAction?: boolean; // true = 执行了操作（绿色），false = 普通回复
}

export function AICommandBar() {
  const {
    executeNLCommand, generateDailyReport, generateWeeklyReport, analyzeTime, growthInsight,
    aiConfig, aiLoading, setShowAISettings, cancelAI,
    conversationHistory, clearConversation,
  } = useApp();

  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // 本地展示用的消息列表（含用户和 AI 双方）
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  // 传给 AI 的多轮历史（只含 user/assistant role 的原始格式）
  const [history, setHistory] = useState<AIMessage[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isConfigured = aiConfig && aiConfig.apiKey;

  // 自动滚到底部
  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, expanded]);

  function handleNewSession() {
    setChatMessages([]);
    setHistory([]);
    clearConversation();
    setError(null);
    setInput("");
  }

  async function handleSubmit() {
    if (!input.trim() || aiLoading) return;
    const userText = input.trim();
    setInput("");
    setError(null);

    // 立即展示用户消息
    setChatMessages((prev) => [...prev, { role: "user", content: userText }]);

    try {
      const result = await executeNLCommand(userText, history);
      const isAction = !result.startsWith("我") && (
        result.includes("已创建") || result.includes("已补录") || result.includes("已生成") ||
        result.includes("日报") || result.includes("周报") || result.includes("分析")
      );
      setChatMessages((prev) => [...prev, { role: "assistant", content: result, isAction }]);
      // 追加到多轮历史
      setHistory((prev) => [
        ...prev,
        { role: "user", content: userText },
        { role: "assistant", content: result },
      ]);
    } catch (e: any) {
      const errMsg = e.message || "操作失败";
      setError(errMsg);
      setChatMessages((prev) => [...prev, { role: "assistant", content: errMsg, isAction: false }]);
    }
  }

  async function handleDailyReport(targetDate?: Date) {
    setError(null);
    setShowDatePicker(false);
    try {
      await generateDailyReport(targetDate);
      const label = targetDate
        ? targetDate.toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
        : "今日";
      setChatMessages((prev) => [...prev, { role: "assistant", content: `${label}日报已生成，查看洞察卡片`, isAction: true }]);
    } catch (e: any) {
      setError(e.message || "操作失败");
    }
  }

  async function handleQuickAction(action: "weekly" | "analyze" | "growth") {
    setError(null);
    try {
      if (action === "weekly") {
        await generateWeeklyReport();
        setChatMessages((prev) => [...prev, { role: "assistant", content: "周报已生成，查看洞察卡片", isAction: true }]);
      } else if (action === "growth") {
        await growthInsight();
        setChatMessages((prev) => [...prev, { role: "assistant", content: "成长洞察已生成，查看洞察卡片", isAction: true }]);
      } else {
        await analyzeTime();
        setChatMessages((prev) => [...prev, { role: "assistant", content: "时间分析已生成，查看洞察卡片", isAction: true }]);
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
  const hasHistory = chatMessages.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "#161820",
        border: `1px solid ${expanded ? "rgba(245,158,11,0.2)" : "#252836"}`,
        boxShadow: expanded ? "0 4px 16px rgba(245,158,11,0.06)" : "none",
      }}
    >
      {/* 顶栏 */}
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
          <span style={{ fontSize: 12, color: "#8B8FA8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {aiLoading ? "AI 思考中..." : hasHistory ? `对话中 · ${chatMessages.length} 条消息` : "对我说点什么..."}
          </span>
        </button>
        {aiLoading ? (
          <button
            onClick={(e) => { e.stopPropagation(); cancelAI(); setError("已手动停止"); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md flex-shrink-0"
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
            {expanded
              ? <ChevronUp size={12} style={{ color: "#525675" }} />
              : <ChevronDown size={12} style={{ color: "#525675" }} />}
          </button>
        )}
      </div>

      {/* 展开内容 */}
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

              {/* 对话历史 */}
              {hasHistory && (
                <div
                  className="flex flex-col gap-2 mb-3 overflow-y-auto"
                  style={{ maxHeight: 240, paddingRight: 2 }}
                >
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* 头像 */}
                      <div
                        className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{
                          width: 22, height: 22,
                          background: msg.role === "user" ? "rgba(79,127,255,0.2)" : "rgba(245,158,11,0.15)",
                          marginTop: 2,
                        }}
                      >
                        {msg.role === "user"
                          ? <User size={11} style={{ color: "#4F7FFF" }} />
                          : <Bot size={11} style={{ color: "#F59E0B" }} />}
                      </div>
                      {/* 气泡 */}
                      <div
                        className="px-3 py-2 rounded-xl"
                        style={{
                          maxWidth: "78%",
                          fontSize: 12,
                          lineHeight: 1.5,
                          background: msg.role === "user"
                            ? "rgba(79,127,255,0.12)"
                            : msg.isAction
                              ? "rgba(16,185,129,0.08)"
                              : "#1A1D29",
                          color: msg.role === "user"
                            ? "#A5BFFF"
                            : msg.isAction ? "#10B981" : "#C8CAD8",
                          border: `1px solid ${
                            msg.role === "user"
                              ? "rgba(79,127,255,0.2)"
                              : msg.isAction
                                ? "rgba(16,185,129,0.15)"
                                : "#252836"
                          }`,
                          wordBreak: "break-word",
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}

              {/* 错误（非聊天错误，如超时） */}
              <AnimatePresence>
                {error && !chatMessages.some(m => m.content === error) && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg mb-2"
                    style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}
                  >
                    <p style={{ fontSize: 12, color: "#EF4444", lineHeight: 1.5, flex: 1 }}>{error}</p>
                    <button onClick={() => setError(null)} style={{ color: "#525675", flexShrink: 0 }}>
                      <X size={10} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 输入框 */}
              <div className="flex items-center gap-2 mb-2.5">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  placeholder={hasHistory ? "继续对话..." : "例如：昨晚9点到11点看论文"}
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
                    width: 36, height: 36,
                    background: input.trim() ? "rgba(245,158,11,0.15)" : "#1A1D29",
                    color: input.trim() ? "#F59E0B" : "#525675",
                  }}
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>

              {/* 快捷操作 */}
              <div className="flex gap-2 flex-wrap mb-2">
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
                  onClick={() => handleQuickAction("growth")}
                  disabled={aiLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                  style={{
                    background: "rgba(168,85,247,0.06)",
                    border: "1px solid rgba(168,85,247,0.15)",
                    color: "#A855F7",
                  }}
                >
                  <Zap size={10} />
                  成长
                </button>
                {hasHistory && (
                  <button
                    onClick={handleNewSession}
                    disabled={aiLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{
                      background: "rgba(245,158,11,0.06)",
                      border: "1px solid rgba(245,158,11,0.15)",
                      color: "#F59E0B",
                    }}
                  >
                    <Plus size={10} />
                    新会话
                  </button>
                )}
                <button
                  onClick={() => setShowAISettings(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs ml-auto"
                  style={{ background: "#1A1D29", border: "1px solid #252836", color: "#525675" }}
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
                    className="overflow-hidden"
                  >
                    <div
                      className="flex gap-1.5 flex-wrap px-1 py-2 rounded-lg mb-2"
                      style={{ background: "rgba(79,127,255,0.04)", border: "1px solid rgba(79,127,255,0.1)" }}
                    >
                      <span style={{ fontSize: 11, color: "#525675", width: "100%", paddingLeft: 4, marginBottom: 2 }}>
                        选择日期：
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

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
