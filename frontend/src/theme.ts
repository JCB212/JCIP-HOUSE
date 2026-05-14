import { Appearance } from "react-native";

export const lightColors = {
  bg: "#f7fbff",
  surface: "#ffffff",
  surfaceSoft: "#eef7ff",
  textPrimary: "#07192b",
  textSecondary: "#557086",
  textMuted: "#8aa0b2",
  border: "#dbe8f2",
  borderLight: "#edf5fb",

  positive: "#059669",
  positiveBg: "#e8fbf2",
  debt: "#e11d48",
  debtBg: "#fff0f4",
  neutral: "#1688d3",
  neutralBg: "#e8f6ff",

  primary: "#07192b",
  primarySoft: "#dff4ff",
  primaryText: "#ffffff",
  warning: "#f59e0b",
};

export const darkColors = {
  bg: "#03111f",
  surface: "#071b2e",
  surfaceSoft: "#0d2942",
  textPrimary: "#e7f6ff",
  textSecondary: "#a8c5da",
  textMuted: "#7392a8",
  border: "#173550",
  borderLight: "#0b2338",

  positive: "#10b981",
  positiveBg: "#0d3026",
  debt: "#f43f5e",
  debtBg: "#35121b",
  neutral: "#38bdf8",
  neutralBg: "#0c2c45",

  primary: "#0b2a42",
  primarySoft: "#123a5a",
  primaryText: "#e7f6ff",
  warning: "#fbbf24",
};

export type AppColors = typeof lightColors;

export const isDarkMode = Appearance.getColorScheme() === "dark";
export const colors: AppColors = isDarkMode ? darkColors : lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
};

export const formatBRL = (v: number, currency = "BRL") => {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(v || 0);
  } catch {
    return `R$ ${(v || 0).toFixed(2)}`;
  }
};
