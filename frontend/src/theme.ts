export const colors = {
  bg: "#fafaf9",          // stone-50
  surface: "#ffffff",
  textPrimary: "#1c1917", // stone-900
  textSecondary: "#78716c", // stone-500
  textMuted: "#a8a29e",    // stone-400
  border: "#e7e5e4",       // stone-200
  borderLight: "#f5f5f4",  // stone-100

  positive: "#059669",     // emerald-600
  positiveBg: "#ecfdf5",   // emerald-50
  debt: "#e11d48",         // rose-600
  debtBg: "#fff1f2",       // rose-50
  neutral: "#2563eb",      // blue-600
  neutralBg: "#eff6ff",    // blue-50

  primary: "#1c1917",      // stone-900 — primary buttons
  primaryText: "#ffffff",
  warning: "#f59e0b",
};

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
