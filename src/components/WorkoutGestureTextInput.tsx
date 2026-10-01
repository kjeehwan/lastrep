import React, { forwardRef } from "react";
import { TextInput, TextInputProps } from "react-native";

const WorkoutGestureTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => (
  <TextInput ref={ref} {...props} />
));

WorkoutGestureTextInput.displayName = "WorkoutGestureTextInputFallback";

export default WorkoutGestureTextInput;

