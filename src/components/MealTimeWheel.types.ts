import type { NativeSyntheticEvent, StyleProp, ViewStyle } from "react-native";

export type MealTimeWheelProps = {
  count: number;
  initialValue: number;
  inkColor: string;
  numberSize: number;
  enabled: boolean;
  accessibilityLabel: string;
  partLabel: string;
  style: StyleProp<ViewStyle>;
  onWheelChange: (event: NativeSyntheticEvent<{ value: number; scrolling: boolean }>) => void;
};
