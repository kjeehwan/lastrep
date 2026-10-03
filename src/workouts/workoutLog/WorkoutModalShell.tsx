import React, { type ReactNode } from "react";
import { Modal, TouchableWithoutFeedback, View, type ViewStyle } from "react-native";

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
  const card = <View style={cardStyle}>{children}</View>;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={backdropStyle}>
        {dismissOnBackdropPress && onRequestClose ? (
          <TouchableWithoutFeedback onPress={onRequestClose}>{card}</TouchableWithoutFeedback>
        ) : (
          card
        )}
      </View>
    </Modal>
  );
}
