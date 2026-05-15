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

function splitDateParts(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const [date, time = ""] = raw.replace("T", " ").split(" ");
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return null;
  return { year, month, day, time };
}

export const formatDateBR = (value?: string | null) => {
  const parts = splitDateParts(value);
  if (!parts) return "Sem data";
  return `${parts.day}/${parts.month}/${parts.year}`;
};

export const formatDateTimeBR = (value?: string | null) => {
  const parts = splitDateParts(value);
  if (!parts) return "Sem data e hora";
  const hour = parts.time ? parts.time.slice(0, 5) : "";
  return `${parts.day}/${parts.month}/${parts.year}${hour ? ` às ${hour}` : ""}`;
};

export const todayISODate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const dateBRToISO = (value: string) => {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [day, month, year] = raw.split("/");
  if (!day || !month || !year) return raw;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};
