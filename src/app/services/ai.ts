/**
 * AI 服务层 — 统一 API 抽象（阿里百炼平台 DashScope）
 * 支持通义千问 / GLM / Kimi 等模型，统一 OpenAI 兼容格式
 */

// ─── Provider 配置 ───────────────────────────────────────────────────

export type AIProvider = "dashscope";

export interface AIModelOption {
  id: string;
  name: string;
  cheap: boolean;
}

export interface AIProviderConfig {
  name: string;
  baseURL: string;
  models: AIModelOption[];
}

export const PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  dashscope: {
    name: "阿里百炼",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "glm-5.1", name: "GLM-5.1", cheap: false },
      { id: "kimi-2.5", name: "Kimi 2.5", cheap: false },
      { id: "qwen3-plus", name: "Qwen3 Plus", cheap: false },
      { id: "qwen3-turbo", name: "Qwen3 Turbo (省钱)", cheap: true },
      { id: "qwen-max", name: "Qwen Max", cheap: false },
    ],
  },
};

// ─── 通用类型 ─────────────────────────────────────────────────────────

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

// ─── AbortController 管理 ────────────────────────────────────────────

// 用 Symbol 标记每次调用，避免并发时互相取消
let activeController: AbortController | null = null;

/** 手动取消当前进行中的 AI 请求（仅由用户点击停止时调用）*/
export function abortAIRequest() {
  if (activeController) {
    activeController.abort("manual");
    activeController = null;
  }
}

// ─── 统一调用 ─────────────────────────────────────────────────────────

const AI_TIMEOUT_MS = 60_000; // 60 秒超时

export async function callAI(
  config: AIConfig,
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number; enableThinking?: boolean }
): Promise<AIResponse> {
  const providerConfig = PROVIDERS[config.provider];
  if (!providerConfig) throw new Error(`未知的 AI 提供商: ${config.provider}`);

  const url = `${providerConfig.baseURL}/chat/completions`;

  const isQwen3 = config.model.startsWith("qwen3");
  const enableThinking = options?.enableThinking ?? false;

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
  };

  if (isQwen3) {
    if (enableThinking) {
      body.enable_thinking = true;
    } else {
      body.enable_thinking = false;
      body.temperature = options?.temperature ?? 0.7;
    }
  } else {
    body.temperature = options?.temperature ?? 0.7;
  }

  if (options?.maxTokens) {
    body.max_tokens = options.maxTokens;
  }

  // 每次创建独立的 controller，不自动取消上一个
  const controller = new AbortController();
  activeController = controller;

  const timeoutId = setTimeout(() => controller.abort("timeout"), AI_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI API 错误 (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();

    const choice = json.choices?.[0];
    if (!choice) throw new Error("AI 返回为空");

    const usage = json.usage
      ? {
          promptTokens: json.usage.prompt_tokens || 0,
          completionTokens: json.usage.completion_tokens || 0,
          totalTokens: json.usage.total_tokens || 0,
        }
      : undefined;

    return {
      content: choice.message?.content || "",
      usage,
    };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      const reason = e.message || "";
      throw new Error(reason === "timeout" ? "请求超时（60秒），请稍后重试" : "已手动停止");
    }
    throw e;
  } finally {
    if (activeController === controller) {
      activeController = null;
    }
  }
}

// ─── 测试连接 ─────────────────────────────────────────────────────────

export async function testConnection(config: AIConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await callAI(config, [
      { role: "user", content: "请回复「连接成功」四个字" },
    ], { maxTokens: 20 });
    return { ok: !!res.content };
  } catch (e: any) {
    return { ok: false, error: e.message || "连接失败" };
  }
}

// ─── 数据快照收集器 ──────────────────────────────────────────────────

export interface DataSnapshot {
  todaySessions: string;
  activeTasks: string;
  recentSessions: string;
  ideas: string;
  todos: string;
  longTasks: string;
  date: string;
  targetDaySessions: string;  // 指定日期的 sessions（可与 todaySessions 不同）
  targetDate: string;          // 目标日期的可读文本
  profile: string;             // 用户档案摘要（MBTI + 大五 + 属性得分）
}

/**
 * 从 AppContext 数据构建 AI 可理解的紧凑快照
 * 传入原始数据而非 context ref，保持解耦
 * targetDate: 可选，指定日期（默认今天）
 */
