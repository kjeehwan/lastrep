import React, { forwardRef, useImperativeHandle, useState, type ReactNode } from "react";
import { Modal } from "react-native";

export type CalendarOverlayHandle = { open: () => void; close: () => void };

/** Opening the calendar must not rerender the dashboard and all its charts. */
export const CalendarOverlay = forwardRef<CalendarOverlayHandle, { children: ReactNode }>(function CalendarOverlay({ children }, ref) {
  const [visible, setVisible] = useState(false);
  useImperativeHandle(ref, () => ({ open: () => setVisible(true), close: () => setVisible(false) }), []);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>{visible ? children : null}</Modal>;
});
