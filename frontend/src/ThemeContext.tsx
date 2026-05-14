import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import { AppColors, darkColors, lightColors } from "./theme";

type ThemeMode = "light" | "dark";

type ThemeCtx = {
  mode: ThemeMode;
  colors: AppColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const STORAGE_KEY = "jcip_theme_mode";
const ThemeContext = createContext<ThemeCtx | null>(null);

function systemMode(): ThemeMode {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(systemMode());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "light" || stored === "dark") {
        applyMode(stored);
      } else {
        applyMode(systemMode());
      }
    });
  }, []);

  async function applyMode(nextMode: ThemeMode) {
    setModeState(nextMode);
    Appearance.setColorScheme?.(nextMode);
    await SystemUI.setBackgroundColorAsync(nextMode === "dark" ? darkColors.bg : lightColors.bg).catch(() => undefined);
  }

  async function setMode(nextMode: ThemeMode) {
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
    await applyMode(nextMode);
  }

  async function toggleTheme() {
    await setMode(mode === "dark" ? "light" : "dark");
  }

  const value: ThemeCtx = {
    mode,
    colors: mode === "dark" ? darkColors : lightColors,
    setMode,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be inside ThemeProvider");
  return ctx;
}
