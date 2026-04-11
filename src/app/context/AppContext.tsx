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
  category: string;
  evalTag?: string;
  color: string;
  bgColor: string;
  startTime: Date;
  elapsed: number;         // seconds
  isRunning: boolean;
  tags: string[];
  estimatedMinutes?: number;
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
  id: string;
  start: number; // ms
  end: number;   // ms
}

export interface WorkSession {
  id: string;
  taskName: string;
  category: string;
  evalTag?: string;
  color: string;
  startTime: Date;
  endTime: Date;
  duration: number;        // seconds
  feeling?: string;
  tags: string[];
  estimatedMinutes?: number;
  outcome?: "completed" | "abandoned";
}

// ─── 长线任务 ─────────────────────────────────────────────────────────
export interface LongTaskCheckpoint {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: number; // ms timestamp
}

export interface LongTask {
  id: string;
  name: string;
  description?: string;
  category: string;
  evalTag?: string;
  color: string;
  bgColor: string;
  startTime: Date;
  elapsed: number;       // seconds total (persists across pauses)
  isRunning: boolean;
  tags: string[];
  checkpoints: LongTaskCheckpoint[];
}

// ─── 应用桶 ───────────────────────────────────────────────────────────
export interface AppBucket {
  id: string;
  name: string;
  apps: string[];          // app display names matched against getUsageEvents.appName
  category: string;
  evalTag?: string;
  triggerMinutes: number;  // default 5
  toleranceSeconds: number; // gap tolerance, default 60
  color: string;
}

export interface BucketDetection {
  bucketId: string;
  bucketName: string;
  category: string;
  evalTag?: string;
  color: string;
  detectedMinutes: number;
  trueStart: number; // ms — actual usage start
  trueEnd: number;   // ms — actual usage end
  mode: "retrospective" | "realtime";
  // retrospective: 用户已离开桶App，补录为已完成的时间记录（类似睡眠）
  // realtime: 用户仍在或刚离开，创建运行中的计时任务（回填已用时间）
}

// ─── Context 类型 ──────────────────────────────────────────────────────
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
  // Long tasks
  longTasks: LongTask[];
  addLongTask: (data: { name: string; description?: string; category: string; evalTag?: string; tags: string[]; startTime?: Date }) => void;
  endLongTask: (id: string, feeling?: string, outcome?: "completed" | "abandoned") => void;
  toggleLongTask: (id: string) => void;
  addCheckpoint: (taskId: string, text: string) => void;
  toggleCheckpoint: (taskId: string, checkpointId: string) => void;
  deleteCheckpoint: (taskId: string, checkpointId: string) => void;
  // App buckets
  appBuckets: AppBucket[];
  addBucket: (data: Omit<AppBucket, "id">) => void;
  updateBucket: (bucket: AppBucket) => void;
  deleteBucket: (id: string) => void;
  // Bucket auto-detection
  bucketDetection: BucketDetection | null;
  confirmBucketDetection: () => void;
  dismissBucketDetection: () => void;
  recentAppNames: string[];
  // Dialogs
  showNewTaskDialog: boolean;
  setShowNewTaskDialog: (v: boolean) => void;
  showEndTaskDialog: boolean;
  setShowEndTaskDialog: (v: boolean) => void;
  showManualSessionDialog: boolean;
  setShowManualSessionDialog: (v: boolean) => void;
  manualPrefill: { name: string; category: string; startTime: Date; endTime: Date } | null;
  openManualWithPrefill: (prefill: { name: string; category: string; startTime: Date; endTime: Date }) => void;
  showNewLongTaskDialog: boolean;
  setShowNewLongTaskDialog: (v: boolean) => void;
  taskToEnd: Task | null;
  setTaskToEnd: (t: Task | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── IndexedDB 序列化辅助 ──────────────────────────────────────────────
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

function longTaskToEvent(t: LongTask): EventRecord {
  return {
    id: t.id,
    bucketId: "timebox-longtasks",
    timestamp: t.startTime.toISOString(),
    duration: t.elapsed,
    data: {
      name: t.name,
      description: t.description,
      category: t.category,
      evalTag: t.evalTag,
      color: t.color,
      bgColor: t.bgColor,
      isRunning: t.isRunning,
      tags: t.tags,
      checkpoints: t.checkpoints,
    },
  };
}

function eventToLongTask(e: EventRecord): LongTask {
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
    checkpoints: d.checkpoints || [],
  };
}

