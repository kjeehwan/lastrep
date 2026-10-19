import React, { type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useNotebook } from "../ui/notebook/Notebook";
import { notebookFonts } from "../ui/notebook/tokens";

export function SettingsSection({ title, first = false, children }: { title: string; first?: boolean; children: ReactNode }) {
  const { colors } = useNotebook();
  return <View style={{ gap: 16, borderTopWidth: first ? 0 : 1, borderTopColor: colors.rule, paddingTop: first ? 0 : 24 }}>
    <Text accessibilityRole="header" style={{ fontFamily: notebookFonts.editorial, fontSize: 24, color: colors.ink }}>{title}</Text>{children}
  </View>;
}

export function SettingsText({ children, live = false }: { children: ReactNode; live?: boolean }) {
  const { colors } = useNotebook();
  return <Text accessibilityLiveRegion={live ? "polite" : undefined} style={{ color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16, lineHeight: 22 }}>{children}</Text>;
}

export function SettingsRow({ icon, label, children, value, onPress, disabled = false, strong = false }: { icon: ReactNode; label: string; children?: ReactNode; value?: string; onPress?: () => void; disabled?: boolean; strong?: boolean }) {
  const { colors } = useNotebook();
  const large = useWindowDimensions().fontScale >= 1.5;
  const content = <>
    <View style={{ width: 24, minHeight: 24, alignItems: "center", justifyContent: "center" }}>{icon}</View>
    <View style={{ flex: 1, gap: 8 }}><Text style={{ color: colors.ink, fontFamily: strong ? notebookFonts.semibold : notebookFonts.body, fontSize: 18 }}>{label}</Text>{children}{large && value ? <SettingsText>{value}</SettingsText> : null}</View>
    {!large && value ? <Text style={{ flexShrink: 1, textAlign: "right", color: colors.muted, fontFamily: notebookFonts.body, fontSize: 16 }}>{value}</Text> : null}
    {onPress ? <ChevronRight size={18} strokeWidth={1.5} color={colors.muted} /> : null}
  </>;
  const style = { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 12, minHeight: 48, paddingVertical: 12, opacity: disabled ? 0.5 : 1 };
  return onPress ? <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={style}>{content}</Pressable> : <View style={style}>{content}</View>;
}

export function SettingsAction({ label, onPress, disabled = false, primary = false, destructive = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; destructive?: boolean }) {
  const { colors } = useNotebook();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 48, padding: 12, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: destructive ? colors.danger : primary ? colors.primary : colors.border, backgroundColor: primary ? colors.primary : colors.surface, opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ color: destructive ? colors.danger : primary ? colors.onPrimary : colors.ink, textAlign: "center", fontFamily: notebookFonts.semibold, fontSize: 16 }}>{label}</Text>
  </Pressable>;
}

/** Matches the approved version-row drawing, including its filled dot. */
export function SettingsVersionIcon() {
  const { colors } = useNotebook();
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={7.5} r={1.1} fill={colors.ink} stroke="none" /><Path d="M12 11.5v5" /></Svg>;
}
