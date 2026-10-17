import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import { NotebookModal as Modal } from "../../ui/notebook/NotebookModal";
import { SafeAreaView } from "react-native-safe-area-context";
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
      <SafeAreaView style={backdropStyle}>
        {dismissOnBackdropPress ? <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss popup" onPress={onRequestClose} /> : null}
        {card}
      </SafeAreaView>
      </KeyboardAwareModalFrame>
    </Modal>
  );
}
