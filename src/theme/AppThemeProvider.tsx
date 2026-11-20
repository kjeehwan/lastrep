import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, View, useColorScheme } from "react-native";
import { notebookDark, notebookPaper } from "../ui/notebook/tokens";
import { accountThemeKey, createThemePreferenceStore, resolveTheme, type ThemePreference, type ThemePreferenceState } from "./themePreference";
import { auth } from "../config/firebaseConfig";

type AppTheme = ThemePreferenceState & { colorScheme: "light" | "dark"; setPreference: (value: ThemePreference) => Promise<void> };
const AppThemeContext = createContext<AppTheme | null>(null);
const subscribeHydration = () => () => {};

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  // Match the static web shell before reading the browser's system appearance.
  const hasHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const [store] = useState(() => createThemePreferenceStore(AsyncStorage));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const colorScheme = resolveTheme(state.preference, hasHydrated ? system : null);
  useEffect(() => onAuthStateChanged(auth, user => { void store.load(accountThemeKey(user?.uid ?? null)); }), [store]);
  const value = useMemo(() => ({ ...state, colorScheme, setPreference: store.setPreference }), [state, colorScheme, store]);
  const colors = colorScheme === "dark" ? notebookDark : notebookPaper;
  return (
    <AppThemeContext.Provider value={value}>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {/* Expo Router must mount its navigator on the first render. Mask the
            content during appearance loading instead of removing the tree. */}
        <View
          style={{ flex: 1, opacity: state.ready ? 1 : 0 }}
          pointerEvents={state.ready ? "auto" : "none"}
          accessibilityElementsHidden={!state.ready}
          importantForAccessibility={state.ready ? "auto" : "no-hide-descendants"}
        >
          {children}
        </View>
        {!state.ready && (
          <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "center" }}>
            <ActivityIndicator color={colors.ink} accessibilityLabel="Loading appearance" />
          </View>
        )}
      </View>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppTheme {
  const theme = useContext(AppThemeContext);
  if (!theme) throw new Error("AppThemeProvider is required.");
  return theme;
}
