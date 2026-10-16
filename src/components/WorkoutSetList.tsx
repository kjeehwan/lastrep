import React from "react";
import { View, ViewStyle } from "react-native";
import type { WorkoutSetUi } from "./WorkoutSetList.android";
import type { NativeSyntheticEvent } from "react-native";

type Props = {
  activeSetIndex?: number;
  editingSuspended?: boolean;
  onSetActivate?: (event: NativeSyntheticEvent<{ index: number }>) => void;
  notebookColors?: Record<string, string>;
  fontFamily?: string;
  sets: WorkoutSetUi[];
  style?: ViewStyle;
  weightLabel?: string;
  repsLabel?: string;
  rpeLabel?: string;
  onSetChange?: (event: NativeSyntheticEvent<{ index: number; field: string; value: string }>) => void;
  onToggleDone?: (event: NativeSyntheticEvent<{ index: number; done?: boolean }>) => void;
  onDeleteSet?: (event: NativeSyntheticEvent<{ index: number }>) => void;
  onSetLabelPress?: (event: NativeSyntheticEvent<{ index: number }>) => void;
  onLastPress?: (event: NativeSyntheticEvent<{ index: number }>) => void;
};

export default function WorkoutSetList(_props: Props) {
  return <View />;
}
