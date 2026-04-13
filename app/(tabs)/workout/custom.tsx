import { Redirect } from "expo-router";
import React from "react";

// Phase 2A: Custom workout builder is out of scope; redirect to logger.
export default function CustomWorkout() {
  return <Redirect href="/(tabs)/workout/log" />;
}
