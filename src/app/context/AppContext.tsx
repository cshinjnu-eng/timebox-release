import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  ensureDefaultBuckets,
  saveEvent,
  deleteEvent,
  getEventsByBucket,
  type EventRecord,
} from "../services/db";
import { downloadCSV } from "../services/exportCSV";

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
  estimatedMinutes?: number; // 预计时间（分钟）
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
  estimatedMinutes?: number; // 预计时间（分钟）
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
    estimatedMinutes?: number;
  }) => void;
  endTask: (id: string, feeling?: string) => void;
  deleteSession: (id: string) => void;
  exportToCSV: () => void;
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

const INITIAL_SESSIONS: WorkSession[] = [];
const INITIAL_TASKS: Task[] = [];
const INITIAL_TODOS: TodoItem[] = [];

// ─── IndexedDB 序列化辅助 ─────────────────────────────────────────
function taskToEvent(task: Task): EventRecord {
  return {
    id: task.id,
    bucketId: "timebox-tasks",
    timestamp: task.startTime.toISOString(),
    duration: task.elapsed,
    data: {
      name: task.name,
      description: task.description,
      category: task.category,
      evalTag: task.evalTag,
      color: task.color,
      bgColor: task.bgColor,
      isRunning: task.isRunning,
      tags: task.tags,
      estimatedMinutes: task.estimatedMinutes,
    },
  };
}

function eventToTask(e: EventRecord): Task {
  const d = e.data as Record<string, any>;
  return {
    id: e.id,
    name: d.name || "",
    description: d.description,
    category: d.category || "工作",
    evalTag: d.evalTag,
    color: d.color || "#4F7FFF",
    bgColor: d.bgColor || "rgba(79,127,255,0.15)",
    startTime: new Date(e.timestamp),
    elapsed: e.duration,
    isRunning: d.isRunning ?? false,
    tags: d.tags || [],
    estimatedMinutes: d.estimatedMinutes,
  };
}

function sessionToEvent(s: WorkSession): EventRecord {
  return {
    id: s.id,
    bucketId: "timebox-sessions",
    timestamp: s.startTime.toISOString(),
    duration: s.duration,
    data: {
      taskName: s.taskName,
      category: s.category,
      evalTag: s.evalTag,
      color: s.color,
      endTime: s.endTime.toISOString(),
      feeling: s.feeling,
      tags: s.tags,
      estimatedMinutes: s.estimatedMinutes,
    },
  };
}

function eventToSession(e: EventRecord): WorkSession {
  const d = e.data as Record<string, any>;
  return {
    id: e.id,
    taskName: d.taskName || "",
    category: d.category || "工作",
    evalTag: d.evalTag,
    color: d.color || "#4F7FFF",
    startTime: new Date(e.timestamp),
    endTime: new Date(d.endTime),
    duration: e.duration,
    feeling: d.feeling,
    tags: d.tags || [],
    estimatedMinutes: d.estimatedMinutes,
  };
}

function todoToEvent(t: TodoItem): EventRecord {
  return {
    id: t.id,
    bucketId: "timebox-todos",
    timestamp: new Date().toISOString(),
    duration: 0,
    data: {
      text: t.text,
      completed: t.completed,
      priority: t.priority,
      category: t.category,
    },
  };
}

function eventToTodo(e: EventRecord): TodoItem {
  const d = e.data as Record<string, any>;
  return {
    id: e.id,
    text: d.text || "",
    completed: d.completed ?? false,
    priority: d.priority || "medium",
    category: d.category || "工作",
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
  const [sessions, setSessions] = useState<WorkSession[]>(INITIAL_SESSIONS);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showEndTaskDialog, setShowEndTaskDialog] = useState(false);
  const [taskToEnd, setTaskToEnd] = useState<Task | null>(null);
  const [showFloatingWidget, setShowFloatingWidget] = useState(true);
  const [dbReady, setDbReady] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── IndexedDB 初始化：加载数据 ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await ensureDefaultBuckets();
        const [taskEvents, todoEvents, sessionEvents] = await Promise.all([
          getEventsByBucket("timebox-tasks"),
          getEventsByBucket("timebox-todos"),
          getEventsByBucket("timebox-sessions"),
        ]);
        if (taskEvents.length > 0) setTasks(taskEvents.map(eventToTask));
        if (todoEvents.length > 0) setTodos(todoEvents.map(eventToTodo));
        if (sessionEvents.length > 0) setSessions(sessionEvents.map(eventToSession));
      } catch (err) {
        console.warn("IndexedDB 加载失败，使用默认数据", err);
      } finally {
        setDbReady(true);
      }
    })();
  }, []);

  // ─── 持久化同步 ────────────────────────────────────────────────
  useEffect(() => {
    if (!dbReady) return;
    // 每 10s 持久化一次 tasks（含 elapsed 更新）
    const syncInterval = setInterval(() => {
      tasks.forEach((t) => saveEvent(taskToEvent(t)).catch(console.warn));
    }, 10000);
    return () => clearInterval(syncInterval);
  }, [dbReady, tasks]);

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
      estimatedMinutes?: number;
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
        estimatedMinutes: data.estimatedMinutes,
      };
      setTasks((prev) => [...prev, newTask]);
      saveEvent(taskToEvent(newTask)).catch(console.warn);
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
          estimatedMinutes: task.estimatedMinutes,
        };
        setSessions((s) => [session, ...s]);
        saveEvent(sessionToEvent(session)).catch(console.warn);
        deleteEvent(task.id).catch(console.warn); // 从 tasks bucket 移除
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
    setTodos((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          const toggled = { ...t, completed: !t.completed };
          saveEvent(todoToEvent(toggled)).catch(console.warn);
          return toggled;
        }
        return t;
      });
      return updated;
    });
  }, []);

  const addTodo = useCallback(
    (text: string, category: string, priority: "high" | "medium" | "low") => {
      const newTodo: TodoItem = { id: makeId(), text, completed: false, priority, category };
      setTodos((prev) => [...prev, newTodo]);
      saveEvent(todoToEvent(newTodo)).catch(console.warn);
    },
    []
  );

  const exportToCSV = useCallback(() => {
    downloadCSV(sessions);
  }, [sessions]);

  const deleteSessionFn = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    deleteEvent(id).catch(console.warn);
  }, []);

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
        exportToCSV,
        deleteSession: deleteSessionFn,
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
