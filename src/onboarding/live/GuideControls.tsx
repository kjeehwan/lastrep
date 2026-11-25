import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useNotebook, useNotebookStyles } from "../../ui/notebook/Notebook";
import { notebookFonts, type NotebookColors } from "../../ui/notebook/tokens";

export const guideWelcomeStyles = (c: NotebookColors) => StyleSheet.create({
  body: { color: c.ink, fontFamily: notebookFonts.body, fontSize: 16, lineHeight: 23 },
  muted: { color: c.muted, fontFamily: notebookFonts.body, fontSize: 14, lineHeight: 20 },
  title: { color: c.ink, fontFamily: notebookFonts.editorial, fontSize: 26, lineHeight: 34 },
  heading: { color: c.ink, fontFamily: notebookFonts.semibold, fontSize: 18, lineHeight: 25 },
  rule: { height: 1, backgroundColor: c.rule },
  section: { gap: 12, paddingVertical: 12 },
  input: { fontFamily: notebookFonts.body, fontSize: 16, color: c.ink, borderColor: c.border, borderWidth: 1, borderRadius: 6, padding: 12, minHeight: 48 },
  row: { minHeight: 64, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  rowTitle: { color: c.ink, fontFamily: notebookFonts.semibold, fontSize: 16, lineHeight: 22 },
  button: { minWidth: 48, minHeight: 48, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  buttonText: { color: c.ink, fontFamily: notebookFonts.semibold, fontSize: 16, lineHeight: 22, textAlign: "center", textAlignVertical: "center" },
});
export function GuideCopy({ children, muted = false, heading = false }: { children: ReactNode; muted?: boolean; heading?: boolean }) {
  const s = useNotebookStyles(guideWelcomeStyles);
  return <Text style={heading ? s.heading : muted ? s.muted : s.body}>{children}</Text>;
}
export function GuideButton({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  const { colors } = useNotebook(), s = useNotebookStyles(guideWelcomeStyles);
  const content = <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, primary && { backgroundColor: colors.primary, borderColor: colors.primary }, disabled && { opacity: 0.5 }]}><Text style={[s.buttonText, primary && { color: colors.onPrimary }]}>{label}</Text></Pressable>;
  return content;
}
