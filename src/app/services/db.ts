/**
 * IndexedDB 持久化层 — 基于 ActivityWatch 的 Bucket/Event 数据模型
 */

const DB_NAME = "TimeBoxDB";
const DB_VERSION = 1;

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
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("buckets")) {
        db.createObjectStore("buckets", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("events")) {
        const store = db.createObjectStore("events", { keyPath: "id" });
        store.createIndex("bucketId", "bucketId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
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
