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
  clearAllData as clearAllDataDB,
  type EventRecord,
} from "../services/db";
import { downloadCSV } from "../services/exportCSV";
import { Capacitor, registerPlugin } from "@capacitor/core";

const FloatingWindow = registerPlugin<any>("FloatingWindow");

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
  archived?: boolean;
}

export interface SleepSuggestion {
  id: string;    // `sleep_${start}`
  start: number; // ms
  end: number;   // ms
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
  outcome?: "completed" | "abandoned"; // 完成结果
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
    startTime?: Date;
  }) => void;
  endTask: (id: string, feeling?: string, outcome?: "completed" | "abandoned") => void;
  updateSession: (session: WorkSession) => void;
  addManualSession: (data: {
    name: string;
    category: string;
    evalTag?: string;
    startTime: Date;
    endTime: Date;
    feeling?: string;
    tags: string[];
  }) => void;
  deleteSession: (id: string) => void;
  exportToCSV: () => void;
  clearAllData: () => Promise<void>;
  toggleTimer: (id: string) => void;
  toggleTodo: (id: string) => void;
  addTodo: (text: string, category: string, priority: "high" | "medium" | "low") => void;
  archiveTodo: (id: string) => void;
  unarchiveTodo: (id: string) => void;
  sleepSuggestions: SleepSuggestion[];
  confirmSleep: (id: string) => void;
  dismissSleep: (id: string) => void;
  showFloating: () => void;
  showNewTaskDialog: boolean;
  setShowNewTaskDialog: (v: boolean) => void;
  showEndTaskDialog: boolean;
  setShowEndTaskDialog: (v: boolean) => void;
  showManualSessionDialog: boolean;
  setShowManualSessionDialog: (v: boolean) => void;
  manualPrefill: { name: string; category: string; startTime: Date; endTime: Date } | null;
  openManualWithPrefill: (prefill: { name: string; category: string; startTime: Date; endTime: Date }) => void;
  taskToEnd: Task | null;
  setTaskToEnd: (t: Task | null) => void;
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
      outcome: s.outcome,
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
    outcome: d.outcome,
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
      archived: t.archived ?? false,
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
    archived: d.archived ?? false,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
  const [sessions, setSessions] = useState<WorkSession[]>(INITIAL_SESSIONS);
  const [sleepSuggestions, setSleepSuggestions] = useState<SleepSuggestion[]>([]);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showEndTaskDialog, setShowEndTaskDialog] = useState(false);
  const [showManualSessionDialog, setShowManualSessionDialog] = useState(false);
  const [taskToEnd, setTaskToEnd] = useState<Task | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<{ name: string; category: string; startTime: Date; endTime: Date } | null>(null);

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

    // 初始检查权限与状态同步 (Android 专用)
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      // 1. 检查悬浮窗权限
      FloatingWindow.checkPermission().then((res: { granted: boolean }) => {
        if (!res.granted) {
          FloatingWindow.requestPermission();
        }
      });

      // 2. 状态热恢复：从原生 Service 获取当前计时状态，并启动悬浮窗
      setTimeout(async () => {
        try {
          const status = await FloatingWindow.getStatus();
          if (status.isRunning) {
            console.log("[Native Sync] Restoring state from Service:", status);
            setTasks((prev) => {
              const taskIndex = prev.findIndex(t => t.name === status.name);
              if (taskIndex !== -1) {
                const updated = [...prev];
                updated[taskIndex] = {
                  ...updated[taskIndex],
                  isRunning: true,
                  startTime: new Date(status.startTime),
                  elapsed: status.elapsed
                };
                return updated;
              }
              return prev;
            });
          }
        } catch (e) {
          console.warn("[Native Sync] Failed to get status", e);
        }
        // 启动悬浮窗
        const running = tasksRef.current.filter((t) => t.isRunning);
        running.forEach((t) => {
          FloatingWindow.startFloating({
            name: t.name,
            startTime: Date.now() - t.elapsed * 1000,
            elapsed: 0,
            color: t.color,
          });
        });

        // 自动检测睡眠
        try {
          const now = Date.now();
          const yesterday0 = new Date(); yesterday0.setDate(yesterday0.getDate() - 1); yesterday0.setHours(0,0,0,0);
          const usageRes = await FloatingWindow.getUsageEvents({ startTime: yesterday0.getTime(), endTime: now });
          const uSessions: Array<{start: number; end: number}> = usageRes.sessions || [];
          if (uSessions.length > 0) {
            const sorted = [...uSessions].sort((a, b) => a.start - b.start);
            const gaps: SleepSuggestion[] = [];
            const SLEEP_GAP = 4.5 * 3600 * 1000;
            // gap before first session
            const dayStart = yesterday0.getTime();
            if (sorted[0].start - dayStart >= SLEEP_GAP) {
              gaps.push({ id: `sleep_${dayStart}`, start: dayStart, end: sorted[0].start });
            }
            for (let i = 0; i < sorted.length - 1; i++) {
              const gap = sorted[i + 1].start - sorted[i].end;
              if (gap >= SLEEP_GAP) {
                gaps.push({ id: `sleep_${sorted[i].end}`, start: sorted[i].end, end: sorted[i + 1].start });
              }
            }
            // filter already-recorded sleep sessions
            const existingSleep = sessionsRef.current.filter((s) => s.category === "睡觉");
            const filtered = gaps.filter((g) => {
              if (localStorage.getItem(`dismissed_sleep_${g.start}`)) return false;
              return !existingSleep.some((s) => s.startTime.getTime() < g.end && s.endTime.getTime() > g.start);
            });
            if (filtered.length > 0) setSleepSuggestions(filtered);
          }
        } catch (e) {
          // usage permission not granted or error, ignore
        }
      }, 2000);
    }
  }, []);

  // ─── 持久化同步（每 30s 一次，不依赖 tasks 避免频繁重置） ──────
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const sessionsRef = useRef<WorkSession[]>([]);
  sessionsRef.current = sessions;

  useEffect(() => {
    if (!dbReady) return;
    const syncInterval = setInterval(() => {
      tasksRef.current.forEach((t) => saveEvent(taskToEvent(t)).catch(console.warn));
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [dbReady]);

  // ─── 秒级计时（纯 state 更新，无副作用） ──────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTasks((prev) => prev.map((t) => (t.isRunning ? { ...t, elapsed: t.elapsed + 1 } : t)));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ─── 前台恢复时从 FloatingService 同步 elapsed（以悬浮窗为准） ──
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android" || !FloatingWindow) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await FloatingWindow.getActiveTasks();
        const serviceMap: Record<string, number> = {};
        (res.tasks || []).forEach((t: { name: string; elapsed: number }) => {
          serviceMap[t.name] = t.elapsed;
        });
        setTasks((prev) =>
          prev.map((t) => {
            const svcElapsed = serviceMap[t.name];
            if (t.isRunning && svcElapsed != null && svcElapsed > t.elapsed) {
              return { ...t, elapsed: svcElapsed };
            }
            return t;
          })
        );
      } catch (e) {
        // service not running, ignore
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const addTask = useCallback(
    (data: {
      name: string;
      description?: string;
      category: string;
      evalTag?: string;
      tags: string[];
      estimatedMinutes?: number;
      startTime?: Date;
    }) => {
      const cat = getCategoryInfo(data.category);
      const customStart = data.startTime;
      const now = new Date();
      const taskStart = customStart ?? now;
      const initialElapsed = customStart
        ? Math.max(0, Math.floor((Date.now() - customStart.getTime()) / 1000))
        : 0;
      const newTask: Task = {
        id: makeId(),
        name: data.name,
        description: data.description,
        category: data.category,
        evalTag: data.evalTag,
        color: cat.color,
        bgColor: cat.bg,
        startTime: taskStart,
        elapsed: initialElapsed,
        isRunning: true,
        tags: data.tags,
        estimatedMinutes: data.estimatedMinutes,
      };
      setTasks((prev) => [...prev, newTask]);
      saveEvent(taskToEvent(newTask)).catch(console.warn);
      if (Capacitor.getPlatform() === "android" && FloatingWindow) {
        FloatingWindow.startFloating({
          name: newTask.name,
          startTime: Date.now() - initialElapsed * 1000,
          elapsed: 0,
          color: newTask.color,
        });
      }
    },
    []
  );

  const endTask = useCallback((id: string, feeling?: string, outcome?: "completed" | "abandoned") => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

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
      outcome,
    };
    setSessions((s) => [session, ...s]);
    saveEvent(sessionToEvent(session)).catch(console.warn);
    deleteEvent(task.id).catch(console.warn);

    const remaining = tasks.filter((t) => t.id !== id);
    setTasks(remaining);

    // 同步原生悬浮窗 — 副作用放在 setTasks 之外
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      const hasRunning = remaining.some((t) => t.isRunning);
      if (!hasRunning) {
        FloatingWindow.stopFloating();
      } else {
        FloatingWindow.removeTask({ name: task.name });
      }
    }
  }, [tasks]);

  const toggleTimer = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setTasks(tasks.map((t) => (t.id === id ? { ...t, isRunning: !t.isRunning } : t)));
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      if (task.isRunning) {
        // 暂停：冻结计数（startTime=0 → service 直接返回 elapsed）
        FloatingWindow.startFloating({
          name: task.name,
          startTime: 0,
          elapsed: task.elapsed,
          color: task.color,
        });
      } else {
        // 恢复：以当前 elapsed 为基础发虚拟起始时间
        FloatingWindow.startFloating({
          name: task.name,
          startTime: Date.now() - task.elapsed * 1000,
          elapsed: 0,
          color: task.color,
        });
      }
    }
  }, [tasks]);

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
      const newTodo: TodoItem = { id: makeId(), text, completed: false, priority, category, archived: false };
      setTodos((prev) => [...prev, newTodo]);
      saveEvent(todoToEvent(newTodo)).catch(console.warn);
    },
    []
  );

  const archiveTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          const archived = { ...t, archived: true };
          saveEvent(todoToEvent(archived)).catch(console.warn);
          return archived;
        }
        return t;
      });
      return updated;
    });
  }, []);

  const unarchiveTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const updated = prev.map((t) => {
        if (t.id === id) {
          const unarchived = { ...t, archived: false };
          saveEvent(todoToEvent(unarchived)).catch(console.warn);
          return unarchived;
        }
        return t;
      });
      return updated;
    });
  }, []);

  const confirmSleep = useCallback((suggestionId: string) => {
    setSleepSuggestions((prev) => {
      const s = prev.find((p) => p.id === suggestionId);
      if (!s) return prev;
      const cat = getCategoryInfo("睡觉");
      const durationSec = Math.round((s.end - s.start) / 1000);
      const session: WorkSession = {
        id: makeId(),
        taskName: "睡觉",
        category: "睡觉",
        color: cat.color,
        startTime: new Date(s.start),
        endTime: new Date(s.end),
        duration: durationSec,
        tags: [],
      };
      setSessions((prev2) => [session, ...prev2]);
      saveEvent(sessionToEvent(session)).catch(console.warn);
      return prev.filter((p) => p.id !== suggestionId);
    });
  }, []);

  const dismissSleep = useCallback((suggestionId: string) => {
    setSleepSuggestions((prev) => {
      const s = prev.find((p) => p.id === suggestionId);
      if (s) localStorage.setItem(`dismissed_sleep_${s.start}`, "1");
      return prev.filter((p) => p.id !== suggestionId);
    });
  }, []);

  const exportToCSV = useCallback(() => {
    downloadCSV(sessions);
  }, [sessions]);

  const addManualSession = useCallback(
    (data: {
      name: string;
      category: string;
      evalTag?: string;
      startTime: Date;
      endTime: Date;
      feeling?: string;
      tags: string[];
    }) => {
      const cat = getCategoryInfo(data.category);
      const durationSec = Math.round((data.endTime.getTime() - data.startTime.getTime()) / 1000);
      const session: WorkSession = {
        id: makeId(),
        taskName: data.name,
        category: data.category,
        evalTag: data.evalTag,
        color: cat.color,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: durationSec,
        feeling: data.feeling,
        tags: data.tags,
      };
      setSessions((s) => [session, ...s]);
      saveEvent(sessionToEvent(session)).catch(console.warn);
    },
    []
  );

  const deleteSessionFn = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    deleteEvent(id).catch(console.warn);
  }, []);

  const updateSessionFn = useCallback((updated: WorkSession) => {
    setSessions((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    saveEvent(sessionToEvent(updated)).catch(console.warn);
  }, []);

  const clearAllDataFn = useCallback(async () => {
    await clearAllDataDB();
    setTasks([]);
    setSessions([]);
    setTodos([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        tasks,
        todos,
        sessions,
        addTask,
        endTask,
        addManualSession,
        toggleTimer,
        toggleTodo,
        addTodo,
        archiveTodo,
        unarchiveTodo,
        sleepSuggestions,
        confirmSleep,
        dismissSleep,
        exportToCSV,
        deleteSession: deleteSessionFn,
        updateSession: updateSessionFn,
        clearAllData: clearAllDataFn,
        showFloating: () => {
          if (Capacitor.getPlatform() !== "android" || !FloatingWindow) return;
          const running = tasksRef.current.filter((t) => t.isRunning);
          if (running.length === 0) return;
          running.forEach((t) => {
            FloatingWindow.startFloating({
              name: t.name,
              startTime: Date.now() - t.elapsed * 1000,
              elapsed: 0,
              color: t.color,
            });
          });
        },
        showNewTaskDialog,
        setShowNewTaskDialog,
        showEndTaskDialog,
        setShowEndTaskDialog,
        showManualSessionDialog,
        setShowManualSessionDialog,
        manualPrefill,
        openManualWithPrefill: (prefill) => {
          setManualPrefill(prefill);
          setShowManualSessionDialog(true);
        },
        taskToEnd,
        setTaskToEnd,
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
