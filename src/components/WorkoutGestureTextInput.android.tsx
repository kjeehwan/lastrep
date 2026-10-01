import React, { forwardRef } from "react";
import {
  NativeSyntheticEvent,
  TextInputChangeEventData,
  TextInputProps,
  requireNativeComponent,
} from "react-native";

type NativeProps = TextInputProps;

const NativeWorkoutGestureTextInput =
  requireNativeComponent<NativeProps>("WorkoutGestureTextInput");

const WorkoutGestureTextInput = forwardRef<any, TextInputProps>(
  ({ onChangeText, onChange, ...rest }, ref) => (
    <NativeWorkoutGestureTextInput
      ref={ref}
      {...rest}
      onChange={(event: NativeSyntheticEvent<TextInputChangeEventData>) => {
        onChange?.(event);
        onChangeText?.(event.nativeEvent?.text ?? "");
      }}
    />
  )
);

WorkoutGestureTextInput.displayName = "WorkoutGestureTextInput";

export default WorkoutGestureTextInput;
