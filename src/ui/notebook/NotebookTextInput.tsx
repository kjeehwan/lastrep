import React, { forwardRef, useContext } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { ModalInputFocusContext } from "../AdaptiveModalCard";
import { useNotebook } from "./Notebook";

/** One input surface in both themes, including inputs inside nested modal controls. */
export const NotebookTextInput = forwardRef<TextInput, TextInputProps & { surface?: "input" | "canvas" }>((props, ref) => {
  const { colors } = useNotebook();
  const { surface = "input", ...inputProps } = props;
  const reveal = useContext(ModalInputFocusContext);
  return <TextInput {...inputProps} ref={ref} placeholderTextColor={colors.muted}
    style={[props.style, { backgroundColor: colors[surface], color: colors.ink }]}
    onFocus={event => { props.onFocus?.(event); reveal?.(); }} />;
});
NotebookTextInput.displayName = "NotebookTextInput";
