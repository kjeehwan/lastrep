import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from "react-native";
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
  androidBehavior?: "height" | "padding" | "position";
  compactLandscape?: boolean;
};

/** Shared modal frame so dismissal behavior is explicit for every Workout overlay. */
export function WorkoutModalShell({
  visible,
  children,
  backdropStyle,
  cardStyle,
  onRequestClose,
  dismissOnBackdropPress = true,
  androidBehavior = "height",
  compactLandscape = false,
}: WorkoutModalShellProps) {
  const {width,height}=useWindowDimensions();
  const compact=compactLandscape&&width>height;
  const card = <AdaptiveModalCard viewportMargin={compact?8:32} style={[cardStyle,compact&&{paddingTop:8,paddingBottom:8}]}>{children}</AdaptiveModalCard>;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} dismissOnBackdropPress={dismissOnBackdropPress}>
      <KeyboardAwareModalFrame androidBehavior={androidBehavior}>
      {/* NotebookModal already reserves system insets and the tab bar. */}
      <View style={backdropStyle}>
        {dismissOnBackdropPress ? <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss popup" onPress={onRequestClose} /> : null}
        {card}
      </View>
      </KeyboardAwareModalFrame>
    </Modal>
  );
}
