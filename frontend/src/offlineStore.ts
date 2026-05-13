import * as SQLite from "expo-sqlite";

const DB_NAME = "jcip_house_finance.db";

export type QueuedOperation = {
  id: string;
  method: string;
  path: string;
  body: string | null;
  auth: number;
  created_at: string;
  attempts: number;
  last_error: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function localId(prefix = "local") {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rnd}`;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS api_cache (
          path TEXT PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY NOT NULL,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          body TEXT,
          auth INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'pending',
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sync_outbox_status_created
          ON sync_outbox (status, created_at);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function cacheApiResponse(path: string, data: unknown) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO api_cache (path, data, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
    path,
    JSON.stringify(data),
    nowIso()
  );
}

export async function getCachedApiResponse<T>(path: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ data: string }>(
    "SELECT data FROM api_cache WHERE path=?",
    path
  );
  if (!row) return null;
  return JSON.parse(row.data) as T;
}

export async function enqueueApiMutation(input: {
  method: string;
  path: string;
  body?: string | null;
  auth?: boolean;
}) {
  const db = await getDb();
  const id = localId("sync");
  const createdAt = nowIso();
  await db.runAsync(
    `INSERT INTO sync_outbox
      (id, method, path, body, auth, status, attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    id,
    input.method.toUpperCase(),
    input.path,
    input.body ?? null,
    input.auth === false ? 0 : 1,
    createdAt,
    createdAt
  );
  return { id, created_at: createdAt };
}

export async function listPendingApiMutations(limit = 50) {
  const db = await getDb();
  return db.getAllAsync<QueuedOperation>(
    `SELECT id, method, path, body, auth, created_at, attempts, last_error
     FROM sync_outbox
     WHERE status='pending'
     ORDER BY created_at ASC
     LIMIT ?`,
    limit
  );
}

export async function markApiMutationSynced(id: string) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE sync_outbox SET status='synced', updated_at=? WHERE id=?",
    nowIso(),
    id
  );
}

export async function markApiMutationFailed(id: string, error: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_outbox
     SET attempts=attempts + 1, last_error=?, updated_at=?
     WHERE id=?`,
    error.slice(0, 500),
    nowIso(),
    id
  );
}

export async function getPendingMutationCount() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM sync_outbox WHERE status='pending'"
  );
  return row?.total ?? 0;
}

export async function initializeOfflineStore() {
  await getDb();
}
