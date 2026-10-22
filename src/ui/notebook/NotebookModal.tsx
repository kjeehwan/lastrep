import React, { useContext, useEffect, useState } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, View, type ModalProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { popupBottomSpace } from "./popupGeometry";
import { useNotebook } from "./Notebook";
import { notebookDark } from "./tokens";
import { NotebookSystemBars } from "./NotebookSystemBars";

/** Keep every notebook sheet inside system bars, including Android three-button navigation. */
type NotebookModalProps = Omit<ModalProps, "onRequestClose"> & {
  onRequestClose: NonNullable<ModalProps["onRequestClose"]>;
  dismissOnBackdropPress?: boolean;
};

export function NotebookModal({ children, dismissOnBackdropPress = true, ...props }: NotebookModalProps) {
  const { colors } = useNotebook();
  const insets = useSafeAreaInsets();
  const tabs = useContext(BottomTabBarHeightContext);
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Full-screen layout Views must let empty-space taps reach the sibling backdrop.
  // The content card remains a normal hit-test surface; its controls keep their taps.
  const content = React.Children.map(children, (child) => React.isValidElement<{ pointerEvents?: "box-none" }>(child) && child.type === View
    ? React.cloneElement(child, { pointerEvents: "box-none" }) : child);
  return <Modal {...props}><View style={{ flex: 1 }}>
    <NotebookSystemBars darkIcons={colors !== notebookDark} />
    {dismissOnBackdropPress ? <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss popup outside content" onPress={props.onRequestClose} /> : null}
    <View pointerEvents="box-none" style={{ flex: 1, paddingTop: insets.top, paddingBottom: popupBottomSpace(insets.bottom, tabs, keyboardVisible), paddingLeft: insets.left, paddingRight: insets.right }}>{content}</View>
  </View></Modal>;
}
