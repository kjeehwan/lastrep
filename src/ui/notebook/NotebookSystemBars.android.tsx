import React from "react";
import { requireNativeComponent, UIManager, type ViewProps } from "react-native";

// Older dev clients can still open sheets before the native update is installed.
const NativeSystemBars = UIManager.getViewManagerConfig("NotebookSystemBars")
  ? requireNativeComponent<ViewProps & { darkIcons: boolean }>("NotebookSystemBars")
  : null;

export function NotebookSystemBars({ darkIcons }: { darkIcons: boolean }) {
  return NativeSystemBars ? <NativeSystemBars darkIcons={darkIcons} pointerEvents="none"
    accessible={false} importantForAccessibility="no-hide-descendants"
    style={{ position: "absolute", width: 0, height: 0 }} /> : null;
}
