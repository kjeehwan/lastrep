import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AdaptiveModalCard } from "../AdaptiveModalCard";
import { PopupBackdrop } from "../PopupBackdrop";
import type { AppDialogOptions } from "../appDialog";
import { useNotebook } from "./Notebook";
import { NotebookModal } from "./NotebookModal";
import { notebookFonts } from "./tokens";

export function NotebookAppDialog({ dialog, onClose }: { dialog: AppDialogOptions; onClose: () => void }) {
  const { colors } = useNotebook();
  const buttons = dialog.buttons?.length ? dialog.buttons : [{ text: "OK", role: "default" as const }];
  const vertical = dialog.buttonLayout === "vertical";
  const dismiss = () => { onClose(); dialog.onDismiss?.(); };
  const footer = <View style={{ flexDirection: vertical ? "column" : "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 12 }}>
    {buttons.map((button, index) => {
      const cancel = button.role === "cancel";
      const destructive = button.role === "destructive";
      const filled = button.variant ? button.variant === "primary" : !cancel && (!vertical || destructive);
      const outlined = button.variant === "secondary";
      return <TouchableOpacity key={index} accessibilityRole="button" onPress={() => { onClose(); button.onPress?.(); }} style={{ minHeight: 48, minWidth: 80, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 6, justifyContent: "center", alignItems: "center", ...(vertical ? { width: "100%", ...(!filled && !outlined ? { borderBottomWidth: 1, borderBottomColor: colors.rule } : {}) } : { flexShrink: 1 }), ...(outlined ? { borderWidth: 1, borderColor: destructive ? colors.danger : colors.border } : {}), backgroundColor: filled ? destructive ? colors.danger : colors.primary : colors.surface }}>
        <Text style={{ fontFamily: notebookFonts.semibold, fontSize: 16, color: filled ? colors.onPrimary : destructive ? colors.danger : colors.ink, textAlign: "center" }}>{button.text}</Text>
      </TouchableOpacity>;
    })}
  </View>;
  return <NotebookModal transparent visible animationType="fade" onRequestClose={dismiss}>
    <PopupBackdrop onClose={dismiss} style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: colors.overlay }}>
      <AdaptiveModalCard contentSized style={{ width: "100%", maxWidth: 560, padding: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }} contentContainerStyle={{ gap: 20 }} footer={footer}>
        <Text accessibilityRole="header" style={{ color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 22 }}>{dialog.title}</Text>
        {dialog.message ? <Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16, lineHeight: 24 }}>{dialog.message}</Text> : null}
      </AdaptiveModalCard>
    </PopupBackdrop>
  </NotebookModal>;
}
