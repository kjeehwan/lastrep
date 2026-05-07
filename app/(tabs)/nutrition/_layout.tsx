import { Stack } from "expo-router";
import React from "react";

export default function NutritionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="meal/[section]" />
      <Stack.Screen name="meal/search" />
    </Stack>
  );
}

