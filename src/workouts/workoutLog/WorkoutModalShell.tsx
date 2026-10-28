import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { NotebookModal as Modal } from "../../ui/notebook/NotebookModal";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../ui/KeyboardAwareModalFrame";

type WorkoutModalShellProps = {
  visible: boolean;
  children: ReactNode;
  backdropStyle: ViewStyle;
  cardStyle: ViewStyle;
  onRequestClose: () => void;
  dismissOnBackdropPress?: boolean;
};

/** Shared modal frame so dismissal behavior is explicit for every Workout overlay. */
export function WorkoutModalShell({
  visible,
  children,
  backdropStyle,
  cardStyle,
  onRequestClose,
  dismissOnBackdropPress = true,
}: WorkoutModalShellProps) {
  const card = <AdaptiveModalCard style={cardStyle}>{children}</AdaptiveModalCard>;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} dismissOnBackdropPress={dismissOnBackdropPress}>
      <KeyboardAwareModalFrame>
      {/* NotebookModal already reserves system insets and the tab bar. */}
      <View style={backdropStyle}>
        {dismissOnBackdropPress ? <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss popup" onPress={onRequestClose} /> : null}
        {card}
      </View>
      </KeyboardAwareModalFrame>
    </Modal>
  );
}
