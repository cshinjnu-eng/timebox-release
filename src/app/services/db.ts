/**
 * IndexedDB 持久化层 — 基于 ActivityWatch 的 Bucket/Event 数据模型
 * v3: 新增 userTags store
 * v4: 新增 aiConfig + aiInsights store
 */

const DB_NAME = "TimeBoxDB";
const DB_VERSION = 4;

// ─── 数据模型 ─────────────────────────────────────────────────────────

export interface Bucket {
  id: string;
  name: string;
  type: "tasks" | "todos" | "sessions";
  client: string;
  created: string; // ISO8601 UTC
}

export interface EventRecord {
  id: string;
  bucketId: string;
  timestamp: string; // ISO8601 UTC
  duration: number; // seconds
  data: Record<string, unknown>;
}

// ─── 数据库初始化 ──────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      // ─── v1 stores ───
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains("buckets")) {
          db.createObjectStore("buckets", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("events")) {
          const store = db.createObjectStore("events", { keyPath: "id" });
          store.createIndex("bucketId", "bucketId", { unique: false });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      }

      // ─── v2 stores: ideas / milestones / ideaTasks ───
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains("ideas")) {
          const ideasStore = db.createObjectStore("ideas", { keyPath: "id" });
          ideasStore.createIndex("stage", "stage", { unique: false });
          ideasStore.createIndex("category", "category", { unique: false });
          ideasStore.createIndex("createdAt", "createdAt", { unique: false });
        }
        if (!db.objectStoreNames.contains("milestones")) {
          const msStore = db.createObjectStore("milestones", { keyPath: "id" });
          msStore.createIndex("ideaId", "ideaId", { unique: false });
          msStore.createIndex("status", "status", { unique: false });
        }
        if (!db.objectStoreNames.contains("ideaTasks")) {
          const taskStore = db.createObjectStore("ideaTasks", { keyPath: "id" });
          taskStore.createIndex("ideaId", "ideaId", { unique: false });
          taskStore.createIndex("milestoneId", "milestoneId", { unique: false });
          taskStore.createIndex("status", "status", { unique: false });
        }
      }

      // ─── v3 stores: userTags ───
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains("userTags")) {
          db.createObjectStore("userTags", { keyPath: "name" });
        }
      }

      // ─── v4 stores: aiConfig + aiInsights ───
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains("aiConfig")) {
          db.createObjectStore("aiConfig", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("aiInsights")) {
          const insightsStore = db.createObjectStore("aiInsights", { keyPath: "id" });
          insightsStore.createIndex("createdAt", "createdAt", { unique: false });
          insightsStore.createIndex("type", "type", { unique: false });
        }
      }
    };
  });
}

// ─── 通用 CRUD ────────────────────────────────────────────────────────

async function put<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAllByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const idx = tx.objectStore(storeName).index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ─── Bucket 操作 ──────────────────────────────────────────────────────

export async function saveBucket(bucket: Bucket): Promise<void> {
  return put("buckets", bucket);
}

export async function getAllBuckets(): Promise<Bucket[]> {
  return getAll("buckets");
}

// ─── Event 操作 ───────────────────────────────────────────────────────

export async function saveEvent(event: EventRecord): Promise<void> {
  return put("events", event);
}

export async function deleteEvent(id: string): Promise<void> {
  return remove("events", id);
}

export async function getEventsByBucket(bucketId: string): Promise<EventRecord[]> {
  return getAllByIndex("events", "bucketId", bucketId);
}

export async function getAllEvents(): Promise<EventRecord[]> {
  return getAll("events");
}

// ─── Ideas CRUD ──────────────────────────────────────────────────────

export async function saveIdea(idea: Record<string, any>): Promise<void> {
  return put("ideas", idea);
}

export async function deleteIdea(id: string): Promise<void> {
  return remove("ideas", id);
}

export async function getAllIdeas(): Promise<Record<string, any>[]> {
  return getAll("ideas");
}

// ─── Milestones CRUD ─────────────────────────────────────────────────

export async function saveMilestone(ms: Record<string, any>): Promise<void> {
  return put("milestones", ms);
}

export async function deleteMilestone(id: string): Promise<void> {
  return remove("milestones", id);
}

export async function getAllMilestones(): Promise<Record<string, any>[]> {
  return getAll("milestones");
}

export async function getMilestonesByIdea(ideaId: string): Promise<Record<string, any>[]> {
  return getAllByIndex("milestones", "ideaId", ideaId);
}

// ─── IdeaTasks CRUD ──────────────────────────────────────────────────

export async function saveIdeaTask(task: Record<string, any>): Promise<void> {
  return put("ideaTasks", task);
}

export async function deleteIdeaTask(id: string): Promise<void> {
  return remove("ideaTasks", id);
}

export async function getAllIdeaTasks(): Promise<Record<string, any>[]> {
  return getAll("ideaTasks");
}

export async function getIdeaTasksByIdea(ideaId: string): Promise<Record<string, any>[]> {
  return getAllByIndex("ideaTasks", "ideaId", ideaId);
}

export async function getIdeaTasksByMilestone(milestoneId: string): Promise<Record<string, any>[]> {
  return getAllByIndex("ideaTasks", "milestoneId", milestoneId);
}

// ─── UserTags CRUD ──────────────────────────────────────────────────

export async function saveUserTag(tag: Record<string, any>): Promise<void> {
  return put("userTags", tag);
}

export async function deleteUserTag(name: string): Promise<void> {
  return remove("userTags", name);
}

export async function getAllUserTags(): Promise<Record<string, any>[]> {
  return getAll("userTags");
}

// ─── AIConfig CRUD ──────────────────────────────────────────────────

export async function saveAIConfig(config: Record<string, any>): Promise<void> {
  return put("aiConfig", config);
}

export async function getAIConfig(): Promise<Record<string, any> | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("aiConfig", "readonly");
    const req = tx.objectStore("aiConfig").get("default");
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ─── AIInsights CRUD ────────────────────────────────────────────────

export async function saveAIInsight(insight: Record<string, any>): Promise<void> {
  return put("aiInsights", insight);
}

export async function deleteAIInsight(id: string): Promise<void> {
  return remove("aiInsights", id);
}

export async function getAllAIInsights(): Promise<Record<string, any>[]> {
  return getAll("aiInsights");
}

// ─── 清空所有数据 ─────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  const db = await openDB();
  const storeNames = ["events", "buckets", "ideas", "milestones", "ideaTasks", "userTags", "aiInsights"];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ─── 初始化默认 Buckets ──────────────────────────────────────────────

export async function ensureDefaultBuckets(): Promise<void> {
  const buckets = await getAllBuckets();
  const now = new Date().toISOString();

  const defaults: Bucket[] = [
    { id: "timebox-tasks", name: "计时任务", type: "tasks", client: "timebox-web", created: now },
    { id: "timebox-todos", name: "待办事项", type: "todos", client: "timebox-web", created: now },
    { id: "timebox-sessions", name: "工作记录", type: "sessions", client: "timebox-web", created: now },
  ];

  for (const d of defaults) {
    if (!buckets.find((b) => b.id === d.id)) {
      await saveBucket(d);
    }
  }
}
