import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import { DarkColors, LightColors } from "../styles/colors";

type ThemeMode = "light" | "dark" | "system";

const ThemeContext = createContext({
  theme: LightColors,
  themeMode: "system" as ThemeMode,
  setThemeMode: (_: ThemeMode) => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState(LightColors);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("themeMode");
      if (stored === "light" || stored === "dark" || stored === "system")
        setThemeMode(stored);
    })();
  }, []);

  useEffect(() => {
    const sys = Appearance.getColorScheme() === "dark" ? "dark" : "light";
    const mode = themeMode === "system" ? sys : themeMode;
    setTheme(mode === "dark" ? DarkColors : LightColors);
  }, [themeMode]);

  useEffect(() => {
    AsyncStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
