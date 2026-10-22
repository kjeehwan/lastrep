import React from "react";
import { Pressable, Text, View, StyleSheet, useWindowDimensions } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useNotebook } from "./Notebook";
import { notebookFonts } from "./tokens";

export function NotebookHeader({ title, onBack, action, onAction, disabled = false, compact = false }: {
  title: string; onBack: () => void; action?: string; onAction?: () => void; disabled?: boolean; compact?: boolean;
}) {
  const { colors } = useNotebook();
  const large = useWindowDimensions().fontScale >= 1.5;
  return <View style={[styles.shell, compact && { paddingVertical: 0 }, { borderBottomColor: colors.rule }]}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={[styles.side, { width: action && !large ? 80 : 44 }]}>
        <ChevronLeft size={22} strokeWidth={1.5} color={colors.ink} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {action && !large ? <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onAction} style={[styles.action, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}><Text style={[styles.actionText, { color: colors.onPrimary }]}>{action}</Text></Pressable> : <View style={{ width: 44 }} />}
    </View>
    {action && large ? <Pressable accessibilityRole="button" disabled={disabled} onPress={onAction} style={[styles.action, { alignSelf: "flex-end", backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}><Text style={[styles.actionText, { color: colors.onPrimary }]}>{action}</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  shell: { width: "100%", maxWidth: 800, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  side: { minHeight: 44, justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontFamily: notebookFonts.semibold, fontSize: 20 },
  action: { minWidth: 80, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  actionText: { fontFamily: notebookFonts.semibold, fontSize: 16 },
});
