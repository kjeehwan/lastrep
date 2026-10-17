import { Stack } from "expo-router";
import React from "react";
import { NotebookProvider } from "../../../src/ui/notebook/Notebook";
import { useNotebookStatusBar } from "../../../src/ui/notebook/useNotebookStatusBar";

function NutritionRoutes() {
  useNotebookStatusBar();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="meal/[section]" />
      <Stack.Screen name="meal/search" />
    </Stack>
  );
}

export default function NutritionLayout() { return <NotebookProvider><NutritionRoutes /></NotebookProvider>; }

