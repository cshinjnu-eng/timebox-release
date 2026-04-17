import { useState, useMemo } from "react";
import {
  User, Sparkles, Brain, Target, ChevronDown, ChevronUp, Check, Pencil, X
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  ATTRIBUTE_META,
  computeRawScores,
  updateEMA,
  DEFAULT_ATTRIBUTES,
  computeTraitTags,
  MBTI_DATA,
  type AttributeScores,
  type TraitTag,
} from "../services/attributes";

// ─── Radar Chart (SVG 六边形) ─────────────────────────────────────────

const N = 6;
const CX = 140, CY = 140, R = 105;
const LEVELS = [0.25, 0.5, 0.75, 1.0];

function radarPoint(i: number, v: number) {
  const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
  const r = (v / 100) * R;
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function levelPoints(level: number) {
  return Array.from({ length: N }, (_, i) => radarPoint(i, level * 100))
    .map(p => `${p.x},${p.y}`)
    .join(" ");
}

function RadarChart({ scores }: { scores: AttributeScores }) {
  const keys = ATTRIBUTE_META.map(m => m.key);
  const dataPoints = keys.map((k, i) => radarPoint(i, scores[k]));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  // axis label positions (slightly outside R)
  const labelR = R + 22;
  const labelPoints = Array.from({ length: N }, (_, i) => {
    const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
    return { x: CX + labelR * Math.cos(angle), y: CY + labelR * Math.sin(angle) };
  });

  return (
    <svg width={280} height={280} viewBox="0 0 280 280">
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4F7FFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.1" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background level polygons */}
      {LEVELS.map((lv, li) => (
        <polygon
          key={li}
          points={levelPoints(lv)}
          fill="none"
          stroke={lv === 1.0 ? "#252836" : "#1E2130"}
          strokeWidth={lv === 1.0 ? 1.5 : 1}
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: N }, (_, i) => {
        const outer = radarPoint(i, 100);
        return (
          <line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y}
            stroke="#252836" strokeWidth={1} />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPath}
        fill="url(#radarFill)"
        stroke="#4F7FFF"
        strokeWidth={2}
        filter="url(#glow)"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4}
          fill={ATTRIBUTE_META[i].color}
          stroke="#0B0D14" strokeWidth={1.5}
          filter="url(#glow)"
        />
      ))}

      {/* Labels */}
      {ATTRIBUTE_META.map((m, i) => {
        const lp = labelPoints[i];
        return (
          <text key={i} x={lp.x} y={lp.y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fontWeight={600} fill={m.color}
          >
            {m.label}
          </text>
        );
      })}

      {/* Score annotations near each point */}
      {dataPoints.map((p, i) => {
        const score = scores[ATTRIBUTE_META[i].key];
        const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
        const off = 14;
        return (
          <text key={i}
            x={p.x + Math.cos(angle) * off}
            y={p.y + Math.sin(angle) * off}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="#8B8FA8" fontFamily="monospace"
          >
            {Math.round(score)}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Trait Tag Badge ──────────────────────────────────────────────────

function TraitBadge({ tag }: { tag: TraitTag }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded(v => !v)}
      className="flex flex-col items-start rounded-xl px-3 py-2 text-left transition-all"
      style={{
        background: `${tag.color}18`,
        border: `1px solid ${tag.color}44`,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: tag.color }}>{tag.name}</span>
      {expanded && (
        <span style={{ fontSize: 10, color: "#8B8FA8", marginTop: 2 }}>{tag.description}</span>
      )}
    </button>
  );
}

// ─── Inline editable field ────────────────────────────────────────────

function EditableField({
  label, value, placeholder, onChange,
}: {
  label: string; value: string; placeholder: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function confirm() {
    onChange(draft.trim());
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between py-2"
      style={{ borderBottom: "1px solid #1E2130" }}>
      <span style={{ fontSize: 12, color: "#8B8FA8", width: 64 }}>{label}</span>
      {editing ? (
        <div className="flex items-center gap-2 flex-1 ml-2">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 13, color: "#E8EAF0", borderBottom: "1px solid #4F7FFF" }}
          />
          <button onClick={confirm}><Check size={14} style={{ color: "#10B981" }} /></button>
          <button onClick={() => setEditing(false)}><X size={14} style={{ color: "#525675" }} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1 ml-2 justify-between">
          <span style={{ fontSize: 13, color: value ? "#E8EAF0" : "#525675" }}>
            {value || placeholder}
          </span>
          <button onClick={() => { setDraft(value); setEditing(true); }}>
            <Pencil size={12} style={{ color: "#525675" }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Big Five Slider ──────────────────────────────────────────────────

const BIG_FIVE_META = [
  { key: "openness" as const,          label: "开放性", en: "Openness",          color: "#A855F7", desc: "对新体验的好奇与接受程度" },
  { key: "conscientiousness" as const, label: "尽责性", en: "Conscientiousness", color: "#4F7FFF", desc: "自律、组织与目标导向" },
  { key: "extraversion" as const,      label: "外向性", en: "Extraversion",       color: "#F59E0B", desc: "从社交中获得能量的程度" },
  { key: "agreeableness" as const,     label: "宜人性", en: "Agreeableness",      color: "#10B981", desc: "合作、信任与利他倾向" },
  { key: "neuroticism" as const,       label: "神经质", en: "Neuroticism",        color: "#EF4444", desc: "情绪波动与压力敏感度" },
];

function BigFiveSlider({
  label, color, desc, value, onChange,
}: {
  label: string; color: string; desc: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
          <span style={{ fontSize: 10, color: "#525675", marginLeft: 6 }}>{desc}</span>
        </div>
        <span className="tb-mono" style={{ fontSize: 12, color, fontWeight: 700 }}>{value}</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded appearance-none outline-none"
        style={{ accentColor: color, background: `linear-gradient(90deg, ${color}88 ${value}%, #252836 ${value}%)` }}
      />
    </div>
  );
}

// ─── MBTI Selector ────────────────────────────────────────────────────

const MBTI_TYPES = Object.keys(MBTI_DATA);

function MBTISelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const info = value ? MBTI_DATA[value] : null;

  const groups = ["NT", "NF", "SJ", "SP"] as const;
  const groupNames: Record<string, string> = { NT: "分析家", NF: "外交家", SJ: "守护者", SP: "探险家" };
  const groupColors: Record<string, string> = { NT: "#4F7FFF", NF: "#10B981", SJ: "#F59E0B", SP: "#EF4444" };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full rounded-xl px-4 py-3"
        style={{ background: "#161820", border: "1px solid #252836" }}
      >
        {info ? (
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded-lg font-bold tb-mono"
              style={{ background: `${info.color}22`, color: info.color, fontSize: 15 }}>
              {info.type}
            </span>
            <div className="text-left">
              <p style={{ fontSize: 13, color: "#E8EAF0", fontWeight: 600 }}>{info.nickname}</p>
              <p style={{ fontSize: 11, color: "#525675" }}>{info.groupName} · {info.group}</p>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "#525675" }}>选择或输入你的 MBTI 类型</span>
        )}
        {open ? <ChevronUp size={16} style={{ color: "#525675" }} /> : <ChevronDown size={16} style={{ color: "#525675" }} />}
      </button>

      {open && (
        <div className="absolute z-20 w-full rounded-xl mt-2 overflow-hidden"
          style={{ background: "#161820", border: "1px solid #252836", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {groups.map(g => (
            <div key={g} className="p-3">
              <p style={{ fontSize: 10, color: groupColors[g], fontWeight: 700, marginBottom: 6 }}>
                {groupNames[g]} ({g})
              </p>
              <div className="flex flex-wrap gap-2">
                {MBTI_TYPES.filter(t => MBTI_DATA[t].group === g).map(t => (
                  <button
                    key={t}
                    onClick={() => { onChange(t); setOpen(false); }}
                    className="px-2 py-1 rounded-lg tb-mono transition-all"
                    style={{
                      fontSize: 12, fontWeight: 700,
                      background: value === t ? `${groupColors[g]}33` : `${groupColors[g]}11`,
                      color: groupColors[g],
                      border: `1px solid ${value === t ? groupColors[g] : groupColors[g] + "33"}`,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="px-3 pb-3">
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs"
              style={{ color: "#525675" }}
            >
              清除选择
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ProfilePage ──────────────────────────────────────────────────

export function ProfilePage() {
  const { sessions, ideas, longTasks, todos, userProfile, updateUserProfile } = useApp();
  const [showBigFive, setShowBigFive] = useState(false);
  const [bigFiveDraft, setBigFiveDraft] = useState(
    userProfile?.bigFive || { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 }
  );

  // ─── Compute live attribute scores ────────────────────────────────
  const rawScores = useMemo(() => computeRawScores({
    sessions: sessions.map(s => ({
      taskName: s.taskName, category: s.category,
      startTime: s.startTime, endTime: s.endTime, duration: s.duration,
      evalTag: s.evalTag, tags: s.tags,
    })),
    ideas: ideas.map(i => ({
      title: i.title, stage: i.stage, createdAt: i.createdAt,
      evaluation: { score: i.evaluation.score, impact: i.evaluation.impact, feasibility: i.evaluation.feasibility },
      totalTimeSpent: i.totalTimeSpent,
    })),
    longTasks: longTasks.map(t => ({ name: t.name, elapsed: t.elapsed })),
  }), [sessions, ideas, longTasks]);

  // EMA-blended display scores
  const displayScores = useMemo((): AttributeScores => {
    const stored = userProfile?.attributes || DEFAULT_ATTRIBUTES;
    return updateEMA(stored, rawScores);
  }, [rawScores, userProfile]);

  // Trait tags
  const traitTags = useMemo(() => computeTraitTags({
    sessions: sessions.map(s => ({
      category: s.category, startTime: s.startTime, endTime: s.endTime,
      duration: s.duration, tags: s.tags,
    })),
    ideas: ideas.map(i => ({ stage: i.stage, evaluation: { score: i.evaluation.score } })),
    longTasks: longTasks.map(t => ({ elapsed: t.elapsed })),
  }), [sessions, ideas, longTasks]);

  // ─── MBTI info display ────────────────────────────────────────────
  const mbtiInfo = userProfile?.mbti ? MBTI_DATA[userProfile.mbti] : null;

  // Save Big Five
  function saveBigFive() {
    updateUserProfile({ bigFive: bigFiveDraft });
    setShowBigFive(false);
  }

  // Total attribute score for summary
  const avgScore = Math.round(
    Object.values(displayScores).reduce((s, v) => s + v, 0) / 6
  );

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-6 mt-2">
        <div className="flex items-center justify-center rounded-2xl flex-shrink-0"
          style={{
            width: 60, height: 60,
            background: mbtiInfo
              ? `linear-gradient(135deg, ${mbtiInfo.color}44, ${mbtiInfo.color}22)`
              : "linear-gradient(135deg, #4F7FFF33, #A855F733)",
            border: `2px solid ${mbtiInfo?.color || "#4F7FFF"}44`,
          }}>
          <User size={28} style={{ color: mbtiInfo?.color || "#4F7FFF" }} />
        </div>
        <div className="flex-1">
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#E8EAF0" }}>
            {userProfile?.name || "我的档案"}
          </h1>
          <p style={{ fontSize: 12, color: "#8B8FA8", marginTop: 2 }}>
            {userProfile?.occupation || "个人属性 · 成长动态追踪"}
          </p>
          {mbtiInfo && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-md tb-mono"
              style={{ fontSize: 11, background: `${mbtiInfo.color}22`, color: mbtiInfo.color, fontWeight: 700 }}>
              {mbtiInfo.type} · {mbtiInfo.nickname}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="tb-mono" style={{ fontSize: 28, fontWeight: 800,
            background: "linear-gradient(135deg, #4F7FFF, #A855F7)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {avgScore}
          </div>
          <div style={{ fontSize: 10, color: "#525675" }}>综合指数</div>
        </div>
      </div>

      {/* ── Radar Chart ── */}
      <div className="rounded-2xl p-4 mb-4"
        style={{ background: "#161820", border: "1px solid #252836" }}>
        <div className="flex items-center gap-2 mb-3">
          <Target size={16} style={{ color: "#4F7FFF" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>六边形战士</span>
          <span style={{ fontSize: 11, color: "#525675", marginLeft: "auto" }}>基于行为数据动态计算</span>
        </div>
        <div className="flex justify-center">
          <RadarChart scores={displayScores} />
        </div>
        {/* Score grid */}
        <div className="grid grid-cols-3 gap-2 mt-1">
          {ATTRIBUTE_META.map(m => (
            <div key={m.key} className="rounded-lg p-2 text-center"
              style={{ background: `${m.color}0F`, border: `1px solid ${m.color}22` }}>
              <div className="tb-mono" style={{ fontSize: 18, fontWeight: 800, color: m.color }}>
                {Math.round(displayScores[m.key])}
              </div>
              <div style={{ fontSize: 10, color: "#8B8FA8" }}>{m.label}</div>
              <div style={{ fontSize: 9, color: "#525675", marginTop: 1 }}>{m.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trait Tags ── */}
      {traitTags.length > 0 && (
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: "#161820", border: "1px solid #252836" }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} style={{ color: "#A855F7" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>特质标签</span>
            <span style={{ fontSize: 11, color: "#525675", marginLeft: "auto" }}>点击查看详情</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {traitTags.map(t => <TraitBadge key={t.id} tag={t} />)}
          </div>
        </div>
      )}

      {/* ── MBTI ── */}
      <div className="rounded-2xl p-4 mb-4"
        style={{ background: "#161820", border: "1px solid #252836" }}>
        <div className="flex items-center gap-2 mb-3">
          <Brain size={16} style={{ color: "#10B981" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>MBTI 人格</span>
        </div>
        <MBTISelector
          value={userProfile?.mbti || ""}
          onChange={v => updateUserProfile({ mbti: v || undefined })}
        />
        {mbtiInfo && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mbtiInfo.traits.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-full"
                style={{ fontSize: 11, background: `${mbtiInfo.color}15`, color: mbtiInfo.color }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Big Five ── */}
      <div className="rounded-2xl p-4 mb-4"
        style={{ background: "#161820", border: "1px solid #252836" }}>
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setShowBigFive(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Brain size={16} style={{ color: "#06B6D4" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>大五人格 (OCEAN)</span>
            {userProfile?.bigFive && (
              <span className="px-1.5 py-0.5 rounded text-xs"
                style={{ background: "#10B98122", color: "#10B981" }}>已设置</span>
            )}
          </div>
          {showBigFive
            ? <ChevronUp size={16} style={{ color: "#525675" }} />
            : <ChevronDown size={16} style={{ color: "#525675" }} />}
        </button>

        {showBigFive && (
          <div className="mt-4">
            <p style={{ fontSize: 11, color: "#525675", marginBottom: 12 }}>
              从 16personalities / OCEAN 测试导入你的得分（0–100）
            </p>
            {BIG_FIVE_META.map(m => (
              <BigFiveSlider
                key={m.key}
                label={m.label} color={m.color} desc={m.desc}
                value={bigFiveDraft[m.key]}
                onChange={v => setBigFiveDraft(prev => ({ ...prev, [m.key]: v }))}
              />
            ))}
            <div className="flex gap-2 mt-3">
              <button
                onClick={saveBigFive}
                className="flex-1 rounded-xl py-2 font-semibold"
                style={{ background: "linear-gradient(135deg, #4F7FFF, #A855F7)", color: "#fff", fontSize: 13 }}
              >
                保存
              </button>
              <button
                onClick={() => setShowBigFive(false)}
                className="px-4 rounded-xl py-2"
                style={{ background: "#252836", color: "#8B8FA8", fontSize: 13 }}
              >
                取消
              </button>
            </div>

            {/* Big Five → OCEAN 映射说明 */}
            {userProfile?.bigFive && (
              <div className="mt-4 rounded-xl p-3"
                style={{ background: "#0B0D14", border: "1px solid #1E2130" }}>
                <p style={{ fontSize: 11, color: "#525675", marginBottom: 6 }}>已记录 → 属性影响参考</p>
                {BIG_FIVE_META.map(m => (
                  <div key={m.key} className="flex items-center gap-2 mb-1.5">
                    <div className="rounded h-1.5 flex-1"
                      style={{ background: `linear-gradient(90deg, ${m.color} ${userProfile.bigFive![m.key]}%, #252836 0%)` }} />
                    <span style={{ fontSize: 10, color: m.color, width: 40, textAlign: "right" }}>
                      {m.label} {userProfile.bigFive![m.key]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Basic Info ── */}
      <div className="rounded-2xl p-4 mb-4"
        style={{ background: "#161820", border: "1px solid #252836" }}>
        <div className="flex items-center gap-2 mb-3">
          <User size={16} style={{ color: "#8B8FA8" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#E8EAF0" }}>基础信息</span>
        </div>
        <EditableField label="姓名" value={userProfile?.name || ""} placeholder="填写你的名字"
          onChange={v => updateUserProfile({ name: v })} />
        <EditableField label="职业" value={userProfile?.occupation || ""} placeholder="填写你的职业/身份"
          onChange={v => updateUserProfile({ occupation: v })} />
        <EditableField label="生日" value={userProfile?.birthday || ""} placeholder="YYYY-MM-DD"
          onChange={v => updateUserProfile({ birthday: v })} />
      </div>

      {/* ── Attribute Legend ── */}
      <div className="rounded-2xl p-4"
        style={{ background: "#0F1018", border: "1px solid #1A1D2E" }}>
        <p style={{ fontSize: 11, color: "#525675", marginBottom: 8 }}>属性计算说明（EMA 时间衰减）</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ATTRIBUTE_META.map(m => (
            <div key={m.key} className="flex items-center gap-1.5">
              <div className="rounded-full flex-shrink-0"
                style={{ width: 6, height: 6, background: m.color }} />
              <span style={{ fontSize: 10, color: "#525675" }}>
                <span style={{ color: m.color }}>{m.label}</span>：{m.description}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10, color: "#3A3D52", marginTop: 8 }}>
          每日行为数据通过指数移动平均（EMA）更新，α 值因属性稳定性不同而异
        </p>
      </div>
    </div>
  );
}
