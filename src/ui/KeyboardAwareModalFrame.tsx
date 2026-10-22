import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

/** Avoid the keyboard at the modal-window level, not around a bottom-aligned card. */
export function KeyboardAwareModalFrame({ children, style, onDismiss, androidBehavior = "height" }: { children: ReactNode; style?: StyleProp<ViewStyle>; onDismiss?: () => void; androidBehavior?: "height" | "padding" | "position" }) {
  // Padding avoids the height behavior's cached portrait frame after rotation
  // while keeping the original native inputs mounted and focused.
  return <KeyboardAvoidingView pointerEvents="box-none" style={[{ flex: 1 }, style]} behavior={Platform.OS === "ios" ? "padding" : androidBehavior}>
    {onDismiss ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss popup" style={StyleSheet.absoluteFill} onPress={onDismiss} /> : null}
    {children}
  </KeyboardAvoidingView>;
}