function bucketConfigToEvent(b: AppBucket): EventRecord {
  return {
    id: b.id,
    bucketId: "timebox-buckets",
    timestamp: new Date().toISOString(),
    duration: 0,
    data: {
      name: b.name,
      apps: b.apps,
      category: b.category,
      evalTag: b.evalTag,
      triggerMinutes: b.triggerMinutes,
      toleranceSeconds: b.toleranceSeconds,
      color: b.color,
    },
  };
}

function eventToBucketConfig(e: EventRecord): AppBucket {
  const d = e.data as Record<string, any>;
  return {
    id: e.id,
    name: d.name || "",
    apps: d.apps || [],
    category: d.category || "工作",
    evalTag: d.evalTag,
    triggerMinutes: d.triggerMinutes ?? 5,
    toleranceSeconds: d.toleranceSeconds ?? 60,
    color: d.color || "#4F7FFF",
  };
}

// ─── Provider ─────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [longTasks, setLongTasks] = useState<LongTask[]>([]);
  const [appBuckets, setAppBuckets] = useState<AppBucket[]>([]);
  const [sleepSuggestions, setSleepSuggestions] = useState<SleepSuggestion[]>([]);
  const [bucketDetection, setBucketDetection] = useState<BucketDetection | null>(null);
  const [recentAppNames, setRecentAppNames] = useState<string[]>([]);
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [showEndTaskDialog, setShowEndTaskDialog] = useState(false);
  const [showManualSessionDialog, setShowManualSessionDialog] = useState(false);
  const [showNewLongTaskDialog, setShowNewLongTaskDialog] = useState(false);
  const [taskToEnd, setTaskToEnd] = useState<Task | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [manualPrefill, setManualPrefill] = useState<{ name: string; category: string; startTime: Date; endTime: Date } | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────────
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const sessionsRef = useRef<WorkSession[]>([]);
  sessionsRef.current = sessions;
  const longTasksRef = useRef<LongTask[]>([]);
  longTasksRef.current = longTasks;
  const bucketsRef = useRef<AppBucket[]>([]);
  bucketsRef.current = appBuckets;
  const bucketDetectionRef = useRef<BucketDetection | null>(null);
  bucketDetectionRef.current = bucketDetection;

  // ─── IndexedDB 初始化 ───────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await ensureDefaultBuckets();
        const [taskEvents, todoEvents, sessionEvents, longTaskEvents, bucketEvents] = await Promise.all([
          getEventsByBucket("timebox-tasks"),
          getEventsByBucket("timebox-todos"),
          getEventsByBucket("timebox-sessions"),
          getEventsByBucket("timebox-longtasks"),
          getEventsByBucket("timebox-buckets"),
        ]);
        if (taskEvents.length > 0) setTasks(taskEvents.map(eventToTask));
        if (todoEvents.length > 0) setTodos(todoEvents.map(eventToTodo));
        if (sessionEvents.length > 0) setSessions(sessionEvents.map(eventToSession));
        if (longTaskEvents.length > 0) setLongTasks(longTaskEvents.map(eventToLongTask));
        if (bucketEvents.length > 0) setAppBuckets(bucketEvents.map(eventToBucketConfig));
      } catch (err) {
        console.warn("IndexedDB 加载失败", err);
      } finally {
        setDbReady(true);
      }
    })();

    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      FloatingWindow.checkPermission().then((res: { granted: boolean }) => {
        if (!res.granted) FloatingWindow.requestPermission();
      });

      setTimeout(async () => {
        try {
          const status = await FloatingWindow.getStatus();
          if (status.isRunning) {
            setTasks((prev) => {
              const idx = prev.findIndex(t => t.name === status.name);
              if (idx !== -1) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], isRunning: true, startTime: new Date(status.startTime), elapsed: status.elapsed };
                return updated;
              }
              return prev;
            });
          }
        } catch (e) { /* ignore */ }

        // 启动悬浮窗（普通任务 + 长线任务）
        tasksRef.current.filter((t) => t.isRunning).forEach((t) => {
          FloatingWindow.startFloating({ name: t.name, startTime: Date.now() - t.elapsed * 1000, elapsed: 0, color: t.color });
        });
        longTasksRef.current.filter((t) => t.isRunning).forEach((t) => {
          FloatingWindow.startFloating({ name: `[长] ${t.name}`, startTime: Date.now() - t.elapsed * 1000, elapsed: 0, color: t.color });
        });

        // 加载最近使用的 App 名称（用于桶配置自动补全）
        try {
          const statsRes = await FloatingWindow.getUsageStats({ startTime: Date.now() - 7 * 86400000, endTime: Date.now() });
          const names: string[] = (statsRes.stats || [])
            .map((s: any) => s.appName as string)
            .filter((n: string) => n && n.length > 0 && !n.includes('.'));
          if (names.length > 0) setRecentAppNames([...new Set(names)].sort());
        } catch (e) { /* ignore */ }

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
            const existingSleep = sessionsRef.current.filter((s) => s.category === "睡觉");
            const filtered = gaps.filter((g) => {
              if (localStorage.getItem(`dismissed_sleep_${g.start}`)) return false;
              return !existingSleep.some((s) => s.startTime.getTime() < g.end && s.endTime.getTime() > g.start);
            });
            if (filtered.length > 0) setSleepSuggestions(filtered);
          }
        } catch (e) { /* usage permission not granted */ }

        // 应用桶回溯检测（同睡眠逻辑，启动时检测近2小时内的桶使用）
        try {
          const bNow = Date.now();
          const bRes = await FloatingWindow.getUsageEvents({ startTime: bNow - 12 * 3600000, endTime: bNow });
          const bAllEvents: Array<{appName: string; start: number; end: number}> = bRes.sessions || [];
          for (const bucket of bucketsRef.current) {
            if (tasksRef.current.some(t => t.name === bucket.name && t.isRunning)) continue;
            if (sessionsRef.current.some(s => s.taskName === bucket.name &&
                s.endTime.getTime() > bNow - 2 * 3600000)) continue;
            const bEvts = bAllEvents.filter(e =>
              bucket.apps.some(a => a.toLowerCase() === e.appName.toLowerCase()));
            if (bEvts.length === 0) continue;
            const bSorted = [...bEvts].sort((a, b) => a.start - b.start);
            let bSegStart = bSorted[0].start, bSegEnd = bSorted[0].end;
            for (let i = 1; i < bSorted.length; i++) {
              if (bSorted[i].start - bSegEnd <= bucket.toleranceSeconds * 1000) {
                bSegEnd = Math.max(bSegEnd, bSorted[i].end);
              } else {
                bSegStart = bSorted[i].start;
                bSegEnd = bSorted[i].end;
              }
            }
            const bDurMin = (bSegEnd - bSegStart) / 60000;
            const bIsRecent = (bNow - bSegEnd) <= 30 * 60000; // 30分钟内
            if (!bIsRecent || bDurMin < bucket.triggerMinutes) continue;
            const bHourKey = Math.floor(bSegStart / 3600000);
            if (localStorage.getItem(`dismissed_bucket_${bucket.id}_${bHourKey}`)) continue;
            const bMode = (bNow - bSegEnd) > 10 * 60000 ? "retrospective" : "realtime";
            setBucketDetection({
              bucketId: bucket.id, bucketName: bucket.name, category: bucket.category,
              evalTag: bucket.evalTag, color: bucket.color,
              detectedMinutes: Math.round(bDurMin),
              trueStart: bSegStart, trueEnd: bSegEnd, mode: bMode,
            });
            break;
          }
        } catch (_) { /* usage permission not granted */ }
      }, 2000);
    }
  }, []);

  // ─── 持久化（30s） ─────────────────────────────────────────────────
  useEffect(() => {
    if (!dbReady) return;
    const syncInterval = setInterval(() => {
      tasksRef.current.forEach((t) => saveEvent(taskToEvent(t)).catch(console.warn));
      longTasksRef.current.forEach((t) => saveEvent(longTaskToEvent(t)).catch(console.warn));
    }, 30000);
    return () => clearInterval(syncInterval);
  }, [dbReady]);

  // ─── 秒级计时 ──────────────────────────────────────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTasks((prev) => prev.map((t) => (t.isRunning ? { ...t, elapsed: t.elapsed + 1 } : t)));
      setLongTasks((prev) => prev.map((t) => (t.isRunning ? { ...t, elapsed: t.elapsed + 1 } : t)));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // ─── 前台恢复：从 FloatingService 同步 elapsed ─────────────────────
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android" || !FloatingWindow) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await FloatingWindow.getActiveTasks();
        const serviceMap: Record<string, number> = {};
        (res.tasks || []).forEach((t: { name: string; elapsed: number }) => { serviceMap[t.name] = t.elapsed; });
        setTasks((prev) => prev.map((t) => {
          const svcElapsed = serviceMap[t.name];
          if (t.isRunning && svcElapsed != null && svcElapsed > t.elapsed) return { ...t, elapsed: svcElapsed };
          return t;
        }));
      } catch (e) { /* ignore */ }

      // 切回前台时也做桶回溯检测（15分钟内，isRecent 15分钟）
      if (bucketDetectionRef.current) return;
      try {
        const vNow = Date.now();
        const vRes = await FloatingWindow.getUsageEvents({ startTime: vNow - 2 * 3600000, endTime: vNow });
        const vAllEvents: Array<{appName: string; start: number; end: number}> = vRes.sessions || [];
        for (const bucket of bucketsRef.current) {
          if (tasksRef.current.some(t => t.name === bucket.name && t.isRunning)) continue;
          if (sessionsRef.current.some(s => s.taskName === bucket.name &&
              s.endTime.getTime() > vNow - 2 * 3600000)) continue;
          const vEvts = vAllEvents.filter(e =>
            bucket.apps.some(a => a.toLowerCase() === e.appName.toLowerCase()));
          if (vEvts.length === 0) continue;
          const vSorted = [...vEvts].sort((a, b) => a.start - b.start);
          let vSegStart = vSorted[0].start, vSegEnd = vSorted[0].end;
          for (let i = 1; i < vSorted.length; i++) {
            if (vSorted[i].start - vSegEnd <= bucket.toleranceSeconds * 1000) {
              vSegEnd = Math.max(vSegEnd, vSorted[i].end);
            } else {
              vSegStart = vSorted[i].start;
              vSegEnd = vSorted[i].end;
            }
          }
          const vDurMin = (vSegEnd - vSegStart) / 60000;
          const vIsRecent = (vNow - vSegEnd) <= 15 * 60000; // 15分钟内
          if (!vIsRecent || vDurMin < bucket.triggerMinutes) continue;
          const vHourKey = Math.floor(vSegStart / 3600000);
          if (localStorage.getItem(`dismissed_bucket_${bucket.id}_${vHourKey}`)) continue;
          const vMode = (vNow - vSegEnd) > 10 * 60000 ? "retrospective" : "realtime";
          setBucketDetection({
            bucketId: bucket.id, bucketName: bucket.name, category: bucket.category,
            evalTag: bucket.evalTag, color: bucket.color,
            detectedMinutes: Math.round(vDurMin),
            trueStart: vSegStart, trueEnd: vSegEnd, mode: vMode,
          });
          break;
        }
      } catch (_) { /* ignore */ }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // ─── 应用桶实时检测（Android，每30s；同时处理已有检测的自动撤销） ────
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android" || !FloatingWindow) return;

    const pollBuckets = async () => {
      const now = Date.now();
      if (bucketsRef.current.length === 0) return;

      // 已有待确认检测：检查用户是否已离开桶 App 超过容忍时间，若是则自动撤销
      if (bucketDetectionRef.current) {
        const det = bucketDetectionRef.current;
        const bucket = bucketsRef.current.find(b => b.id === det.bucketId);
        if (bucket) {
          try {
            const chkRes = await FloatingWindow.getUsageEvents({ startTime: now - 10 * 60000, endTime: now });
            const chkEvts: Array<{appName: string; end: number}> = chkRes.sessions || [];
            const bucketEvts = chkEvts.filter(e =>
              bucket.apps.some(a => a.toLowerCase() === e.appName.toLowerCase()));
            const latestEnd = bucketEvts.length > 0 ? Math.max(...bucketEvts.map(e => e.end)) : 0;
            const stillRecent = bucketEvts.length > 0 && (now - latestEnd) <= bucket.toleranceSeconds * 2 * 1000;
            if (!stillRecent) {
              // 用户已离开，自动撤销
              setBucketDetection(null);
              try { FloatingWindow.dismissBucketAlert?.(); } catch(_) {}
            }
          } catch (_) {}
        }
        return;
      }

      // 无待确认检测：扫描近30分钟，isRecent=5分钟（实时检测）
      try {
        const res = await FloatingWindow.getUsageEvents({ startTime: now - 30 * 60000, endTime: now });
        const events: Array<{appName: string; start: number; end: number}> = res.sessions || [];
        if (events.length === 0) return;

        for (const bucket of bucketsRef.current) {
          if (tasksRef.current.some(t => t.name === bucket.name && t.isRunning)) continue;
          if (longTasksRef.current.some(t => t.name === bucket.name && t.isRunning)) continue;
          if (sessionsRef.current.some(s => s.taskName === bucket.name &&
              s.endTime.getTime() > now - 30 * 60000)) continue;

          const bEvents = events.filter(e =>
            bucket.apps.some(a => a.toLowerCase() === e.appName.toLowerCase()));
          if (bEvents.length === 0) continue;

          // 防抖合并：间隔 <= toleranceSeconds 的事件视为连续
          const sorted = [...bEvents].sort((a, b) => a.start - b.start);
          let segStart = sorted[0].start, segEnd = sorted[0].end;
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].start - segEnd <= bucket.toleranceSeconds * 1000) {
              segEnd = Math.max(segEnd, sorted[i].end);
            } else {
              segStart = sorted[i].start;
              segEnd = sorted[i].end;
            }
          }

          const isRecent = (now - segEnd) <= 5 * 60000; // 实时检测：5分钟内
          const durationMin = (segEnd - segStart) / 60000;
          if (!isRecent || durationMin < bucket.triggerMinutes) continue;

          const hourKey = Math.floor(segStart / 3600000);
          if (localStorage.getItem(`dismissed_bucket_${bucket.id}_${hourKey}`)) continue;

          const detection = {
            bucketId: bucket.id, bucketName: bucket.name, category: bucket.category,
            evalTag: bucket.evalTag, color: bucket.color,
            detectedMinutes: Math.round(durationMin),
            trueStart: segStart, trueEnd: now, mode: "realtime" as const,
          };
          setBucketDetection(detection);
          // 同时通过悬浮窗提醒（App 外也可见）
          try { FloatingWindow.showBucketAlert?.({ bucketName: bucket.name, detectedMinutes: Math.round(durationMin), color: bucket.color }); } catch(_) {}
          break;
        }
      } catch (e) { /* ignore */ }
    };

    const init = setTimeout(pollBuckets, 5000);
    const iv = setInterval(pollBuckets, 30000);
    return () => { clearTimeout(init); clearInterval(iv); };
  }, []);

  // ─── 并行计时任务 ─────────────────────────────────────────────────
  const addTask = useCallback((data: {
    name: string; description?: string; category: string; evalTag?: string;
    tags: string[]; estimatedMinutes?: number; startTime?: Date;
  }) => {
    const cat = getCategoryInfo(data.category);
    const customStart = data.startTime;
    const taskStart = customStart ?? new Date();
    const initialElapsed = customStart ? Math.max(0, Math.floor((Date.now() - customStart.getTime()) / 1000)) : 0;
    const newTask: Task = {
      id: makeId(), name: data.name, description: data.description,
      category: data.category, evalTag: data.evalTag, color: cat.color, bgColor: cat.bg,
      startTime: taskStart, elapsed: initialElapsed, isRunning: true,
      tags: data.tags, estimatedMinutes: data.estimatedMinutes,
    };
    setTasks((prev) => [...prev, newTask]);
    saveEvent(taskToEvent(newTask)).catch(console.warn);
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      FloatingWindow.startFloating({ name: newTask.name, startTime: Date.now() - initialElapsed * 1000, elapsed: 0, color: newTask.color });
    }
  }, []);

  const endTask = useCallback((id: string, feeling?: string, outcome?: "completed" | "abandoned") => {
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task) return;
    const session: WorkSession = {
      id: makeId(), taskName: task.name, category: task.category, evalTag: task.evalTag,
      color: task.color, startTime: task.startTime, endTime: new Date(),
      duration: task.elapsed, feeling, tags: task.tags, estimatedMinutes: task.estimatedMinutes, outcome,
    };
    setSessions((s) => [session, ...s]);
    saveEvent(sessionToEvent(session)).catch(console.warn);
    deleteEvent(task.id).catch(console.warn);
    const remaining = tasksRef.current.filter((t) => t.id !== id);
    setTasks(remaining);
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      if (!remaining.some((t) => t.isRunning)) FloatingWindow.stopFloating();
      else FloatingWindow.removeTask({ name: task.name });
    }
  }, []);

  const toggleTimer = useCallback((id: string) => {
    const task = tasksRef.current.find((t) => t.id === id);
    if (!task) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, isRunning: !t.isRunning } : t)));
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      if (task.isRunning) {
        FloatingWindow.startFloating({ name: task.name, startTime: 0, elapsed: task.elapsed, color: task.color });
      } else {
        FloatingWindow.startFloating({ name: task.name, startTime: Date.now() - task.elapsed * 1000, elapsed: 0, color: task.color });
      }
    }
  }, []);

  // ─── 长线任务 ─────────────────────────────────────────────────────
  const addLongTask = useCallback((data: {
    name: string; description?: string; category: string; evalTag?: string;
    tags: string[]; startTime?: Date;
  }) => {
    const cat = getCategoryInfo(data.category);
    const taskStart = data.startTime ?? new Date();
    const initialElapsed = data.startTime ? Math.max(0, Math.floor((Date.now() - data.startTime.getTime()) / 1000)) : 0;
    const newTask: LongTask = {
      id: makeId(), name: data.name, description: data.description,
      category: data.category, evalTag: data.evalTag, color: cat.color, bgColor: cat.bg,
      startTime: taskStart, elapsed: initialElapsed, isRunning: true,
      tags: data.tags, checkpoints: [],
    };
    setLongTasks((prev) => [...prev, newTask]);
    saveEvent(longTaskToEvent(newTask)).catch(console.warn);
    // 推入悬浮窗
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      FloatingWindow.startFloating({ name: `[长] ${newTask.name}`, startTime: Date.now() - initialElapsed * 1000, elapsed: 0, color: newTask.color });
    }
  }, []);

  const endLongTask = useCallback((id: string, feeling?: string, outcome?: "completed" | "abandoned") => {
    const task = longTasksRef.current.find((t) => t.id === id);
    if (!task) return;
    const session: WorkSession = {
      id: makeId(), taskName: task.name, category: task.category, evalTag: task.evalTag,
      color: task.color, startTime: task.startTime, endTime: new Date(),
      duration: task.elapsed, feeling, tags: task.tags, outcome,
    };
    setSessions((prev) => [session, ...prev]);
    saveEvent(sessionToEvent(session)).catch(console.warn);
    deleteEvent(task.id).catch(console.warn);
    setLongTasks((prev) => prev.filter((t) => t.id !== id));
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      FloatingWindow.removeTask({ name: `[长] ${task.name}` });
    }
  }, []);

  const toggleLongTask = useCallback((id: string) => {
    const task = longTasksRef.current.find((t) => t.id === id);
    if (!task) return;
    setLongTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, isRunning: !t.isRunning };
      saveEvent(longTaskToEvent(updated)).catch(console.warn);
      return updated;
    }));
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      const floatName = `[长] ${task.name}`;
      if (task.isRunning) {
        // 暂停
        FloatingWindow.startFloating({ name: floatName, startTime: 0, elapsed: task.elapsed, color: task.color });
      } else {
        // 恢复
        FloatingWindow.startFloating({ name: floatName, startTime: Date.now() - task.elapsed * 1000, elapsed: 0, color: task.color });
      }
    }
  }, []);

  const addCheckpoint = useCallback((taskId: string, text: string) => {
    const cp: LongTaskCheckpoint = { id: makeId(), text, completed: false };
    setLongTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const updated = { ...t, checkpoints: [...t.checkpoints, cp] };
      saveEvent(longTaskToEvent(updated)).catch(console.warn);
      return updated;
    }));
  }, []);

  const toggleCheckpoint = useCallback((taskId: string, checkpointId: string) => {
    setLongTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const updated = {
        ...t,
        checkpoints: t.checkpoints.map((c) =>
          c.id === checkpointId ? { ...c, completed: !c.completed, completedAt: !c.completed ? Date.now() : undefined } : c
        ),
      };
      saveEvent(longTaskToEvent(updated)).catch(console.warn);
      return updated;
    }));
  }, []);

  const deleteCheckpoint = useCallback((taskId: string, checkpointId: string) => {
    setLongTasks((prev) => prev.map((t) => {
      if (t.id !== taskId) return t;
      const updated = { ...t, checkpoints: t.checkpoints.filter((c) => c.id !== checkpointId) };
      saveEvent(longTaskToEvent(updated)).catch(console.warn);
      return updated;
    }));
  }, []);

  // ─── 应用桶 ──────────────────────────────────────────────────────
  const addBucket = useCallback((data: Omit<AppBucket, "id">) => {
    const newBucket: AppBucket = { id: makeId(), ...data };
    setAppBuckets((prev) => [...prev, newBucket]);
    saveEvent(bucketConfigToEvent(newBucket)).catch(console.warn);
  }, []);

  const updateBucket = useCallback((bucket: AppBucket) => {
    setAppBuckets((prev) => prev.map((b) => (b.id === bucket.id ? bucket : b)));
    saveEvent(bucketConfigToEvent(bucket)).catch(console.warn);
  }, []);

  const deleteBucket = useCallback((id: string) => {
    setAppBuckets((prev) => prev.filter((b) => b.id !== id));
    deleteEvent(id).catch(console.warn);
  }, []);

  const confirmBucketDetection = useCallback(() => {
    const det = bucketDetectionRef.current;
    if (!det) return;
    const hourKey = Math.floor(det.trueStart / 3600000);
    localStorage.setItem(`dismissed_bucket_${det.bucketId}_${hourKey}`, "confirmed");
    setBucketDetection(null);
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      try { FloatingWindow.dismissBucketAlert?.(); } catch(_) {}
    }
    const cat = getCategoryInfo(det.category);

    if (det.mode === "retrospective") {
      // 补录为已完成的时间记录（类似睡眠确认）
      const session: WorkSession = {
        id: makeId(), taskName: det.bucketName, category: det.category,
        evalTag: det.evalTag, color: det.color,
        startTime: new Date(det.trueStart), endTime: new Date(det.trueEnd),
        duration: Math.round((det.trueEnd - det.trueStart) / 1000),
        tags: [],
      };
      setSessions((prev) => [session, ...prev]);
      saveEvent(sessionToEvent(session)).catch(console.warn);
    } else {
      // 实时：创建运行中的计时任务（回填已用时间）
      const initialElapsed = Math.max(0, Math.floor((Date.now() - det.trueStart) / 1000));
      const newTask: Task = {
        id: makeId(), name: det.bucketName, category: det.category,
        evalTag: det.evalTag, color: det.color, bgColor: cat.bg,
        startTime: new Date(det.trueStart), elapsed: initialElapsed,
        isRunning: true, tags: [],
      };
      setTasks((prev) => [...prev, newTask]);
      saveEvent(taskToEvent(newTask)).catch(console.warn);
      if (Capacitor.getPlatform() === "android" && FloatingWindow) {
        FloatingWindow.startFloating({ name: newTask.name, startTime: Date.now() - initialElapsed * 1000, elapsed: 0, color: newTask.color });
      }
    }
  }, []);

  const dismissBucketDetection = useCallback(() => {
    const det = bucketDetectionRef.current;
    if (det) {
      const hourKey = Math.floor(det.trueStart / 3600000);
      localStorage.setItem(`dismissed_bucket_${det.bucketId}_${hourKey}`, "dismissed");
    }
    setBucketDetection(null);
    if (Capacitor.getPlatform() === "android" && FloatingWindow) {
      try { FloatingWindow.dismissBucketAlert?.(); } catch(_) {}
    }
  }, []);

  // ─── 待办 ─────────────────────────────────────────────────────────
  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const toggled = { ...t, completed: !t.completed };
      saveEvent(todoToEvent(toggled)).catch(console.warn);
      return toggled;
    }));
  }, []);

  const addTodo = useCallback((text: string, category: string, priority: "high" | "medium" | "low") => {
    const newTodo: TodoItem = { id: makeId(), text, completed: false, priority, category, archived: false };
    setTodos((prev) => [...prev, newTodo]);
    saveEvent(todoToEvent(newTodo)).catch(console.warn);
  }, []);

  const archiveTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const archived = { ...t, archived: true };
      saveEvent(todoToEvent(archived)).catch(console.warn);
      return archived;
    }));
  }, []);

  const unarchiveTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const unarchived = { ...t, archived: false };
      saveEvent(todoToEvent(unarchived)).catch(console.warn);
      return unarchived;
    }));
  }, []);

  // ─── 睡眠建议 ─────────────────────────────────────────────────────
  const confirmSleep = useCallback((suggestionId: string) => {
    setSleepSuggestions((prev) => {
      const s = prev.find((p) => p.id === suggestionId);
      if (!s) return prev;
      const cat = getCategoryInfo("睡觉");
      const session: WorkSession = {
        id: makeId(), taskName: "睡觉", category: "睡觉", color: cat.color,
        startTime: new Date(s.start), endTime: new Date(s.end),
        duration: Math.round((s.end - s.start) / 1000), tags: [],
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

  // ─── 其他 ─────────────────────────────────────────────────────────
  const exportToCSV = useCallback(() => downloadCSV(sessions), [sessions]);

  const addManualSession = useCallback((data: {
    name: string; category: string; evalTag?: string;
    startTime: Date; endTime: Date; feeling?: string; tags: string[];
  }) => {
    const cat = getCategoryInfo(data.category);
    const session: WorkSession = {
      id: makeId(), taskName: data.name, category: data.category, evalTag: data.evalTag,
      color: cat.color, startTime: data.startTime, endTime: data.endTime,
      duration: Math.round((data.endTime.getTime() - data.startTime.getTime()) / 1000),
      feeling: data.feeling, tags: data.tags,
    };
    setSessions((s) => [session, ...s]);
    saveEvent(sessionToEvent(session)).catch(console.warn);
  }, []);

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
    setTasks([]); setSessions([]); setTodos([]); setLongTasks([]); setAppBuckets([]);
  }, []);

  return (
    <AppContext.Provider value={{
      tasks, todos, sessions,
      addTask, endTask, updateSession: updateSessionFn, addManualSession,
      deleteSession: deleteSessionFn, exportToCSV, clearAllData: clearAllDataFn,
      toggleTimer, toggleTodo, addTodo, archiveTodo, unarchiveTodo,
      sleepSuggestions, confirmSleep, dismissSleep,
      showFloating: () => {
        if (Capacitor.getPlatform() !== "android" || !FloatingWindow) return;
        tasksRef.current.filter((t) => t.isRunning).forEach((t) => {
          FloatingWindow.startFloating({ name: t.name, startTime: Date.now() - t.elapsed * 1000, elapsed: 0, color: t.color });
        });
        longTasksRef.current.filter((t) => t.isRunning).forEach((t) => {
          FloatingWindow.startFloating({ name: `[长] ${t.name}`, startTime: Date.now() - t.elapsed * 1000, elapsed: 0, color: t.color });
        });
      },
      longTasks, addLongTask, endLongTask, toggleLongTask,
      addCheckpoint, toggleCheckpoint, deleteCheckpoint,
      appBuckets, addBucket, updateBucket, deleteBucket,
      bucketDetection, confirmBucketDetection, dismissBucketDetection, recentAppNames,
      showNewTaskDialog, setShowNewTaskDialog,
      showEndTaskDialog, setShowEndTaskDialog,
      showManualSessionDialog, setShowManualSessionDialog,
      manualPrefill,
      openManualWithPrefill: (prefill) => { setManualPrefill(prefill); setShowManualSessionDialog(true); },
      showNewLongTaskDialog, setShowNewLongTaskDialog,
      taskToEnd, setTaskToEnd,
    }}>
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
