import { NotebookTextInput } from "../ui/notebook/NotebookTextInput";
import React, { forwardRef } from "react";
import { TextInput, TextInputProps } from "react-native";

const WorkoutGestureTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => (
  <NotebookTextInput ref={ref} {...props} disableFullscreenUI />
));

WorkoutGestureTextInput.displayName = "WorkoutGestureTextInputFallback";

export default WorkoutGestureTextInput;

