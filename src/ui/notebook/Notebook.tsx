import React, { createContext, useContext, useMemo } from "react";
import { useFonts } from "expo-font";
import { useIsFocused, usePathname } from "expo-router";
import { useStartupReady } from "../../branding/useStartupReady";
import { StyleSheet, View, ActivityIndicator, type TextStyle, type ViewStyle, type ImageStyle } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";
import { notebookDark, notebookPaper, notebookFonts, type NotebookColors } from "./tokens";

const NotebookContext = createContext({ colors: notebookPaper, fontsLoaded: false });
export function NotebookProvider({ children }: { children: React.ReactNode }) {
  const dark = useAppTheme().colorScheme === "dark";
  const [loaded, error] = useFonts({
    NotebookSans: require("../../../assets/fonts/source-sans-3.ttf"),
    NotebookSansSemibold: require("../../../assets/fonts/source-sans-3-semibold.ttf"),
    NotebookSerif: require("../../../assets/fonts/source-serif-4.ttf"),
  });
  const value = useMemo(() => ({ colors: dark ? notebookDark : notebookPaper, fontsLoaded: loaded }), [dark, loaded]);
  const pathname = usePathname();
  const focused = useIsFocused();
  // Home waits for its initial data too. Auth/onboarding and direct links can
  // reveal their own usable screen once the notebook fonts are ready.
  useStartupReady(Boolean(loaded || error), undefined, focused && pathname !== "/" && pathname !== "/home");
  // A failed font load must not prevent users from reaching their workout.
  if (error && __DEV__) console.warn("Notebook fonts unavailable", error.message);
  return <NotebookContext.Provider value={value}>{!loaded && !error ? <View style={{ flex: 1, backgroundColor: value.colors.canvas, justifyContent: "center" }}><ActivityIndicator color={value.colors.accent} accessibilityLabel="Loading screen" /></View> : children}</NotebookContext.Provider>;
}
export const useNotebook = () => useContext(NotebookContext);
export function useNotebookStyles<T>(factory: (colors: NotebookColors) => T): T {
  const { colors } = useNotebook();
  return useMemo(() => factory(colors), [factory, colors]);
}
export function notebookSheet<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(styles: T): T {
  const result = Object.fromEntries(Object.entries(styles).map(([key, value]) => {
    const text = value as TextStyle;
    const fontSize = Math.max(text.fontSize ?? 16, /Header|Label|caption/i.test(key) ? 13 : 14);
    return [key, ("color" in value || "fontSize" in value || "fontWeight" in value) ? {
      ...value,
      fontFamily: text.fontFamily ?? (Number(text.fontWeight ?? 400) >= 600 ? notebookFonts.semibold : notebookFonts.body),
      fontWeight: "400",
      fontSize,
      lineHeight: Math.max(text.lineHeight ?? 0, Math.ceil(fontSize * 1.3)),
    } : value];
  }));
  return StyleSheet.create(result as T);
}
