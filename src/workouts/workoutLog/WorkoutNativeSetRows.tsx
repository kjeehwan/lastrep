import React from "react";
import { type ViewStyle } from "react-native";
import WorkoutSetList from "../../components/WorkoutSetList";

type NativeSetRow = {
  marker: string;
  last: string;
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
};

type WorkoutNativeSetRowsProps = {
  style: ViewStyle;
  listKey: string;
  weightLabel: string;
  repsLabel: string;
  rpeLabel: string;
  rows: NativeSetRow[];
  onChange: (index: number, field: "weight" | "reps" | "rpe", value: string) => void;
  onToggleDone: (index: number) => void;
  onDeleteSet: (index: number) => void;
  onSetLabelPress: (index: number) => void;
  onLastPress: (index: number) => void;
};

/** Adapter between screen state and the Android-native resistance set list. */
export function WorkoutNativeSetRows({
  style,
  listKey,
  weightLabel,
  repsLabel,
  rpeLabel,
  rows,
  onChange,
  onToggleDone,
  onDeleteSet,
  onSetLabelPress,
  onLastPress,
}: WorkoutNativeSetRowsProps) {
  return (
    <WorkoutSetList
      key={listKey}
      style={style}
      weightLabel={weightLabel}
      repsLabel={repsLabel}
      rpeLabel={rpeLabel}
      sets={rows}
      onSetChange={({ nativeEvent }) => {
        const index = nativeEvent.index;
        const field = nativeEvent.field;
        if (
          typeof index !== "number" ||
          index < 0 ||
          index >= rows.length ||
          (field !== "weight" && field !== "reps" && field !== "rpe")
        ) {
          return;
        }
        onChange(index, field, nativeEvent.value ?? "");
      }}
      onToggleDone={({ nativeEvent }) => {
        const index = nativeEvent.index;
        if (typeof index === "number" && index >= 0 && index < rows.length) onToggleDone(index);
      }}
      onDeleteSet={({ nativeEvent }) => {
        const index = nativeEvent.index;
        if (typeof index === "number" && index >= 0 && index < rows.length) onDeleteSet(index);
      }}
      onSetLabelPress={({ nativeEvent }) => {
        const index = nativeEvent.index;
        if (typeof index === "number" && index >= 0 && index < rows.length) onSetLabelPress(index);
      }}
      onLastPress={({ nativeEvent }) => {
        const index = nativeEvent.index;
        if (typeof index === "number" && index >= 0 && index < rows.length) onLastPress(index);
      }}
    />
  );
}
