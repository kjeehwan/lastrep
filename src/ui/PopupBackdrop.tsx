import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

/** The dismiss target is a sibling, never an ancestor of the card's content. */
export function PopupBackdrop({ children, onClose, style }: { children: ReactNode; onClose: () => void; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss popup" style={StyleSheet.absoluteFill} onPress={onClose} />
    {children}
  </View>;
}
