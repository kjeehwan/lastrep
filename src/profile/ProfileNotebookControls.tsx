import { NotebookInfoButton } from "../ui/notebook/NotebookInfoButton";
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, useWindowDimensions, type TextInputProps } from "react-native";
import { ChevronRight, X } from "lucide-react-native";
import { useNotebook } from "../ui/notebook/Notebook";
import { notebookFonts } from "../ui/notebook/tokens";
import { NotebookModal } from "../ui/notebook/NotebookModal";
import { KeyboardAwareModalFrame } from "../ui/KeyboardAwareModalFrame";
import { AdaptiveModalCard, ModalInputFocusContext } from "../ui/AdaptiveModalCard";
const ProfileSheetReadyContext = createContext(false);

export function ProfileText({ children, muted = false, heading = false }: { children: ReactNode; muted?: boolean; heading?: boolean }) {
  const { colors } = useNotebook();
  return <Text style={{ color: muted ? colors.muted : colors.ink, fontFamily: heading ? notebookFonts.editorial : notebookFonts.body, fontSize: heading ? 24 : 16 }}>{children}</Text>;
}
export function ProfileAction({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  const { colors } = useNotebook();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 48, padding: 12, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: primary ? colors.primary : "transparent", opacity: disabled ? 0.5 : 1 }}><Text style={{ color: primary ? colors.onPrimary : colors.ink, fontFamily: notebookFonts.semibold, fontSize: 16, textAlign: "center" }}>{label}</Text></Pressable>;
}
export function ProfileSection({ title, children, first = false, action }: { title: string; children: ReactNode; first?: boolean; action?: ReactNode }) {
  const { colors } = useNotebook();
  return <View style={{ gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.rule, paddingTop: first ? 0 : 24 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1 }}><ProfileText heading>{title}</ProfileText></View>{action}</View>{children}</View>;
}
export function ProfileRow({ label, value, onPress, help, wideValue = false }: { label: string; value: string; onPress: () => void; help?: () => void; wideValue?: boolean }) {
  const { colors } = useNotebook();
  const large = useWindowDimensions().fontScale >= 1.5;
  return <View style={{ flexDirection: large ? "column" : "row", alignItems: large ? "stretch" : "center", gap: 8, paddingVertical: 4 }}>
    <View style={{ flexDirection: "row", alignItems: "center", flex: large ? undefined : wideValue ? 0.8 : 1 }}><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} onPress={onPress} style={{ minHeight: 48, justifyContent: "center", flexShrink: 1 }}><ProfileText>{label}</ProfileText></Pressable>{help ? <NotebookInfoButton label={`About ${label}`} onPress={help} /> : null}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Edit`} onPress={onPress} style={{ minHeight: 48, flex: large ? undefined : wideValue ? 1.3 : 1, flexDirection: "row", alignItems: "center", justifyContent: large ? "flex-start" : "flex-end", gap: 8 }}><Text style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16, flexShrink: 1 }}>{value}</Text><ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /></Pressable>
  </View>;
}
export function ProfileField({ label, unit, inline = false, autoFocus = false, ...props }: TextInputProps & { label: string; unit?: string; inline?: boolean }) {
  const { colors } = useNotebook();
  const registerFocus = useContext(ModalInputFocusContext);
  const ready = useContext(ProfileSheetReadyContext);
  const input = useRef<TextInput>(null);
  const [selectOnFocus, setSelectOnFocus] = useState(true);
  useEffect(() => {
    if (!ready || !autoFocus) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [ready, autoFocus]);
  const { fontScale } = useWindowDimensions();
  const row = inline && fontScale < 1.5;
  return <View style={{ gap: 8, flexDirection: row ? "row" : "column", alignItems: row ? "center" : "stretch" }}><View style={row ? { flex: 1 } : undefined}><ProfileText>{label}</ProfileText></View><View style={{ flexDirection: "row", alignItems: "center", gap: 8, ...(row ? { flex: 1 } : {}) }}><TextInput {...props} ref={input} onFocus={(event) => { setSelectOnFocus(false); props.onFocus?.(event); registerFocus?.(); }} accessibilityLabel={props.accessibilityLabel ?? label} selectTextOnFocus={selectOnFocus} disableFullscreenUI placeholderTextColor={colors.muted} style={{ flex: 1, minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 6, color: colors.ink, fontFamily: notebookFonts.body, fontSize: 18, textAlign: "left" }} />{unit ? <ProfileText>{unit}</ProfileText> : null}</View></View>;
}
export function ProfileChoices<T extends string>({ label, values, selected, onChange, equalCells = false }: { label: string; values: readonly T[]; selected: T; onChange: (value: T) => void; equalCells?: boolean }) {
  const { colors } = useNotebook();
  return <View style={{ gap: 8 }}><ProfileText>{label}</ProfileText><View style={{ flexDirection: "row", flexWrap: equalCells ? "nowrap" : "wrap", gap: 8 }}>{values.map((value) => <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ selected: value === selected }} key={value} onPress={() => onChange(value)} style={{ flex: equalCells ? 1 : undefined, minHeight: 48, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 6, borderWidth: 1, borderColor: value === selected ? colors.primary : colors.border, backgroundColor: value === selected ? colors.primary : colors.surface }}><Text style={{ fontFamily: notebookFonts.body, fontSize: 16, textAlign: "center", color: value === selected ? colors.onPrimary : colors.ink }}>{value}</Text></Pressable>)}</View></View>;
}
export function ProfileSheet({ title, children, footer, onClose }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void }) {
  const { colors } = useNotebook();
  const [ready, setReady] = useState(false);
  return <NotebookModal visible transparent animationType="fade" onShow={() => setReady(true)} onRequestClose={onClose}><KeyboardAwareModalFrame onDismiss={onClose} style={{ backgroundColor: colors.overlay, padding: 20, justifyContent: "center" }}><ProfileSheetReadyContext.Provider value={ready}><AdaptiveModalCard contentSized focusPlacement="visible" animateFocus style={{ width: "100%", maxWidth: 560, borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 20, backgroundColor: colors.surface }} contentContainerStyle={{ gap: 20 }} footer={footer ? <View style={{ gap: 8 }}>{footer}</View> : undefined}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text accessibilityRole="header" style={{ flex: 1, color: colors.ink, fontFamily: notebookFonts.editorial, fontSize: 24 }}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={{ width: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}><X size={22} strokeWidth={1.5} color={colors.ink} /></Pressable></View>{children}</AdaptiveModalCard></ProfileSheetReadyContext.Provider></KeyboardAwareModalFrame></NotebookModal>;
}
