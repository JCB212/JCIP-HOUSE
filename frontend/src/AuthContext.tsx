import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, STORAGE, syncPendingOperations } from "./api";
import { getPendingMutationCount, initializeOfflineStore } from "./offlineStore";
import { getIsOnline, subscribeToConnectivity } from "./network";

export type User = { id: string; email: string; name: string; avatar_url?: string | null };
export type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  weight: number;
  role: string;
  permissions?: Record<string, boolean>;
  avatar_url?: string | null;
};
export type House = {
  id: string;
  name: string;
  invite_code: string;
  currency: string;
  owner_id: string;
  gamification_enabled: boolean;
  month_start_day: number;
  permissions_catalog?: Record<string, string>;
  members: Member[];
};

type Ctx = {
  user: User | null;
  token: string | null;
  house: House | null;
  houses: House[];
  loading: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string, acceptedLgpd?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setHouse: (h: House | null) => void;
  refreshHouses: () => Promise<House[]>;
  createHouse: (name: string) => Promise<House>;
  joinHouse: (code: string) => Promise<House>;
  updateUserName: (name: string) => Promise<User>;
  syncNow: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [house, setHouseState] = useState<House | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        await initializeOfflineStore();
        setIsOnline(await getIsOnline());
        setPendingSyncCount(await getPendingMutationCount());
        const t = await AsyncStorage.getItem(STORAGE.TOKEN);
        const u = await AsyncStorage.getItem(STORAGE.USER);
        if (t && u) {
          setToken(t);
          setUser(JSON.parse(u));
          await refreshHousesInternal();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToConnectivity((online) => {
      setIsOnline(online);
      if (online && token) {
        syncPendingOperations()
          .then((result) => setPendingSyncCount(result.pending))
          .catch((e) => console.warn("sync failed", e));
      }
    });
    return unsubscribe;
  }, [token]);

  async function refreshHousesInternal() {
    const list = await api.get<House[]>("/houses");
    setHouses(list);
    const storedId = await AsyncStorage.getItem(STORAGE.HOUSE);
    const found = list.find((h) => h.id === storedId) || list[0] || null;
    setHouseState(found);
    if (found) await AsyncStorage.setItem(STORAGE.HOUSE, found.id);
    return list;
  }

  async function login(email: string, password: string) {
    const r = await api.post<{ token: string; user: User }>(
      "/auth/login",
      { email, password },
      false
    );
    await AsyncStorage.setItem(STORAGE.TOKEN, r.token);
    await AsyncStorage.setItem(STORAGE.USER, JSON.stringify(r.user));
    setToken(r.token);
    setUser(r.user);
    await refreshHousesInternal();
    await syncNow();
  }

  async function register(email: string, name: string, password: string, acceptedLgpd = false) {
    const r = await api.post<{ token: string; user: User }>(
      "/auth/register",
      { email, name, password, accepted_lgpd: acceptedLgpd },
      false
    );
    await AsyncStorage.setItem(STORAGE.TOKEN, r.token);
    await AsyncStorage.setItem(STORAGE.USER, JSON.stringify(r.user));
    setToken(r.token);
    setUser(r.user);
    setHouses([]);
    setHouseState(null);
    await setPendingSyncCount(await getPendingMutationCount());
  }

  async function logout() {
    await AsyncStorage.multiRemove([STORAGE.TOKEN, STORAGE.USER, STORAGE.HOUSE]);
    setToken(null);
    setUser(null);
    setHouseState(null);
    setHouses([]);
    setPendingSyncCount(0);
  }

  async function createHouse(name: string) {
    const h = await api.post<House>("/houses", { name, currency: "BRL" });
    await AsyncStorage.setItem(STORAGE.HOUSE, h.id);
    setHouses((prev) => [...prev, h]);
    setHouseState(h);
    return h;
  }

  async function joinHouse(code: string) {
    const h = await api.post<House>("/houses/join", { invite_code: code });
    await AsyncStorage.setItem(STORAGE.HOUSE, h.id);
    setHouses((prev) => {
      const others = prev.filter((p) => p.id !== h.id);
      return [...others, h];
    });
    setHouseState(h);
    return h;
  }

  async function updateUserName(name: string) {
    const updated = await api.put<User>("/auth/me", { name });
    await AsyncStorage.setItem(STORAGE.USER, JSON.stringify(updated));
    setUser(updated);
    return updated;
  }

  function setHouse(h: House | null) {
    setHouseState(h);
    if (h) AsyncStorage.setItem(STORAGE.HOUSE, h.id);
  }

  async function syncNow() {
    if (!token) {
      setPendingSyncCount(await getPendingMutationCount());
      return;
    }
    const result = await syncPendingOperations();
    setPendingSyncCount(result.pending);
    if (result.synced > 0) {
      await refreshHousesInternal().catch(() => undefined);
    }
  }

  return (
    <AuthCtx.Provider
      value={{
        user,
        token,
        house,
        houses,
        loading,
        isOnline,
        pendingSyncCount,
        login,
        register,
        logout,
        setHouse,
        refreshHouses: refreshHousesInternal,
        createHouse,
        joinHouse,
        updateUserName,
        syncNow,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
