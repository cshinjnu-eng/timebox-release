/**
 * 属性系统 — 动态标签 + EMA 时间衰减 + 特质标签
 *
 * 六大核心属性（六边形战士）：
 *   执行力 / 创造力 / 专注力 / 自控力 / 求知欲 / 抗压性
 *
 * 计算依据：
 *   - 工作/学习 session 时长  → 执行力、专注力
 *   - 点子数量与评分          → 创造力
 *   - 学习 session 占比       → 求知欲
 *   - 娱乐/桶时间反比          → 自控力
 *   - 连续活跃天数             → 抗压性
 *
 * EMA 衰减：每日更新一次
 *   new = α × todayRaw + (1 − α) × prev
 */

// ─── 属性元数据 ────────────────────────────────────────────────────────

export interface AttributeMeta {
  key: keyof AttributeScores;
  label: string;
  color: string;
  alpha: number;     // EMA 衰减系数：越大越敏感
  description: string;
}

export const ATTRIBUTE_META: AttributeMeta[] = [
  { key: "execution",   label: "执行力", color: "#4F7FFF", alpha: 0.3,  description: "完成工作学习任务的实际产出" },
  { key: "creativity",  label: "创造力", color: "#A855F7", alpha: 0.15, description: "产生和发展新想法的能力" },
  { key: "focus",       label: "专注力", color: "#10B981", alpha: 0.25, description: "长时间深度专注的能力" },
  { key: "selfControl", label: "自控力", color: "#F59E0B", alpha: 0.35, description: "管控娱乐、保持自律的能力" },
  { key: "curiosity",   label: "求知欲", color: "#06B6D4", alpha: 0.2,  description: "主动学习和探索的驱动力" },
  { key: "resilience",  label: "抗压性", color: "#EF4444", alpha: 0.1,  description: "持续稳定输出、抵抗中断的能力" },
];

// ─── 类型定义 ──────────────────────────────────────────────────────────

export interface AttributeScores {
  execution: number;    // 执行力  0-100
  creativity: number;   // 创造力  0-100
  focus: number;        // 专注力  0-100
  selfControl: number;  // 自控力  0-100
  curiosity: number;    // 求知欲  0-100
  resilience: number;   // 抗压性  0-100
}

export interface TraitTag {
  id: string;
  name: string;
  description: string;
  earnedAt: string;    // ISO date
  type: "achievement" | "habit" | "quirk";
  color: string;
}

export const DEFAULT_ATTRIBUTES: AttributeScores = {
  execution: 50, creativity: 50, focus: 50,
  selfControl: 50, curiosity: 50, resilience: 50,
};

// ─── MBTI 数据 ────────────────────────────────────────────────────────

export interface MBTIInfo {
  type: string;
  group: "NT" | "NF" | "SJ" | "SP";
  groupName: string;
  nickname: string;
  color: string;
  traits: string[];
}

export const MBTI_DATA: Record<string, MBTIInfo> = {
  INTJ: { type: "INTJ", group: "NT", groupName: "分析家", nickname: "建筑师", color: "#4F7FFF", traits: ["战略性", "独立", "有决心", "高标准"] },
  INTP: { type: "INTP", group: "NT", groupName: "分析家", nickname: "逻辑学家", color: "#4F7FFF", traits: ["创新", "好奇", "逻辑思维", "灵活"] },
  ENTJ: { type: "ENTJ", group: "NT", groupName: "分析家", nickname: "指挥官", color: "#4F7FFF", traits: ["果断", "领导力", "高效", "战略"] },
  ENTP: { type: "ENTP", group: "NT", groupName: "分析家", nickname: "辩论家", color: "#4F7FFF", traits: ["辩证", "创意", "敏锐", "挑战规则"] },
  INFJ: { type: "INFJ", group: "NF", groupName: "外交家", nickname: "提倡者", color: "#10B981", traits: ["洞察力", "原则性", "利他", "创造性"] },
  INFP: { type: "INFP", group: "NF", groupName: "外交家", nickname: "调停者", color: "#10B981", traits: ["理想主义", "共情", "忠诚", "创意"] },
  ENFJ: { type: "ENFJ", group: "NF", groupName: "外交家", nickname: "主人公", color: "#10B981", traits: ["有魅力", "利他", "鼓励他人", "组织协调"] },
  ENFP: { type: "ENFP", group: "NF", groupName: "外交家", nickname: "活动家", color: "#10B981", traits: ["热情", "创意", "社交", "灵感驱动"] },
  ISTJ: { type: "ISTJ", group: "SJ", groupName: "守护者", nickname: "物流师", color: "#F59E0B", traits: ["可靠", "细心", "尽职", "传统"] },
  ISFJ: { type: "ISFJ", group: "SJ", groupName: "守护者", nickname: "守卫者", color: "#F59E0B", traits: ["奉献", "耐心", "细致", "支持他人"] },
  ESTJ: { type: "ESTJ", group: "SJ", groupName: "守护者", nickname: "总经理", color: "#F59E0B", traits: ["果断", "尽责", "组织", "守序"] },
  ESFJ: { type: "ESFJ", group: "SJ", groupName: "守护者", nickname: "执政官", color: "#F59E0B", traits: ["关爱", "社交", "忠诚", "传统"] },
  ISTP: { type: "ISTP", group: "SP", groupName: "探险家", nickname: "鉴赏家", color: "#EF4444", traits: ["务实", "独立", "分析", "灵活"] },
  ISFP: { type: "ISFP", group: "SP", groupName: "探险家", nickname: "探险家", color: "#EF4444", traits: ["开放", "感性", "艺术", "冒险"] },
  ESTP: { type: "ESTP", group: "SP", groupName: "探险家", nickname: "企业家", color: "#EF4444", traits: ["大胆", "直接", "善于交际", "实用"] },
  ESFP: { type: "ESFP", group: "SP", groupName: "探险家", nickname: "表演者", color: "#EF4444", traits: ["热情", "友好", "自发", "娱乐精神"] },
};

