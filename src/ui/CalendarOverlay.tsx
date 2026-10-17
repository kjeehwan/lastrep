import React, { forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { Modal } from "react-native";
import { NotebookModal } from "./notebook/NotebookModal";
import { useNotebook } from "./notebook/Notebook";

export type CalendarOverlayHandle = { open: () => void; close: () => void };

/** Opening the calendar must not rerender the dashboard and all its charts. */
export const CalendarOverlay = forwardRef<CalendarOverlayHandle, { children: ReactNode }>(function CalendarOverlay({ children }, ref) {
  const [visible, setVisible] = useState(false);
  const { fontsLoaded } = useNotebook();
  useImperativeHandle(ref, () => ({ open: () => setVisible(true), close: () => setVisible(false) }), []);
  const Surface = fontsLoaded ? NotebookModal : Modal;
  return <Surface visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>{visible ? children : null}</Surface>;
});
