import React, { type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import { useNotebook } from "../../ui/notebook/Notebook";
import { notebookFonts } from "../../ui/notebook/tokens";
import { NotebookModal } from "../../ui/notebook/NotebookModal";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../ui/KeyboardAwareModalFrame";

export function SleepButton({ label, onPress, primary = false, danger = false, disabled = false, align = "center" }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; align?: "left" | "center" }) {
  const { colors } = useNotebook();
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={{ minHeight: 48, paddingHorizontal: align === "left" && !primary && !danger ? 0 : 16, paddingVertical: 12, justifyContent: "center", alignItems: align === "left" ? "flex-start" : "center", borderRadius: 8, opacity: disabled ? 0.5 : 1, backgroundColor: primary ? colors.primary : danger ? colors.danger : "transparent" }}>
    <Text style={{ fontFamily: notebookFonts.semibold, fontSize: 16, color: primary || danger ? colors.onPrimary : colors.ink, textAlign: align }}>{label}</Text>
  </Pressable>;
}
export function SleepSheet({ title, children, footer, onClose }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  const { colors } = useNotebook();
  const { fontScale } = useWindowDimensions();
  return <NotebookModal visible transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAwareModalFrame onDismiss={onClose} style={{ justifyContent: "center", padding: 20, backgroundColor: colors.overlay }}>
      <AdaptiveModalCard contentSized focusPlacement="start" style={{ width: "100%", maxWidth: 560, padding: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8 }} contentContainerStyle={{ gap: 20 }} footer={footer ? <View style={{ gap: fontScale >= 1.5 ? 12 : 8 }}>{footer}</View> : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text accessibilityRole="header" style={{ flex: 1, color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22 }}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={{ width: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}><X size={22} strokeWidth={1.5} color={colors.ink} /></Pressable>
        </View>
        {children}
      </AdaptiveModalCard>
    </KeyboardAwareModalFrame>
  </NotebookModal>;
}
