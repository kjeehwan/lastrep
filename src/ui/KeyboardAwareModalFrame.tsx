import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

/** Avoid the keyboard at the modal-window level, not around a bottom-aligned card. */
export function KeyboardAwareModalFrame({ children, style, onDismiss }: { children: ReactNode; style?: StyleProp<ViewStyle>; onDismiss?: () => void }) {
  return <KeyboardAvoidingView pointerEvents="box-none" style={[{ flex: 1 }, style]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    {onDismiss ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss popup" style={StyleSheet.absoluteFill} onPress={onDismiss} /> : null}
    {children}
  </KeyboardAvoidingView>;
}