export function collectSnapshot(data: {
  tasks: Array<{ name: string; category: string; elapsed: number; isRunning: boolean; tags: string[] }>;
  sessions: Array<{
    taskName: string; category: string; startTime: Date; endTime: Date;
    duration: number; evalTag?: string; tags: string[];
  }>;
  ideas: Array<{
    title: string; stage: string; category: string; evaluation: { score: number | null };
    totalTimeSpent: number;
  }>;
  todos: Array<{ text: string; completed: boolean; category: string; priority: string; archived?: boolean }>;
  longTasks: Array<{ name: string; category: string; elapsed: number; isRunning: boolean }>;
  userProfile?: {
    name?: string;
    mbti?: string;
    occupation?: string;
    bigFive?: {
      openness: number; conscientiousness: number; extraversion: number;
      agreeableness: number; neuroticism: number;
    };
    attributes?: {
      execution: number; creativity: number; focus: number;
      selfControl: number; curiosity: number; resilience: number;
    };
  };
}, targetDate?: Date): DataSnapshot {
  const now = new Date();
  const target = targetDate || now;
  const targetDayStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const targetDayEnd = new Date(targetDayStart.getTime() + 86400000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);

  // 目标日期的 sessions
  const targetSessions = data.sessions
    .filter((s) => s.endTime >= targetDayStart && s.endTime < targetDayEnd)
    .map((s) => {
      const mins = Math.round(s.duration / 60);
      const startH = s.startTime.getHours().toString().padStart(2, "0");
      const startM = s.startTime.getMinutes().toString().padStart(2, "0");
      const endH = s.endTime.getHours().toString().padStart(2, "0");
      const endM = s.endTime.getMinutes().toString().padStart(2, "0");
      return `${s.taskName}(${s.category}, ${startH}:${startM}-${endH}:${endM}, ${mins}分钟${s.evalTag ? ", " + s.evalTag : ""})`;
    });

  // 今日完成的 sessions
  const todaySessions = data.sessions
    .filter((s) => s.endTime >= todayStart)
    .map((s) => {
      const mins = Math.round(s.duration / 60);
      return `${s.taskName}(${s.category}, ${mins}分钟${s.evalTag ? ", " + s.evalTag : ""})`;
    });

  // 当前运行中任务
  const active = data.tasks
    .filter((t) => t.isRunning)
    .map((t) => `${t.name}(${t.category}, 已${Math.round(t.elapsed / 60)}分钟)`);

  // 近7天统计
  const recentSessions = data.sessions.filter((s) => s.endTime >= weekAgo);
  const byCategory: Record<string, number> = {};
  recentSessions.forEach((s) => {
    byCategory[s.category] = (byCategory[s.category] || 0) + s.duration;
  });
  const recentSummary = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, secs]) => `${cat}: ${(secs / 3600).toFixed(1)}h`)
    .join(", ");

  // 点子
  const ideasSummary = data.ideas
    .filter((i) => i.stage !== "archived")
    .map((i) => {
      const score = i.evaluation.score !== null ? ` 评分${i.evaluation.score.toFixed(1)}` : "";
      const time = i.totalTimeSpent > 0 ? ` 已投入${Math.round(i.totalTimeSpent / 60)}分钟` : "";
      return `${i.title}(${i.category}, ${i.stage}${score}${time})`;
    });

  // 待办
  const activeTodos = data.todos.filter((t) => !t.completed && !t.archived);
  const todoSummary = activeTodos.map((t) => `${t.text}(${t.priority}, ${t.category})`);

  // 长线任务
  const longTasksSummary = data.longTasks.map((t) => {
    const hrs = (t.elapsed / 3600).toFixed(1);
    return `${t.name}(${t.category}, ${hrs}h${t.isRunning ? ", 运行中" : ""})`;
  });

  const targetDateStr = target.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  // ─── 用户档案摘要 ───────────────────────────────────────────────────
  let profileParts: string[] = [];
  if (data.userProfile) {
    const p = data.userProfile;
    if (p.name) profileParts.push(`姓名: ${p.name}`);
    if (p.occupation) profileParts.push(`职业: ${p.occupation}`);
    if (p.mbti) profileParts.push(`MBTI: ${p.mbti}`);
    if (p.bigFive) {
      const bf = p.bigFive;
      profileParts.push(`大五人格 — 开放性${bf.openness} 尽责性${bf.conscientiousness} 外向性${bf.extraversion} 宜人性${bf.agreeableness} 神经质${bf.neuroticism}`);
    }
    if (p.attributes) {
      const a = p.attributes;
      profileParts.push(`当前属性 — 执行力${a.execution} 创造力${a.creativity} 专注力${a.focus} 自控力${a.selfControl} 求知欲${a.curiosity} 抗压性${a.resilience}`);
    }
  }
  const profileStr = profileParts.length > 0
    ? `用户档案:\n${profileParts.join("\n")}`
    : "";

  return {
    todaySessions: todaySessions.length > 0
      ? `今日完成: ${todaySessions.join("; ")}`
      : "今日暂无完成的计时记录",
    activeTasks: active.length > 0
      ? `正在进行: ${active.join("; ")}`
      : "当前没有运行中的任务",
    recentSessions: recentSummary
      ? `近7天分类统计: ${recentSummary} (共${recentSessions.length}条记录)`
      : "近7天暂无计时记录",
    ideas: ideasSummary.length > 0
      ? `点子: ${ideasSummary.join("; ")}`
      : "暂无点子",
    todos: todoSummary.length > 0
      ? `待办(${activeTodos.length}项): ${todoSummary.slice(0, 10).join("; ")}`
      : "暂无待办",
    longTasks: longTasksSummary.length > 0
      ? `长线任务: ${longTasksSummary.join("; ")}`
      : "暂无长线任务",
    date: now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" }),
    targetDaySessions: targetSessions.length > 0
      ? `${targetDateStr}完成: ${targetSessions.join("; ")}`
      : `${targetDateStr}暂无计时记录`,
    targetDate: targetDateStr,
    profile: profileStr,
  };
}
