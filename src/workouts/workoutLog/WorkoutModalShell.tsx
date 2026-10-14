import React, { type ReactNode } from "react";
import { Modal, TouchableWithoutFeedback, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdaptiveModalCard } from "../../ui/AdaptiveModalCard";
import { KeyboardAwareModalFrame } from "../../ui/KeyboardAwareModalFrame";

type WorkoutModalShellProps = {
  visible: boolean;
  children: ReactNode;
  backdropStyle: ViewStyle;
  cardStyle: ViewStyle;
  onRequestClose?: () => void;
  dismissOnBackdropPress?: boolean;
};

/** Shared modal frame so dismissal behavior is explicit for every Workout overlay. */
export function WorkoutModalShell({
  visible,
  children,
  backdropStyle,
  cardStyle,
  onRequestClose,
  dismissOnBackdropPress = false,
}: WorkoutModalShellProps) {
  const card = <AdaptiveModalCard style={cardStyle}>{children}</AdaptiveModalCard>;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <KeyboardAwareModalFrame>
      <SafeAreaView style={backdropStyle}>
        {dismissOnBackdropPress && onRequestClose ? (
          <TouchableWithoutFeedback onPress={onRequestClose}>{card}</TouchableWithoutFeedback>
        ) : (
          card
        )}
      </SafeAreaView>
      </KeyboardAwareModalFrame>
    </Modal>
  );
}
