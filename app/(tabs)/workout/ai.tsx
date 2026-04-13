import { Redirect } from "expo-router";
import React from "react";

// Phase 2A: AI workouts are out of scope; redirect to logger.
export default function AiWorkout() {
  return <Redirect href="/(tabs)/workout/log" />;
}
