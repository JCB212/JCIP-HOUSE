import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  cacheApiResponse,
  enqueueApiMutation,
  getCachedApiResponse,
  getPendingMutationCount,
  listPendingApiMutations,
  markApiMutationFailed,
  markApiMutationSynced,
} from "./offlineStore";
import { getIsOnline } from "./network";

const BASE = String(process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export type ApiError = { detail: string };
export type SyncResult = { synced: number; failed: number; pending: number };

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isAuthPath(path: string) {
  return path.startsWith("/auth/");
}

function canQueueOfflineMutation(path: string) {
  if (isAuthPath(path)) return false;
  if (path === "/houses" || path === "/houses/join") return false;
  if (/^\/houses\/[^/]+\/settings$/.test(path)) return false;
  if (/^\/houses\/[^/]+\/members\/weight$/.test(path)) return false;
  return true;
}

function offlineQueuedResponse<T>(queued: { id: string; created_at: string }): T {
  return {
    ok: true,
    offline: true,
    queued: true,
    local_id: queued.id,
    created_at: queued.created_at,
  } as T;
}

function shouldTryCloud(isOnline: boolean | null) {
  return !!BASE && isOnline !== false;
}

async function request<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const method = String(opts.method || "GET").toUpperCase();
  const body = typeof opts.body === "string" ? opts.body : opts.body ? JSON.stringify(opts.body) : null;
  const isMutation = MUTATING_METHODS.has(method);
  const auth = opts.auth !== false;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (auth) {
    const token = await AsyncStorage.getItem("jcip_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const online = await getIsOnline().catch(() => null);

  if (!shouldTryCloud(online)) {
    if (method === "GET") {
      const cached = await getCachedApiResponse<T>(path);
      if (cached) return cached;
      throw new Error("Sem conexão e sem dados salvos neste dispositivo ainda.");
    }
    if (isMutation && auth && canQueueOfflineMutation(path)) {
      const queued = await enqueueApiMutation({ method, path, body, auth });
      return offlineQueuedResponse<T>(queued);
    }
    throw new Error("Sem conexão com a internet.");
  }

  try {
    const res = await fetch(`${BASE}/api${path}`, { ...opts, method, body: body ?? undefined, headers });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      const msg = data?.detail || data || `Erro ${res.status}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    if (method === "GET") {
      await cacheApiResponse(path, data);
    }
    return data as T;
  } catch (e: any) {
    if (method === "GET") {
      const cached = await getCachedApiResponse<T>(path);
      if (cached) return cached;
    }
    if (isMutation && auth && canQueueOfflineMutation(path)) {
      const queued = await enqueueApiMutation({ method, path, body, auth });
      return offlineQueuedResponse<T>(queued);
    }
    throw e;
  }
}

export async function syncPendingOperations(): Promise<SyncResult> {
  if (!BASE || !(await getIsOnline().catch(() => false))) {
    return { synced: 0, failed: 0, pending: await getPendingMutationCount() };
  }

  const token = await AsyncStorage.getItem("jcip_token");
  const operations = await listPendingApiMutations();
  let synced = 0;
  let failed = 0;

  for (const op of operations) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (op.auth && token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE}/api${op.path}`, {
        method: op.method,
        headers,
        body: op.body ?? undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Erro ${res.status}`);
      }
      await markApiMutationSynced(op.id);
      synced++;
    } catch (e: any) {
      await markApiMutationFailed(op.id, e?.message || "Falha ao sincronizar");
      failed++;
      break;
    }
  }

  return { synced, failed, pending: await getPendingMutationCount() };
}

export const api = {
  get: <T,>(p: string) => request<T>(p, { method: "GET" }),
  post: <T,>(p: string, body?: any, auth = true) =>
    request<T>(p, { method: "POST", body: JSON.stringify(body || {}), auth }),
  put: <T,>(p: string, body?: any) =>
    request<T>(p, { method: "PUT", body: JSON.stringify(body || {}) }),
  del: <T,>(p: string) => request<T>(p, { method: "DELETE" }),
  syncPending: syncPendingOperations,
  getPendingMutationCount,
};

export const STORAGE = {
  TOKEN: "jcip_token",
  USER: "jcip_user",
  HOUSE: "jcip_house_id",
};