// ─── 原始分计算 ────────────────────────────────────────────────────────

export function computeRawScores(data: {
  sessions: Array<{
    taskName: string; category: string;
    startTime: Date; endTime: Date; duration: number;
    evalTag?: string; tags?: string[];
  }>;
  ideas: Array<{
    title: string; stage: string; createdAt: string;
    evaluation: { score: number | null; impact: number | null; feasibility: number | null };
    totalTimeSpent: number;
  }>;
  longTasks: Array<{ name: string; elapsed: number }>;
}): AttributeScores {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const todaySess = data.sessions.filter(s => s.endTime >= todayStart);
  const weekSess  = data.sessions.filter(s => s.endTime >= weekAgo);

  // ── 执行力：今日工作学习时长 / 6小时目标 ──
  const productiveToday = todaySess
    .filter(s => s.category === "工作" || s.category === "学习")
    .reduce((sum, s) => sum + s.duration, 0);
  const execution = Math.min(100, Math.round((productiveToday / (6 * 3600)) * 100));

  // ── 创造力：近月点子数 + 高影响力点子 ──
  const activeIdeas = data.ideas.filter(i => i.stage !== "archived" && new Date(i.createdAt) >= monthAgo);
  const ideaBase = Math.min(60, activeIdeas.length * 6);
  const highImpact = activeIdeas.filter(i => i.evaluation?.impact && i.evaluation.impact >= 4).length;
  const ideaTime = data.ideas.reduce((sum, i) => sum + (i.totalTimeSpent || 0), 0);
  const creativity = Math.min(100, Math.round(ideaBase + highImpact * 8 + Math.min(20, ideaTime / 7200)));

  // ── 专注力：周内长 session (>45分钟) 占比 ──
  const weekWork = weekSess.filter(s => s.category === "工作" || s.category === "学习");
  const longSess  = weekWork.filter(s => s.duration >= 45 * 60);
  const avgDuration = weekWork.length > 0
    ? weekWork.reduce((sum, s) => sum + s.duration, 0) / weekWork.length
    : 0;
  const focusFromProp = weekWork.length > 0 ? (longSess.length / weekWork.length) * 70 : 35;
  const focusFromAvg  = Math.min(30, (avgDuration / (90 * 60)) * 30);
  const focus = Math.min(100, Math.round(focusFromProp + focusFromAvg));

  // ── 自控力：今日娱乐/应用桶 时长反比 ──
  const totalToday = todaySess.reduce((sum, s) => sum + s.duration, 0);
  const entertainToday = todaySess
    .filter(s => s.category === "娱乐" || s.tags?.includes("_bucket"))
    .reduce((sum, s) => sum + s.duration, 0);
  const entRatio = totalToday > 0 ? entertainToday / totalToday : 0;
  const selfControl = Math.max(10, Math.min(100, Math.round(100 - entRatio * 140)));

  // ── 求知欲：周内学习时长 / 10小时目标 ──
  const learnWeek = weekSess.filter(s => s.category === "学习").reduce((sum, s) => sum + s.duration, 0);
  const curiosity = Math.min(100, Math.round((learnWeek / (10 * 3600)) * 100));

  // ── 抗压性：周内工作学习活跃天数 / 7 ──
  const activeDates = new Set(
    weekSess
      .filter(s => s.category === "工作" || s.category === "学习")
      .map(s => s.endTime.toDateString())
  );
  const longTaskBonus = Math.min(15, data.longTasks.reduce((sum, t) => sum + Math.min(5, t.elapsed / 3600), 0));
  const resilience = Math.min(100, Math.round((activeDates.size / 7) * 85 + longTaskBonus));

  return { execution, creativity, focus, selfControl, curiosity, resilience };
}

// ─── EMA 更新 ─────────────────────────────────────────────────────────

