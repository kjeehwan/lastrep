import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "react-native";
import { useNotebook } from "./Notebook";
import { notebookDark } from "./tokens";

export function useNotebookStatusBar() {
  const { colors } = useNotebook();
  useFocusEffect(useCallback(() => {
    const entry = StatusBar.pushStackEntry({ barStyle: colors === notebookDark ? "light-content" : "dark-content" });
    return () => StatusBar.popStackEntry(entry);
  }, [colors]));
}
