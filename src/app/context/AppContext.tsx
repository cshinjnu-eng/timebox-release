import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

// ─── 定性标签（五选一） ────────────────────────────────────────────────
export const CATEGORIES = [
  { name: "工作", color: "#4F7FFF", bg: "rgba(79,127,255,0.15)", label: "Work" },
  { name: "学习", color: "#A855F7", bg: "rgba(168,85,247,0.15)", label: "Study" },
  { name: "生活", color: "#10B981", bg: "rgba(16,185,129,0.15)", label: "Life" },
  { name: "琐事", color: "#F59E0B", bg: "rgba(245,158,11,0.15)", label: "Chores" },
  { name: "睡觉", color: "#06B6D4", bg: "rgba(6,182,212,0.15)", label: "Sleep" },
];

// ─── 评估标签（四选一） ────────────────────────────────────────────────
export const EVAL_TAGS = [
  { label: "必须/有意义", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  { label: "必须/没意义", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  { label: "不必须/有意义", color: "#A855F7", bg: "rgba(168,85,247,0.12)" },
  { label: "不必须/没意义", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
];

export function getCategoryInfo(name: string) {
  return CATEGORIES.find((c) => c.name === name) || CATEGORIES[0];
}

export function getEvalTagInfo(label: string) {
  return EVAL_TAGS.find((e) => e.label === label) || null;
}

// ─── 数据模型 ─────────────────────────────────────────────────────────
export interface Task {
  id: string;
  name: string;
  description?: string;
  category: string;        // 定性标签
  evalTag?: string;        // 评估标签
  color: string;
  bgColor: string;
  startTime: Date;
  elapsed: number;         // seconds
  isRunning: boolean;
  tags: string[];          // 自定义标签
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
  category: string;
}

export interface WorkSession {
  id: string;
  taskName: string;
  category: string;        // 定性标签
  evalTag?: string;        // 评估标签
  color: string;
  startTime: Date;
  endTime: Date;
  duration: number;        // seconds
  feeling?: string;        // 完成感受
  tags: string[];          // 自定义标签
}

interface AppContextType {
  tasks: Task[];
  todos: TodoItem[];
  sessions: WorkSession[];
  addTask: (data: {
    name: string;
    description?: string;
    category: string;
    evalTag?: string;
    tags: string[];
  }) => void;
  endTask: (id: string, feeling?: string) => void;
  toggleTimer: (id: string) => void;
  toggleTodo: (id: string) => void;
  addTodo: (text: string, category: string, priority: "high" | "medium" | "low") => void;
  showNewTaskDialog: boolean;
  setShowNewTaskDialog: (v: boolean) => void;
  showEndTaskDialog: boolean;
  setShowEndTaskDialog: (v: boolean) => void;
  taskToEnd: Task | null;
  setTaskToEnd: (t: Task | null) => void;
  showFloatingWidget: boolean;
  setShowFloatingWidget: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const now = new Date();
const todayBase = new Date(now.getFullYear(), now.getMonth(), now.getDate());

function hoursAgo(h: number, m = 0) {
  return new Date(now.getTime() - (h * 3600 + m * 60) * 1000);
}

function sessionOf(
  taskName: string,
  category: string,
  startHour: number,
  startMin: number,
  durationMin: number,
  feeling?: string,
  evalTag?: string,
  tags: string[] = []
): WorkSession {
  const cat = getCategoryInfo(category);
  const start = new Date(todayBase.getTime() + (startHour * 60 + startMin) * 60 * 1000);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    id: makeId(),
    taskName,
    category,
    evalTag,
    color: cat.color,
    startTime: start,
    endTime: end,
    duration: durationMin * 60,
    feeling,
    tags,
  };
}

const INITIAL_SESSIONS: WorkSession[] = [
  sessionOf("早会同步", "工作", 9, 0, 30, "例行会议，内容一般", "必须/没意义", ["会议"]),
  sessionOf("需求文档阅读", "学习", 9, 35, 45, "加深了对产品方向的理解", "必须/有意义", ["文档"]),
  sessionOf("前端架构设计", "工作", 10, 30, 90, "完成了组件层级划分", "必须/有意义", ["研发"]),
  sessionOf("UI走查", "工作", 12, 0, 40, "确认了设计规范", "必须/有意义", ["设计"]),
  sessionOf("单元测试编写", "工作", 13, 0, 60, undefined, "必须/有意义", ["测试"]),
  sessionOf("接口联调", "工作", 14, 0, 75, "解决了3个跨域问题", "必须/有意义", ["研发"]),
  sessionOf("Sprint规划", "工作", 15, 30, 50, "确定了下周迭代范围", "必须/没意义", ["规划"]),
  sessionOf("技术文档更新", "工作", 16, 30, 40, undefined, "必须/有意义", ["文档"]),
  sessionOf("代码Review", "工作", 17, 15, 45, "审查了5个PR", "必须/有意义", ["研发"]),

  // Yesterday
  ...(() => {
    const yesterday = new Date(todayBase.getTime() - 86400 * 1000);
    function ys(
      taskName: string,
      category: string,
      sh: number,
      sm: number,
      dur: number,
      feeling?: string,
      evalTag?: string,
      tags: string[] = []
    ): WorkSession {
      const cat = getCategoryInfo(category);
      const start = new Date(yesterday.getTime() + (sh * 60 + sm) * 60 * 1000);
      const end = new Date(start.getTime() + dur * 60 * 1000);
      return {
        id: makeId(),
        taskName,
        category,
        evalTag,
        color: cat.color,
        startTime: start,
        endTime: end,
        duration: dur * 60,
        feeling,
        tags,
      };
    }
    return [
      ys("产品评审会", "工作", 9, 0, 60, "讨论挺充分的", "必须/没意义", ["会议"]),
      ys("组件库开发", "工作", 10, 15, 120, "很有成就感", "必须/有意义", ["研发"]),
      ys("交互设计学习", "学习", 14, 0, 90, "学到了新的设计模式", "不必须/有意义", ["设计"]),
      ys("自动化测试", "工作", 15, 45, 60, undefined, "必须/有意义", ["测试"]),
      ys("周报撰写", "琐事", 17, 0, 30, "流程性工作，枯燥", "必须/没意义", ["文档"]),
    ];
  })(),
];

const INITIAL_TASKS: Task[] = [
  {
    id: makeId(),
    name: "产品需求分析",
    description: "整理Q2核心功能需求，梳理用户故事",
    category: "工作",
    evalTag: "必须/有意义",
    color: "#4F7FFF",
    bgColor: "rgba(79,127,255,0.15)",
    startTime: hoursAgo(1, 23),
    elapsed: 83 * 60 + 17,
    isRunning: true,
    tags: ["Q2", "核心功能"],
  },
  {
    id: makeId(),
    name: "UI设计走查",
    description: "新版仪表盘设计稿走查与反馈",
    category: "工作",
    evalTag: "必须/有意义",
    color: "#4F7FFF",
    bgColor: "rgba(79,127,255,0.15)",
    startTime: hoursAgo(0, 45),
    elapsed: 45 * 60 + 8,
    isRunning: true,
    tags: ["仪表盘", "v2.0"],
  },
  {
    id: makeId(),
    name: "Sprint规划会议",
    description: "第12周迭代目标确认",
    category: "工作",
    evalTag: "必须/没意义",
    color: "#4F7FFF",
    bgColor: "rgba(79,127,255,0.15)",
    startTime: hoursAgo(0, 20),
    elapsed: 20 * 60 + 33,
    isRunning: false,
    tags: ["Sprint12"],
  },
  {
    id: makeId(),
    name: "React 新特性学习",
    description: "研究 React 19 并发模式与 Suspense",
    category: "学习",
    evalTag: "不必须/有意义",
    color: "#A855F7",
    bgColor: "rgba(168,85,247,0.15)",
    startTime: hoursAgo(2, 10),
    elapsed: 130 * 60 + 44,
    isRunning: true,
    tags: ["React19", "技术提升"],
  },
];

const INITIAL_TODOS: TodoItem[] = [
  { id: makeId(), text: "完成用户故事地图", completed: false, priority: "high", category: "工作" },
  { id: makeId(), text: "设计稿走查确认", completed: false, priority: "medium", category: "工作" },
  { id: makeId(), text: "阅读《人月神话》第三章", completed: false, priority: "high", category: "学习" },
  { id: makeId(), text: "前端性能优化", completed: true, priority: "medium", category: "工作" },
  { id: makeId(), text: "健身打卡", completed: false, priority: "low", category: "生活" },
  { id: makeId(), text: "下周迭代计划制定", completed: false, priority: "high", category: "工作" },
  { id: makeId(), text: "整理桌面文件", completed: true, priority: "medium", category: "琐事" },
  { id: makeId(), text: "回复积压邮件", completed: false, priority: "low", category: "琐事" },
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
  const [sessions, setSessions] = useState<WorkSession[]>(INITIAL_SESSIONS);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showEndTaskDialog, setShowEndTaskDialog] = useState(false);
  const [taskToEnd, setTaskToEnd] = useState<Task | null>(null);
  const [showFloatingWidget, setShowFloatingWidget] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTasks((prev) =>
        prev.map((t) => (t.isRunning ? { ...t, elapsed: t.elapsed + 1 } : t))
      );
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const addTask = useCallback(
    (data: {
      name: string;
      description?: string;
      category: string;
      evalTag?: string;
      tags: string[];
    }) => {
      const cat = getCategoryInfo(data.category);
      const newTask: Task = {
        id: makeId(),
        name: data.name,
        description: data.description,
        category: data.category,
        evalTag: data.evalTag,
        color: cat.color,
        bgColor: cat.bg,
        startTime: new Date(),
        elapsed: 0,
        isRunning: true,
        tags: data.tags,
      };
      setTasks((prev) => [...prev, newTask]);
    },
    []
  );

  const endTask = useCallback((id: string, feeling?: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (task) {
        const session: WorkSession = {
          id: makeId(),
          taskName: task.name,
          category: task.category,
          evalTag: task.evalTag,
          color: task.color,
          startTime: task.startTime,
          endTime: new Date(),
          duration: task.elapsed,
          feeling,
          tags: task.tags,
        };
        setSessions((s) => [session, ...s]);
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const toggleTimer = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isRunning: !t.isRunning } : t))
    );
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const addTodo = useCallback(
    (text: string, category: string, priority: "high" | "medium" | "low") => {
      setTodos((prev) => [
        ...prev,
        { id: makeId(), text, completed: false, priority, category },
      ]);
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        tasks,
        todos,
        sessions,
        addTask,
        endTask,
        toggleTimer,
        toggleTodo,
        addTodo,
        showNewTaskDialog,
        setShowNewTaskDialog,
        showEndTaskDialog,
        setShowEndTaskDialog,
        taskToEnd,
        setTaskToEnd,
        showFloatingWidget,
        setShowFloatingWidget,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}
