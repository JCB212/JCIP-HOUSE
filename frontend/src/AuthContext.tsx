import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, STORAGE } from "./api";

export type User = { id: string; email: string; name: string; avatar_url?: string | null };
export type Member = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  weight: number;
  role: string;
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
  members: Member[];
};

type Ctx = {
  user: User | null;
  token: string | null;
  house: House | null;
  houses: House[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setHouse: (h: House | null) => void;
  refreshHouses: () => Promise<House[]>;
  createHouse: (name: string) => Promise<House>;
  joinHouse: (code: string) => Promise<House>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [house, setHouseState] = useState<House | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
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
  }

  async function register(email: string, name: string, password: string) {
    const r = await api.post<{ token: string; user: User }>(
      "/auth/register",
      { email, name, password },
      false
    );
    await AsyncStorage.setItem(STORAGE.TOKEN, r.token);
    await AsyncStorage.setItem(STORAGE.USER, JSON.stringify(r.user));
    setToken(r.token);
    setUser(r.user);
    setHouses([]);
    setHouseState(null);
  }

  async function logout() {
    await AsyncStorage.multiRemove([STORAGE.TOKEN, STORAGE.USER, STORAGE.HOUSE]);
    setToken(null);
    setUser(null);
    setHouseState(null);
    setHouses([]);
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

  function setHouse(h: House | null) {
    setHouseState(h);
    if (h) AsyncStorage.setItem(STORAGE.HOUSE, h.id);
  }

  return (
    <AuthCtx.Provider
      value={{
        user,
        token,
        house,
        houses,
        loading,
        login,
        register,
        logout,
        setHouse,
        refreshHouses: refreshHousesInternal,
        createHouse,
        joinHouse,
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
