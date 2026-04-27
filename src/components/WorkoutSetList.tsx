import React from "react";
import { View } from "react-native";
import type { WorkoutSetUi } from "./WorkoutSetList.android";
import type { NativeSyntheticEvent } from "react-native";

type Props = {
  sets: WorkoutSetUi[];
  onSetChange?: (event: NativeSyntheticEvent<{ index: number; field: string; value: string }>) => void;
  onToggleDone?: (event: NativeSyntheticEvent<{ index: number; done?: boolean }>) => void;
  onDeleteSet?: (event: NativeSyntheticEvent<{ index: number }>) => void;
  onSetLabelPress?: (event: NativeSyntheticEvent<{ index: number }>) => void;
};

export default function WorkoutSetList(_props: Props) {
  return <View />;
}
