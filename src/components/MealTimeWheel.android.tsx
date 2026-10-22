import React from "react";
import { requireNativeComponent, UIManager } from "react-native";
import type { MealTimeWheelProps } from "./MealTimeWheel.types";

export const nativeMealTimeWheelAvailable = UIManager.getViewManagerConfig("MealTimeWheel") != null;
const NativeMealTimeWheel = requireNativeComponent<MealTimeWheelProps>("MealTimeWheel");

export default function MealTimeWheel(props: MealTimeWheelProps) {
  return <NativeMealTimeWheel {...props} />;
}
