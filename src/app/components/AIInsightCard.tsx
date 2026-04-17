import { useState } from "react";
import { Zap, X, BarChart3, FileText, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp, type AIInsight } from "../context/AppContext";

const typeConfig: Record<AIInsight["type"], { icon: typeof Zap; color: string; label: string; bg: string }> = {
  time_analysis: { icon: BarChart3, color: "#A855F7", label: "时间分析", bg: "rgba(168,85,247,0.08)" },
  daily_report: { icon: FileText, color: "#4F7FFF", label: "日报", bg: "rgba(79,127,255,0.08)" },
  weekly_report: { icon: FileText, color: "#10B981", label: "周报", bg: "rgba(16,185,129,0.08)" },
  idea_suggestion: { icon: Lightbulb, color: "#F59E0B", label: "点子建议", bg: "rgba(245,158,11,0.08)" },
  auto: { icon: Zap, color: "#F59E0B", label: "AI 洞察", bg: "rgba(245,158,11,0.08)" },
};

function InsightCard({ insight, onDismiss }: { insight: AIInsight; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[insight.type] || typeConfig.auto;
  const Icon = config.icon;

  // 尝试解析 JSON 内容（日报/周报）
  let parsed: any = null;
  try {
    const cleaned = insight.content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // 非 JSON，使用原文
  }

  const timeAgo = (() => {
    const diff = Date.now() - new Date(insight.createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  })();

  // 获取摘要（第一行或 JSON 的 summary）
  const summary = parsed?.summary || parsed?.title || insight.content.split("\n")[0].slice(0, 60);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, scale: 0.95 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: config.bg,
        border: `1px solid ${config.color}20`,
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <Icon size={13} style={{ color: config.color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: config.color, fontWeight: 600, flexShrink: 0 }}>
          {config.label}
        </span>
        <span
          className="flex-1 truncate"
          style={{ fontSize: 12, color: "#E8EAF0" }}
        >
          {summary}
        </span>
        <span style={{ fontSize: 9, color: "#525675", flexShrink: 0 }}>{timeAgo}</span>
        {expanded ? (
          <ChevronUp size={10} style={{ color: "#525675", flexShrink: 0 }} />
        ) : (
          <ChevronDown size={10} style={{ color: "#525675", flexShrink: 0 }} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="p-0.5 rounded"
          style={{ color: "#525675", flexShrink: 0 }}
        >
          <X size={10} />
        </button>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {parsed ? (
                <ReportView data={parsed} type={insight.type} />
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: "#C8CAD8",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {insight.content}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** 结构化报告视图 */
function ReportView({ data, type }: { data: any; type: string }) {
  return (
    <div className="flex flex-col gap-2">
      {data.title && (
        <p style={{ fontSize: 13, fontWeight: 600, color: "#E8EAF0" }}>{data.title}</p>
      )}
      {data.summary && (
        <p style={{ fontSize: 12, color: "#8B8FA8" }}>{data.summary}</p>
      )}

      {/* 分类时间统计 */}
      {data.categories && data.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.categories.map((cat: any, i: number) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md"
              style={{ fontSize: 10, background: "#252836", color: "#C8CAD8" }}
            >
              {cat.name} {cat.hours}h ({cat.percentage}%)
            </span>
          ))}
        </div>
      )}

      {/* 效率评分 */}
      {data.score != null && (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, color: "#8B8FA8" }}>效率评分</span>
          <span
            className="tb-mono"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: data.score >= 7 ? "#10B981" : data.score >= 4 ? "#F59E0B" : "#EF4444",
            }}
          >
            {data.score}/10
          </span>
          {data.scoreReason && (
            <span style={{ fontSize: 10, color: "#525675" }}>{data.scoreReason}</span>
          )}
        </div>
      )}

      {/* 亮点 */}
      {data.highlights && data.highlights.length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: "#525675", marginBottom: 2 }}>亮点</p>
          {data.highlights.map((h: string, i: number) => (
            <p key={i} style={{ fontSize: 11, color: "#10B981", lineHeight: 1.5 }}>+ {h}</p>
          ))}
        </div>
      )}

      {/* 改进建议 */}
      {(data.improvements || data.nextWeekSuggestions) && (
        <div>
          <p style={{ fontSize: 10, color: "#525675", marginBottom: 2 }}>建议</p>
          {(data.improvements || data.nextWeekSuggestions || []).map((s: string, i: number) => (
            <p key={i} style={{ fontSize: 11, color: "#F59E0B", lineHeight: 1.5 }}>- {s}</p>
          ))}
        </div>
      )}

      {/* 趋势 */}
      {data.trends && (
        <p style={{ fontSize: 11, color: "#8B8FA8", lineHeight: 1.5 }}>{data.trends}</p>
      )}
    </div>
  );
}

/** 洞察列表 */
export function AIInsightList() {
  const { aiInsights, dismissInsight } = useApp();

  const unread = aiInsights.filter((i) => !i.read);
  if (unread.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence>
        {unread.slice(0, 5).map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onDismiss={() => dismissInsight(insight.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
