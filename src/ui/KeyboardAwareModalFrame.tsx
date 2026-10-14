import React, { type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";

/** Avoid the keyboard at the modal-window level, not around a bottom-aligned card. */
export function KeyboardAwareModalFrame({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior={Platform.OS === "ios" ? "padding" : "height"}>{children}</KeyboardAvoidingView>;
}
