export const savedWorkoutTip = { id: "workout-complete", title: "Your workout is saved", text: "On Home, tap the calendar icon and select the workout date to open your saved workout. Choose another topic, or finish the guide here." };
export type WorkoutGuideFacts = { programCompleted?: boolean; programRest?: boolean; hasCompletedSet: boolean; hasDraft: boolean; hasProgram: boolean; choices: boolean; hasExercises: boolean; builder: boolean; routineLoaded: boolean; workoutSaved: boolean; routineSaved: boolean; planApplied: boolean; planReady: boolean };
export function workoutTip(f: WorkoutGuideFacts) {
  if (f.builder && !f.choices) return { id: "workout-routine-draft", title: "You have a routine draft open", text: "A routine saves exercises and planned sets for future workouts. Continue building it, or go back to Workout choices." };
  if (!f.choices && f.hasCompletedSet) return { id: "workout-finish", title: "Review and save your workout", text: "Keep recording as you train. When you are done, tap Finish to review and save your completed sets." };
  if (!f.choices) return f.hasExercises
    ? { id: "workout-record", title: "Record each set", text: "Enter the load and reps, then check Done after completing the set. Tap Finish when your workout is complete." }
    : { id: "workout-add", title: "Add your exercises", text: "Tap Add exercise to choose what you plan to do, or My routines to load exercises you saved earlier." };
  if (f.programCompleted) return { id: "program-day-complete", title: "Today's workout is complete", text: "You have finished your scheduled workout. View it in Home's calendar, or use the guide bar to explore something else." };
  if (f.hasProgram && f.programRest) return { id: "program-rest-day", title: "Today is a rest day", text: "No program workout is scheduled today. Use the guide bar to explore another feature, or Start workout for a separate session." };
  return f.workoutSaved
    ? savedWorkoutTip
    : f.hasDraft
      ? { id: "workout-resume", title: "Continue where you left off", text: "Tap Resume workout to reopen a saved draft." }
      : f.hasProgram
        ? { id: "workout-program", title: "Continue your program", text: "Tap Continue program to see your scheduled day. Start workout opens a separate session." }
        : { id: "workout-choice", title: "Log your workout", text: "Tap Start workout, then add the exercises you plan to do. Record each set as you finish it." };
}
export function routineTip(f: WorkoutGuideFacts) {
  if (f.builder && !f.choices) return { id: "routine-builder", title: "Build a reusable routine", text: "Add exercises and their planned sets, then use Save routine below. This saves a template, not a finished workout." };
  if (f.routineLoaded && !f.choices) return { id: "routine-loaded", title: "Your routine is loaded", text: "The planned sets are ready to record. Changes in this session do not rewrite the routine. You can dismiss this tip." };
  if (f.routineSaved) return { id: "routine-saved", title: "Use your saved routine", text: "Open My routines and apply your template to a workout. If choices are shown, use Start workout first." };
  return { id: "routine-entry", title: "Create or load a routine", text: f.choices ? "Tap Create routine to build a reusable template without starting a workout." : "Use Create routine below to build a template, or My routines to apply an existing one." };
}

export function planTip(f: WorkoutGuideFacts) {
  if (f.builder && !f.choices) return { id: "plan-routine-draft", title: "Review a workout, rather than a template", text: "You are editing a routine template. Go back to Workout choices and start or resume a workout to use Today's Plan." };
  if (f.choices) return { id: "plan-entry", title: "Review your planned workout", text: "Open a workout below, then load a routine or add exercises. Today's Plan reviews that workout." };
  if (f.planApplied) return { id: "plan-applied", title: "Changes applied", text: "Review the changed sets and train when ready. Undo remains available while those prescriptions are unchanged. You can dismiss this tip." };
  if (f.planReady) return { id: "plan-reviewed", title: "Your workout review is ready", text: "You can keep your planned sets and continue training. Reopen Today's Plan only if you want to inspect it again. You can dismiss this tip." };
  return f.hasExercises
    ? { id: "plan-review", title: "Review your planned workout", text: "Review your planned workout using recent performance and today's recovery. You choose whether to apply any suggested changes." }
    : { id: "plan-add", title: "Plan your workout first", text: "Use My routines or Add exercise below. Today's Plan reviews the exercises you have planned." };
}

export function programTip(f: WorkoutGuideFacts) {
  if (f.builder && !f.choices) return { id: "program-routine-draft", title: "Build your program's routine", text: "Add exercises and planned sets, then Save routine. Use Back to return when you are finished." };
  if (!f.choices) return { id: "program-workout-open", title: "Your workout is open", text: "Record your sets as you train. The program strip shows your scheduled days. Use Back to return to Workout choices, or the guide bar to explore another topic." };
  if (f.hasProgram && (f.programCompleted || f.programRest)) return workoutTip(f);
  return f.hasProgram
    ? { id: "program-ready", title: "Use your program", text: "Continue program opens your scheduled day. My programs lets you review or edit your programs. Use the guide bar to explore another topic." }
    : { id: "program-entry", title: "Organize routines into a program", text: "Use Create program or My programs below. Assign a routine or Rest to each day; routines can also be created while assigning." };
}
