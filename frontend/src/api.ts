import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;

export type ApiError = { detail: string };

async function request<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (opts.auth !== false) {
    const token = await AsyncStorage.getItem("jcip_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, { ...opts, headers });
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
  return data as T;
}

export const api = {
  get: <T,>(p: string) => request<T>(p, { method: "GET" }),
  post: <T,>(p: string, body?: any, auth = true) =>
    request<T>(p, { method: "POST", body: JSON.stringify(body || {}), auth }),
  put: <T,>(p: string, body?: any) =>
    request<T>(p, { method: "PUT", body: JSON.stringify(body || {}) }),
  del: <T,>(p: string) => request<T>(p, { method: "DELETE" }),
};

export const STORAGE = {
  TOKEN: "jcip_token",
  USER: "jcip_user",
  HOUSE: "jcip_house_id",
};
