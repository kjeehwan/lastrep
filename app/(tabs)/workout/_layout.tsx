import { Stack, useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { StatusBar } from "react-native";
import { NotebookProvider, useNotebook } from "../../../src/ui/notebook/Notebook";
import { notebookDark } from "../../../src/ui/notebook/tokens";

function NotebookRoutes() {
  const { colors } = useNotebook();
  useFocusEffect(useCallback(() => {
    const entry = StatusBar.pushStackEntry({ barStyle: colors === notebookDark ? "light-content" : "dark-content" });
    return () => StatusBar.popStackEntry(entry);
  }, [colors]));
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function WorkoutLayout() {
  return <NotebookProvider><NotebookRoutes /></NotebookProvider>;
}
