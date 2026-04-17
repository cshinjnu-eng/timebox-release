/**
 * AI Prompt 模板 — 四种能力的 system/user prompt 构建器
 */

import type { DataSnapshot, AIMessage } from "./ai";

// ─── 时间分析与建议 ──────────────────────────────────────────────────

export function buildTimeAnalysisMessages(snapshot: DataSnapshot): AIMessage[] {
  return [
    {
      role: "system",
      content: `你是 TimeBox 时间管理助手。你的角色是分析用户的计时数据，给出简洁有力的效率分析和改进建议。

规则：
- 用中文回答
- 简洁，不超过300字
- 给出具体的、可操作的建议（不要空泛的「合理安排时间」）
- 如果发现明显问题（如娱乐过多、工作碎片化），直接指出
- 用 markdown 格式输出`,
    },
    {
      role: "user",
      content: `今天是 ${snapshot.date}。请分析我的时间使用情况：

${snapshot.todaySessions}
${snapshot.activeTasks}
${snapshot.recentSessions}
${snapshot.longTasks}

请给出：
1. 今日概要（一句话）
2. 关键发现（2-3条）
3. 改进建议（1-2条具体行动）`,
    },
  ];
}

// ─── 点子助手 ─────────────────────────────────────────────────────────

export function buildIdeaAssistMessages(snapshot: DataSnapshot, userRequest: string): AIMessage[] {
  return [
    {
      role: "system",
      content: `你是 TimeBox 点子助手。帮助用户评估点子、拆分任务、规划里程碑。

输出要求：严格输出 JSON，格式如下（不要输出其他内容，不要包裹在markdown代码块中）：
{
  "action": "evaluate" | "split_tasks" | "suggest" | "chat",
  "data": {
    // evaluate 时: { "feasibility": 1-5, "necessity": 1-5, "impact": 1-5, "timeEstimate": 小时数, "summary": "一句话评估" }
    // split_tasks 时: { "tasks": [{ "title": "任务名", "estimatedMinutes": 分钟数 }], "milestones": [{ "title": "里程碑名", "tasks": ["任务名1", "任务名2"] }] }
    // suggest 时: { "suggestions": ["建议1", "建议2"] }
    // chat 时: { "reply": "普通对话回复" }
  }
}`,
    },
    {
      role: "user",
      content: `我的点子列表：
${snapshot.ideas}

用户请求：${userRequest}`,
    },
  ];
}

// ─── 日报/周报生成 ───────────────────────────────────────────────────

export function buildDailyReportMessages(snapshot: DataSnapshot): AIMessage[] {
  return [
    {
      role: "system",
      content: `你是 TimeBox 日报生成器。根据用户的计时记录生成简洁的日报。

输出要求：严格输出 JSON（不要包裹在markdown代码块中）：
{
  "title": "日报标题（含日期）",
  "summary": "一句话总结",
  "totalHours": 小时数(保留1位小数),
  "categories": [{ "name": "分类名", "hours": 小时数, "percentage": 百分比 }],
  "highlights": ["亮点1", "亮点2"],
  "improvements": ["改进点1"],
  "score": 1-10 的效率评分,
  "scoreReason": "评分理由（一句话）"
}`,
    },
    {
      role: "user",
      content: `请为 ${snapshot.targetDate} 生成日报。

该日计时数据：
${snapshot.targetDaySessions}

当前待办和长线任务（作为背景参考）：
${snapshot.todos}
${snapshot.longTasks}`,
    },
  ];
}

export function buildWeeklyReportMessages(snapshot: DataSnapshot): AIMessage[] {
  return [
    {
      role: "system",
      content: `你是 TimeBox 周报生成器。根据用户近7天的计时数据生成周报。

输出要求：严格输出 JSON（不要包裹在markdown代码块中）：
{
  "title": "周报标题（含日期范围）",
  "summary": "一句话总结本周",
  "totalHours": 小时数,
  "categories": [{ "name": "分类名", "hours": 小时数, "percentage": 百分比 }],
  "topTasks": [{ "name": "任务名", "hours": 小时数 }],
  "highlights": ["成就1", "成就2"],
  "trends": "趋势分析（2-3句话）",
  "nextWeekSuggestions": ["建议1", "建议2"],
  "score": 1-10
}`,
    },
    {
      role: "user",
      content: `今天是 ${snapshot.date}。请根据以下数据生成周报：

${snapshot.recentSessions}
${snapshot.ideas}
${snapshot.todos}
${snapshot.longTasks}`,
    },
  ];
}

// ─── 自然语言操作 ────────────────────────────────────────────────────

export function buildNLCommandMessages(snapshot: DataSnapshot, userInput: string): AIMessage[] {
  return [
    {
      role: "system",
      content: `你是 TimeBox 操作助手。用户用自然语言描述想做什么，你将其转换为操作指令。

可用操作（严格输出 JSON，不要包裹在markdown代码块中）：

1. 创建计时任务:
{ "action": "CREATE_TASK", "data": { "name": "任务名", "category": "工作|学习|生活|娱乐|琐事", "tags": ["标签"], "estimatedMinutes": 分钟数 } }

2. 创建点子:
{ "action": "CREATE_IDEA", "data": { "title": "点子标题", "description": "描述", "category": "科研|产品|品牌|课业|生活" } }

3. 创建待办:
{ "action": "CREATE_TODO", "data": { "text": "待办内容", "category": "工作|学习|生活|娱乐|琐事", "priority": "high|medium|low" } }

4. 生成报告:
{ "action": "GENERATE_REPORT", "data": { "type": "daily" | "weekly", "daysAgo": 0 } }
   daysAgo: 0=今天, 1=昨天, 2=前天, 以此类推。用户说「昨天的日报」→ daysAgo:1

5. 分析时间:
{ "action": "ANALYZE_TIME", "data": {} }

6. 普通对话（不需要操作时）:
{ "action": "CHAT", "data": { "reply": "你的回复" } }

注意：
- 根据用户意图选择最合适的操作
- category 必须从给定选项中选择
- 如果不确定，用 CHAT 回复并询问
- 用中文回复`,
    },
    {
      role: "user",
      content: `当前状态：
${snapshot.activeTasks}
${snapshot.todaySessions}

用户说：${userInput}`,
    },
  ];
}

// ─── 自动洞察（后台） ────────────────────────────────────────────────

export function buildAutoInsightMessages(snapshot: DataSnapshot): AIMessage[] {
  return [
    {
      role: "system",
      content: `你是 TimeBox 智能助手。你在后台分析用户的时间数据，生成一条简短但有洞察力的提醒。

规则：
- 只输出一条最重要的洞察，不超过50字
- 要有具体数据支撑（如「今天娱乐占了40%」）
- 如果一切正常，给一句鼓励
- 如果发现问题，温和但直接地指出
- 不要输出 JSON，直接输出纯文本`,
    },
    {
      role: "user",
      content: `${snapshot.date}

${snapshot.todaySessions}
${snapshot.activeTasks}
${snapshot.recentSessions}`,
    },
  ];
}
