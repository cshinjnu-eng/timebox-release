import { useState, useRef } from "react";
import { Plus, Trash2, Pencil, X, Check, Boxes, ChevronDown, ChevronRight, Info, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp, CATEGORIES, AppBucket, getCategoryInfo } from "../context/AppContext";

const BUCKET_COLORS = [
  "#4F7FFF", "#A855F7", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#F97316",
];

interface BucketFormData {
  name: string;
  apps: string;
  category: string;
  triggerMinutes: number;
  toleranceSeconds: number;
  color: string;
}

const DEFAULT_FORM: BucketFormData = {
  name: "",
  apps: "",
  category: "娱乐",
  triggerMinutes: 5,
  toleranceSeconds: 60,
  color: "#A855F7",
};

// ─── App 名称 Chip 输入 + 自动补全 ────────────────────────────────────
function AppChipInput({ apps, onChange }: { apps: string[]; onChange: (apps: string[]) => void }) {
  const { recentAppNames } = useApp();
  const [input, setInput] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = recentAppNames.filter(
    (n) => n.toLowerCase().includes(input.toLowerCase()) && !apps.includes(n)
  ).slice(0, 8);

  function addApp(name: string) {
    const trimmed = name.trim();
    if (trimmed && !apps.includes(trimmed)) onChange([...apps, trimmed]);
    setInput("");
    setShowDrop(false);
    inputRef.current?.focus();
  }

  function removeApp(name: string) {
    onChange(apps.filter((a) => a !== name));
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 px-3 py-2 rounded-lg min-h-10 cursor-text"
        style={{ background: "#0B0D14", border: "1px solid #252836" }}
        onClick={() => inputRef.current?.focus()}
      >
        {apps.map((app) => (
          <span key={app} className="flex items-center gap-1 px-2 py-0.5 rounded-md" style={{ background: "#252836", color: "#C4C8E0", fontSize: 12 }}>
            {app}
            <button onClick={() => removeApp(app)} style={{ color: "#8B8FA8", lineHeight: 1 }}><X size={10} /></button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && input.trim()) { e.preventDefault(); addApp(input); }
            if (e.key === "Backspace" && !input && apps.length > 0) removeApp(apps[apps.length - 1]);
          }}
          placeholder={apps.length === 0 ? "输入 App 名称，回车添加..." : ""}
          className="outline-none flex-1 min-w-20 bg-transparent"
          style={{ color: "#E8EAF0", fontSize: 13 }}
        />
      </div>
      {/* Autocomplete dropdown */}
      {showDrop && (suggestions.length > 0 || (input.trim() && !apps.includes(input.trim()))) && (
        <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10" style={{ background: "#1A1D29", border: "1px solid #252836", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
          {suggestions.map((s) => (
            <button
              key={s}
              onMouseDown={() => addApp(s)}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[#252836] transition-colors"
              style={{ color: "#C4C8E0" }}
            >
              <Search size={12} style={{ color: "#525675", flexShrink: 0 }} />
              {s}
            </button>
          ))}
          {input.trim() && !apps.includes(input.trim()) && !suggestions.includes(input.trim()) && (
            <button
              onMouseDown={() => addApp(input)}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2"
              style={{ color: "#4F7FFF", borderTop: suggestions.length > 0 ? "1px solid #252836" : "none" }}
            >
              <Plus size={12} />
              添加「{input.trim()}」
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BucketForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: BucketFormData;
  onSave: (data: BucketFormData) => void;
  onCancel: () => void;
}) {
  const initialApps = initial?.apps ? initial.apps.split(/[,，]/).map(a => a.trim()).filter(Boolean) : [];
  const [form, setForm] = useState<BucketFormData>(initial ?? DEFAULT_FORM);
  const [chipApps, setChipApps] = useState<string[]>(initialApps);

  // Allow any category name including custom
  const allCategories = [...CATEGORIES.map(c => c.name), "娱乐", "社交"].filter((v, i, a) => a.indexOf(v) === i);

  function handleSave() {
    if (form.name.trim()) onSave({ ...form, apps: chipApps.join(", ") });
  }

  return (
    <div className="rounded-xl p-4 flex flex-col gap-4" style={{ background: "#161820", border: "1px solid #252836" }}>
      {/* Name */}
      <div>
        <label style={{ fontSize: 12, color: "#8B8FA8", display: "block", marginBottom: 5, fontWeight: 600 }}>桶名称</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="如：娱乐、社交、学习"
          className="w-full px-3 py-2 rounded-lg outline-none"
          style={{ background: "#0B0D14", border: "1px solid #252836", color: "#E8EAF0", fontSize: 14 }}
        />
      </div>

      {/* Apps - chip input with autocomplete */}
      <div>
        <label style={{ fontSize: 12, color: "#8B8FA8", display: "block", marginBottom: 5, fontWeight: 600 }}>
          包含 App
        </label>
        <AppChipInput apps={chipApps} onChange={setChipApps} />
        <p style={{ fontSize: 11, color: "#525675", marginTop: 4 }}>
          输入名称回车添加，或从最近使用的 App 中选择
        </p>
      </div>

      {/* Category */}
      <div>
        <label style={{ fontSize: 12, color: "#8B8FA8", display: "block", marginBottom: 5, fontWeight: 600 }}>映射分类</label>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((c) => {
            const info = getCategoryInfo(c);
            return (
              <button
                key={c}
                onClick={() => setForm({ ...form, category: c })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: form.category === c ? info.bg : "#1A1D29",
                  color: form.category === c ? info.color : "#8B8FA8",
                  border: `1px solid ${form.category === c ? info.color + "44" : "#252836"}`,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thresholds */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={{ fontSize: 12, color: "#8B8FA8", display: "block", marginBottom: 5, fontWeight: 600 }}>
            触发阈值（分钟）
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={form.triggerMinutes}
            onChange={(e) => setForm({ ...form, triggerMinutes: parseInt(e.target.value) || 5 })}
            className="w-full px-3 py-2 rounded-lg outline-none"
            style={{ background: "#0B0D14", border: "1px solid #252836", color: "#E8EAF0", fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#8B8FA8", display: "block", marginBottom: 5, fontWeight: 600 }}>
            中断容忍（秒）
          </label>
          <input
            type="number"
            min={10}
            max={300}
            value={form.toleranceSeconds}
            onChange={(e) => setForm({ ...form, toleranceSeconds: parseInt(e.target.value) || 60 })}
            className="w-full px-3 py-2 rounded-lg outline-none"
            style={{ background: "#0B0D14", border: "1px solid #252836", color: "#E8EAF0", fontSize: 14 }}
          />
        </div>
      </div>

      {/* Color */}
      <div>
        <label style={{ fontSize: 12, color: "#8B8FA8", display: "block", marginBottom: 5, fontWeight: 600 }}>颜色</label>
        <div className="flex gap-2">
          {BUCKET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setForm({ ...form, color: c })}
              className="rounded-full flex items-center justify-center"
              style={{ width: 26, height: 26, background: c, border: `2px solid ${form.color === c ? "#fff" : "transparent"}` }}
            >
              {form.color === c && <Check size={12} color="#fff" />}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm" style={{ background: "#252836", color: "#8B8FA8" }}>取消</button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: form.name.trim() ? form.color : "#252836", color: form.name.trim() ? "#fff" : "#525675" }}
        >
          保存
        </button>
      </div>
    </div>
  );
}

function BucketCard({ bucket }: { bucket: AppBucket }) {
  const { updateBucket, deleteBucket } = useApp();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cat = getCategoryInfo(bucket.category);

  if (editing) {
    return (
      <BucketForm
        initial={{ name: bucket.name, apps: bucket.apps.join(", "), category: bucket.category, triggerMinutes: bucket.triggerMinutes, toleranceSeconds: bucket.toleranceSeconds, color: bucket.color }}
        onSave={(data) => {
          updateBucket({ ...bucket, name: data.name.trim(), apps: data.apps.split(/[,，]/).map(a => a.trim()).filter(Boolean), category: data.category, triggerMinutes: data.triggerMinutes, toleranceSeconds: data.toleranceSeconds, color: data.color  });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#161820", border: "1px solid #252836" }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="rounded-lg flex-shrink-0" style={{ width: 10, height: 10, background: bucket.color, borderRadius: 9999, marginTop: 1 }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14, fontWeight: 600, color: "#E8EAF0" }}>{bucket.name}</span>
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: cat.bg, color: cat.color }}>{bucket.category}</span>
          </div>
          <p style={{ fontSize: 11, color: "#525675", marginTop: 2 }}>
            ≥{bucket.triggerMinutes}分钟触发 · 容忍{bucket.toleranceSeconds}秒中断 · {bucket.apps.length}个App
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg" style={{ color: "#525675" }}>
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg" style={{ color: "#525675" }}>
            <Pencil size={14} />
          </button>
          <button onClick={() => deleteBucket(bucket.id)} className="p-1.5 rounded-lg" style={{ color: "#525675" }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid #1A1D29" }}>
              <p style={{ fontSize: 11, color: "#525675", width: "100%", paddingTop: 8, marginBottom: 4 }}>包含 App：</p>
              {bucket.apps.map((app) => (
                <span key={app} className="px-2 py-0.5 rounded-md text-xs" style={{ background: "#252836", color: "#A0A3B8" }}>{app}</span>
              ))}
              {bucket.apps.length === 0 && <span style={{ fontSize: 12, color: "#525675" }}>暂无 App</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppBucketsPage() {
  const { appBuckets, addBucket } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="flex items-center gap-2" style={{ fontSize: 18, fontWeight: 700, color: "#E8EAF0" }}>
              <Boxes size={18} style={{ color: "#F59E0B" }} />
              应用桶
            </h1>
            <p style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
              自动检测 App 使用并提示计时
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInfo(!showInfo)} className="p-2 rounded-lg" style={{ color: "#525675" }}>
              <Info size={16} />
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", fontSize: 13, fontWeight: 600 }}
            >
              <Plus size={15} />
              新建桶
            </button>
          </div>
        </div>

        {/* Info card */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-xl p-4" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                <div className="flex items-start gap-2">
                  <Info size={14} style={{ color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: "#8B8FA8", lineHeight: 1.7 }}>
                    <p className="font-semibold mb-1" style={{ color: "#F59E0B" }}>工作原理</p>
                    <p>• 将同类 App 归入一个桶，系统每30秒检测一次屏幕使用记录</p>
                    <p>• 当桶内 App 的<b style={{ color: "#E8EAF0" }}>连续使用时间</b>达到触发阈值，弹出确认提示</p>
                    <p>• <b style={{ color: "#E8EAF0" }}>中断容忍</b>：切出去回了条微信（短于容忍时间），不打断连续计算</p>
                    <p>• 点击确认后自动补齐前面这段时间并开始计时</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add form */}
        {showAddForm && (
          <div className="mb-4">
            <BucketForm
              onSave={(data) => {
                addBucket({ name: data.name.trim(), apps: data.apps.split(/[,，]/).map(a => a.trim()).filter(Boolean), category: data.category, triggerMinutes: data.triggerMinutes, toleranceSeconds: data.toleranceSeconds, color: data.color  });
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        {/* Bucket list */}
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {appBuckets.map((bucket) => (
              <motion.div key={bucket.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                <BucketCard bucket={bucket} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {appBuckets.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={{ border: "1.5px dashed #252836", color: "#8B8FA8" }}>
            <Boxes size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ fontSize: 14 }}>还没有应用桶</p>
            <p style={{ fontSize: 12, color: "#525675", marginTop: 4, textAlign: "center", maxWidth: 220 }}>
              创建一个桶，把同类 App 放进去，系统会自动检测使用时长
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm"
              style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}
            >
              + 新建第一个桶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
