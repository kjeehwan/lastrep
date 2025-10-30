import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import { getTheme, Theme } from "../styles/colors";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: "system",
  setThemeMode: () => {},
  theme: getTheme("light"),
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<Theme>(getTheme("light"));

  useEffect(() => {
    const loadTheme = async () => {
      const saved = await AsyncStorage.getItem("themeMode");
      const mode = (saved as ThemeMode) || "system";
      applyTheme(mode);
    };
    loadTheme();
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    const colorScheme =
      mode === "system" ? Appearance.getColorScheme() || "light" : mode;
    setTheme(getTheme(colorScheme as "light" | "dark"));
    AsyncStorage.setItem("themeMode", mode);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode: applyTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
