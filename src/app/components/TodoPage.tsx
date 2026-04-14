import { useState } from "react";
import {
  Plus,
  CheckCircle2,
  Circle,
  ClipboardList,
  Archive,
  ArchiveX,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  useApp,
  getCategoryInfo,
  CATEGORIES,
  TodoItem,
} from "../context/AppContext";

function PriorityDot({ priority }: { priority: "high" | "medium" | "low" }) {
  const colors = { high: "#EF4444", medium: "#F59E0B", low: "#10B981" };
  return (
    <span
      className="rounded-full inline-block flex-shrink-0"
      style={{ width: 7, height: 7, background: colors[priority] }}
    />
  );
}

function TodoRow({ item, showArchive }: { item: TodoItem; showArchive?: boolean }) {
  const { toggleTodo, archiveTodo, unarchiveTodo } = useApp();
  const cat = getCategoryInfo(item.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: "#161820", border: "1px solid #252836" }}
    >
      <button onClick={() => toggleTodo(item.id)} className="flex-shrink-0">
        {item.completed ? (
          <CheckCircle2 size={20} style={{ color: "#10B981" }} />
        ) : (
          <Circle size={20} style={{ color: "#525675" }} />
        )}
      </button>
      <span
        className="flex-1 text-sm"
        style={{
          color: item.archived ? "#3A3D50" : item.completed ? "#525675" : "#C4C8E0",
          textDecoration: item.completed ? "line-through" : "none",
        }}
      >
        {item.text}
      </span>
      <div className="flex items-center gap-2">
        <PriorityDot priority={item.priority} />
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: cat.bg, color: cat.color }}
        >
          {item.category}
        </span>
        {item.archived ? (
          <button
            onClick={() => unarchiveTodo(item.id)}
            title="取消归档"
            className="rounded-md p-1 transition-colors"
            style={{ color: "#525675" }}
          >
            <ArchiveX size={14} />
          </button>
        ) : (
          showArchive && item.completed && (
            <button
              onClick={() => archiveTodo(item.id)}
              title="归档"
              className="rounded-md p-1 transition-colors"
              style={{ color: "#525675" }}
            >
              <Archive size={14} />
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}

export function TodoPage() {
  const { todos, addTodo } = useApp();
  const [todoFilter, setTodoFilter] = useState("全部");
  const [showInput, setShowInput] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("工作");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [showArchived, setShowArchived] = useState(false);

  const activeTodos = todos.filter((t) => !t.archived);
  const archivedTodos = todos.filter((t) => t.archived);

  const filteredTodos =
    todoFilter === "全部"
      ? activeTodos
      : todoFilter === "未完成"
      ? activeTodos.filter((t) => !t.completed)
      : todoFilter === "已完成"
      ? activeTodos.filter((t) => t.completed)
      : activeTodos.filter((t) => t.category === todoFilter);

  const completedCount = activeTodos.filter((t) => t.completed).length;

  function handleAdd() {
    if (!newText.trim()) return;
    addTodo(newText.trim(), newCategory, newPriority);
    setNewText("");
    setShowInput(false);
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1
              className="flex items-center gap-2"
              style={{ fontSize: 18, fontWeight: 700, color: "#E8EAF0" }}
            >
              <ClipboardList size={18} style={{ color: "#4F7FFF" }} />
              待办事项
            </h1>
            <p style={{ fontSize: 13, color: "#8B8FA8", marginTop: 2 }}>
              <span className="tb-mono">{completedCount}/{activeTodos.length}</span> 已完成
            </p>
          </div>
          <button
            onClick={() => setShowInput(!showInput)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2"
            style={{
              background: "rgba(79,127,255,0.12)",
              color: "#4F7FFF",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Plus size={15} />
            添加
          </button>
        </div>

        {/* Progress bar */}
        <div className="rounded-full mb-4 overflow-hidden" style={{ height: 4, background: "#1A1D29" }}>
          <div
            className="rounded-full"
            style={{
              height: "100%",
              width: `${activeTodos.length > 0 ? (completedCount / activeTodos.length) * 100 : 0}%`,
              background: "linear-gradient(90deg, #4F7FFF, #10B981)",
              boxShadow: "0 0 8px rgba(79, 127, 255, 0.3)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Quick add input */}
        {showInput && (
          <div
            className="p-3 rounded-xl mb-4 flex flex-col gap-2"
            style={{ background: "#161820", border: "1px solid #252836" }}
          >
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="输入待办事项..."
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "#1A1D29", border: "1px solid #252836", color: "#E8EAF0", outline: "none" }}
              autoFocus
            />
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORIES.slice(0, 4).map((c) => (
                <button
                  key={c.name}
                  onClick={() => setNewCategory(c.name)}
                  className="px-2 py-1 rounded-md text-xs"
                  style={{
                    background: newCategory === c.name ? c.bg : "#1A1D29",
                    color: newCategory === c.name ? c.color : "#8B8FA8",
                    border: `1px solid ${newCategory === c.name ? c.color + "44" : "#252836"}`,
                  }}
                >
                  {c.name}
                </button>
              ))}
              <div className="flex-1" />
              {(["high", "medium", "low"] as const).map((p) => {
                const labels = { high: "高", medium: "中", low: "低" };
                const colors = { high: "#EF4444", medium: "#F59E0B", low: "#10B981" };
                return (
                  <button
                    key={p}
                    onClick={() => setNewPriority(p)}
                    className="px-2 py-1 rounded-md text-xs"
                    style={{
                      background: newPriority === p ? colors[p] + "22" : "#1A1D29",
                      color: newPriority === p ? colors[p] : "#8B8FA8",
                      border: `1px solid ${newPriority === p ? colors[p] + "44" : "#252836"}`,
                    }}
                  >
                    {labels[p]}
                  </button>
                );
              })}
              <button
                onClick={handleAdd}
                className="px-3 py-1 rounded-lg text-xs font-semibold"
                style={{ background: "#4F7FFF", color: "#fff" }}
              >
                确认
              </button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div
          className="flex gap-1 p-1 rounded-lg mb-4 flex-wrap"
          style={{ background: "#161820" }}
        >
          {["全部", "未完成", "已完成"].map((f) => (
            <button
              key={f}
              onClick={() => setTodoFilter(f)}
              className="px-3 py-1.5 rounded-md transition-all text-xs"
              style={{
                background: todoFilter === f ? "#252836" : "transparent",
                color: todoFilter === f ? "#E8EAF0" : "#8B8FA8",
                fontWeight: todoFilter === f ? 600 : 400,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Todo list */}
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {filteredTodos.map((item) => (
              <TodoRow key={item.id} item={item} showArchive />
            ))}
          </AnimatePresence>
        </div>

        {filteredTodos.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl"
            style={{
              border: "1px dashed #252836",
              color: "#8B8FA8",
              marginTop: 8,
              background: "radial-gradient(ellipse at center, rgba(79, 127, 255, 0.03) 0%, transparent 70%)",
            }}
          >
            <CheckCircle2 size={36} style={{ marginBottom: 12, opacity: 0.3, filter: "drop-shadow(0 0 8px rgba(79, 127, 255, 0.15))" }} />
            <p style={{ fontSize: 14 }}>暂无待办事项</p>
            <button
              onClick={() => setShowInput(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm"
              style={{ background: "rgba(79, 127, 255, 0.10)", color: "#4F7FFF", border: "1px solid rgba(79, 127, 255, 0.15)" }}
            >
              + 添加待办
            </button>
          </div>
        )}

        {/* Archived section */}
        {archivedTodos.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-lg transition-colors"
              style={{ color: "#525675", fontSize: 13 }}
            >
              {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Archive size={13} />
              <span>已归档 ({archivedTodos.length})</span>
            </button>
            <AnimatePresence>
              {showArchived && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-2 mt-2 overflow-hidden"
                >
                  {archivedTodos.map((item) => (
                    <TodoRow key={item.id} item={item} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
