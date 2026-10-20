import React, { useState } from "react";
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
  activeSetIndex: number;
  editingSuspended: boolean;
  onActivate: (index: number) => void;
  notebookColors?: Record<string, string>;
  fontFamily?: string;
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
  activeSetIndex,
  editingSuspended,
  onActivate,
  notebookColors,
  fontFamily,
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
  const [measurement, setMeasurement] = useState<{ signature: string; height: number } | null>(null);
  const signature = `${listKey}:${rows.length}:${style.height}`;
  return (
    <WorkoutSetList
      activeSetIndex={activeSetIndex}
      editingSuspended={editingSuspended}
      onSetActivate={({ nativeEvent }) => {
        if (Number.isInteger(nativeEvent.index) && nativeEvent.index >= 0 && nativeEvent.index < rows.length) onActivate(nativeEvent.index);
      }}
      notebookColors={notebookColors}
      fontFamily={fontFamily}
      key={listKey}
      style={{ ...style, height: measurement?.signature === signature ? measurement.height : style.height }}
      onContentSizeChange={({ nativeEvent }) => {
        if (Number.isFinite(nativeEvent.height) && nativeEvent.height > 0) {
          setMeasurement((previous) => previous?.signature === signature && previous.height === nativeEvent.height
            ? previous : { signature, height: nativeEvent.height });
        }
      }}
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
