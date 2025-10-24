// /styles/colors.ts

// 🌞 Light mode palette
export const LightColors = {
  primary: "#0EA5E9",
  primaryLight: "#38BDF8",

  background: "#FFFFFF",
  surface: "#F9FAFB",

  textPrimary: "#111827",
  textSecondary: "#6B7280",

  border: "#E5E7EB",
  highlight: "#E0F2FE",
  success: "#22C55E",
  buttonText: "#FFFFFF",
  placeholder: "#9CA3AF",
};

// 🌚 Dark mode palette
export const DarkColors = {
  primary: "#38BDF8",
  primaryLight: "#0EA5E9",

  background: "#0F172A",
  surface: "#1E293B",

  textPrimary: "#F9FAFB",
  textSecondary: "#94A3B8",

  border: "#334155",
  highlight: "#1E3A8A",
  success: "#16A34A",
  buttonText: "#FFFFFF",
  placeholder: "#64748B",
};

// ✅ TypeScript type for both themes
export type Theme = typeof LightColors;

// 🧱 Static Colors (used outside ThemeProvider, e.g. onboarding)
export const Colors: Theme = LightColors;

// 🧠 Optional helper — choose palette manually if needed
export const getTheme = (mode: "light" | "dark"): Theme =>
  mode === "dark" ? DarkColors : LightColors;
