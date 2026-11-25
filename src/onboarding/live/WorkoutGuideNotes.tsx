import React from "react";
import { AppGuideTip } from "./AppGuide";
import { planTip, programTip, routineTip, workoutTip, type WorkoutGuideFacts } from "./workoutTips";
export function WorkoutGuideNotes({ facts }: { facts: WorkoutGuideFacts }) {
  const workout = workoutTip(facts), routine = routineTip(facts), plan = planTip(facts), program = programTip(facts);
  return <>
    <AppGuideTip topic="workout" {...workout}>{workout.text}</AppGuideTip>
    <AppGuideTip topic="routines" {...routine}>{routine.text}</AppGuideTip>
    <AppGuideTip topic="programs" {...program}>{program.text}</AppGuideTip>
    <AppGuideTip topic="sharing" id="sharing-entry" title="Share workouts and programs">Open a workout and tap Share. To share a program, open it in My programs and tap Share.</AppGuideTip>
    <AppGuideTip topic="plan" {...plan}>{plan.text}</AppGuideTip>
  </>;
}
