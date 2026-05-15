import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type AppMode = "house" | "finance";

type AppModeCtx = {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => Promise<void>;
  toggleAppMode: () => Promise<void>;
};

const STORAGE_KEY = "jcip_app_mode";
const AppModeContext = createContext<AppModeCtx | null>(null);

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [appMode, setAppModeState] = useState<AppMode>("finance");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "house" || stored === "finance") setAppModeState(stored);
    });
  }, []);

  async function setAppMode(nextMode: AppMode) {
    setAppModeState(nextMode);
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
  }

  async function toggleAppMode() {
    await setAppMode(appMode === "finance" ? "house" : "finance");
  }

  return (
    <AppModeContext.Provider value={{ appMode, setAppMode, toggleAppMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be inside AppModeProvider");
  return ctx;
}
