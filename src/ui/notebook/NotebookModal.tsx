import React from "react";
import { Modal, View, type ModalProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Keep every notebook sheet inside system bars, including Android three-button navigation. */
type NotebookModalProps = Omit<ModalProps, "onRequestClose"> & {
  onRequestClose: NonNullable<ModalProps["onRequestClose"]>;
};

export function NotebookModal({ children, ...props }: NotebookModalProps) {
  const insets = useSafeAreaInsets();
  return <Modal {...props}><View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>{children}</View></Modal>;
}
