import React from "react";
import {
  NativeSyntheticEvent,
  requireNativeComponent,
  ViewStyle,
} from "react-native";

export type WorkoutSetUi = {
  marker: string;
  last: string;
  weight: string;
  reps: string;
  rpe: string;
  rpeHint?: string;
  done: boolean;
};

type SetChangeEvent = NativeSyntheticEvent<{
  index: number;
  field: "weight" | "reps" | "rpe";
  value: string;
}>;

type ToggleDoneEvent = NativeSyntheticEvent<{ index: number; done?: boolean }>;
type DeleteSetEvent = NativeSyntheticEvent<{ index: number }>;
type SetLabelPressEvent = NativeSyntheticEvent<{ index: number }>;
type LastPressEvent = NativeSyntheticEvent<{ index: number }>;

type NativeProps = {
  onContentSizeChange?: (event: NativeSyntheticEvent<{ height: number }>) => void;
  previewMode?: boolean;
  planMode?: boolean;
  activeSetIndex?: number;
  editingSuspended?: boolean;
  onSetActivate?: (event: NativeSyntheticEvent<{ index: number }>) => void;
  notebookColors?: Record<string, string>;
  fontFamily?: string;
  sets: WorkoutSetUi[];
  weightLabel?: string;
  repsLabel?: string;
  rpeLabel?: string;
  style?: ViewStyle;
  onSetChange?: (event: SetChangeEvent) => void;
  onToggleDone?: (event: ToggleDoneEvent) => void;
  onDeleteSet?: (event: DeleteSetEvent) => void;
  onSetLabelPress?: (event: SetLabelPressEvent) => void;
  onLastPress?: (event: LastPressEvent) => void;
};

const NativeWorkoutSetList = requireNativeComponent<NativeProps>("WorkoutSetList");

export default function WorkoutSetList(props: NativeProps) {
  return <NativeWorkoutSetList {...props} />;
}
