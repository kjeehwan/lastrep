/** Only review inputs belong here: saving advice itself must not stale that advice. */
export function planContextRevision(user: Record<string,any>) {
  const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])) : value ?? null;
  return JSON.stringify(stable({recoveryCheckIn:user.recoveryCheckIn,todayPlanContext:user.todayPlanContext,
    trainingPhase:user.trainingPhase,trainingPhaseStartedAt:user.trainingPhaseStartedAt,trainingPhaseWeekBase:user.trainingPhaseWeekBase,trainingPhaseWeekAnchorAt:user.trainingPhaseWeekAnchorAt,
    dietPhase:user.dietPhase,dietPhaseStartedAt:user.dietPhaseStartedAt,dietPhaseWeekBase:user.dietPhaseWeekBase,dietPhaseWeekAnchorAt:user.dietPhaseWeekAnchorAt,
    availableWeights:user.availableWeights,progressionPreferences:user.progressionPreferences,workoutDeload:user.workoutDeload}));
}