export function updateEMA(prev: AttributeScores, raw: AttributeScores): AttributeScores {
  const result = {} as AttributeScores;
  for (const meta of ATTRIBUTE_META) {
    const k = meta.key;
    result[k] = Math.round(meta.alpha * raw[k] + (1 - meta.alpha) * prev[k]);
  }
  return result;
}

// ─── 特质标签生成 ──────────────────────────────────────────────────────

export function computeTraitTags(data: {
  sessions: Array<{ category: string; startTime: Date; endTime: Date; duration: number; tags?: string[] }>;
  ideas: Array<{ stage: string; evaluation: { score: number | null } }>;
  longTasks: Array<{ elapsed: number }>;
}): TraitTag[] {
  const now = new Date();
  const todayStr = now.toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const tags: TraitTag[] = [];
  const earnedAt = now.toISOString();

  // 按日期分组 sessions
  const byDate: Record<string, typeof data.sessions> = {};
  data.sessions.forEach(s => {
    const d = s.endTime.toDateString();
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
  });

  // 晨曦守望者：连续5天有8点前开始的记录
  const earlyDays = Object.keys(byDate).filter(d =>
    byDate[d].some(s => s.startTime.getHours() < 8)
  );
  if (earlyDays.length >= 5) {
    tags.push({ id: "early_bird", name: "晨曦守望者", color: "#F59E0B",
      description: `连续早起超过 ${earlyDays.length} 天，7点前已开始工作`, type: "habit", earnedAt });
  }

  // 夜行生物：连续5天有23点后的娱乐/桶记录
  const nightDays = Object.keys(byDate).filter(d =>
    byDate[d].some(s => s.endTime.getHours() >= 23 && (s.category === "娱乐" || s.tags?.includes("_bucket")))
  );
  if (nightDays.length >= 5) {
    tags.push({ id: "night_owl", name: "夜行生物", color: "#8B5CF6",
      description: `深夜刷手机超过 ${nightDays.length} 次，注意睡眠质量`, type: "quirk", earnedAt });
  }

  // 深度专注者：有过单次 ≥ 120 分钟的工作记录
  const ultraFocus = data.sessions.filter(s =>
    (s.category === "工作" || s.category === "学习") && s.duration >= 120 * 60
  );
  if (ultraFocus.length >= 3) {
    tags.push({ id: "deep_focus", name: "深度专注者", color: "#10B981",
      description: `完成过 ${ultraFocus.length} 次超过 2 小时的深度工作`, type: "achievement", earnedAt });
  }

  // 点子机器：创建了 10 个以上点子
  const activeIdeas = data.ideas.filter(i => i.stage !== "archived");
  if (activeIdeas.length >= 10) {
    tags.push({ id: "idea_machine", name: "点子机器", color: "#A855F7",
      description: `已积累 ${activeIdeas.length} 个点子，创意爆棚`, type: "achievement", earnedAt });
  }

  // 学海无涯：本月学习时长 > 20 小时
  const monthLearn = data.sessions
    .filter(s => s.category === "学习" && s.endTime >= monthAgo)
    .reduce((sum, s) => sum + s.duration, 0);
  if (monthLearn >= 20 * 3600) {
    tags.push({ id: "scholar", name: "学海无涯", color: "#06B6D4",
      description: `本月学习时长 ${(monthLearn / 3600).toFixed(1)} 小时`, type: "achievement", earnedAt });
  }

  // 长线布局：有长线任务累计 > 10 小时
  const heavyLong = data.longTasks.filter(t => t.elapsed >= 10 * 3600);
  if (heavyLong.length > 0) {
    tags.push({ id: "long_game", name: "长线布局者", color: "#EF4444",
      description: `${heavyLong.length} 个长线任务投入超过 10 小时`, type: "habit", earnedAt });
  }

  // 全力冲刺：今天工作学习 > 8 小时
  const todaySess = data.sessions.filter(s => s.endTime.toDateString() === todayStr);
  const todayProd = todaySess.filter(s => s.category === "工作" || s.category === "学习")
    .reduce((sum, s) => sum + s.duration, 0);
  if (todayProd >= 8 * 3600) {
    tags.push({ id: "full_sprint", name: "全力冲刺", color: "#4F7FFF",
      description: `今日工作学习超过 ${(todayProd / 3600).toFixed(1)} 小时，十分拼搏`, type: "achievement", earnedAt });
  }

  // 连续打卡：过去7天每天都有工作学习记录
  const weekDays = Object.keys(byDate).filter(d => {
    const date = new Date(d);
    return date >= weekAgo && byDate[d].some(s => s.category === "工作" || s.category === "学习");
  });
  if (weekDays.length >= 7) {
    tags.push({ id: "streak_7", name: "七日连击", color: "#F97316",
      description: "连续 7 天保持工作学习记录，自律超群", type: "achievement", earnedAt });
  }

  return tags;
}
