import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotebook } from "./Notebook";

export function NotebookInfoButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useNotebook();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="information-circle-outline" size={16} color={colors.muted} /></Pressable>;
}
