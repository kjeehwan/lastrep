import { Redirect } from "expo-router";
import React from "react";

// Phase 2A: collapse workout entry to the single logging screen.
export default function WorkoutIndex() {
  return <Redirect href="/(tabs)/workout/log" />;
}
