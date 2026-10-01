export type ProgressionPhase = "Hypertrophy" | "Strength" | "Power";

export type PerformanceSet = {
  weightKg: number | null;
  reps: string | number | null;
  rpe?: string | number | null;
  setType?: "warmup" | "normal" | "failure" | "drop";
};

export type ExercisePerformanceSession = {
  sets: PerformanceSet[];
};

export type ExerciseProgressionInput = {
  exerciseName: string;
  sessions: ExercisePerformanceSession[];
  phase: ProgressionPhase;
  baseSets: number;
  decisionIntensityPct: number;
  dietPhase: "Cut" | "Maintain" | "Bulk";
  highFatigue: boolean;
};

export type ExerciseProgression = {
  weightKg: number | null;
  reps: string;
  sets: number;
  reason: string;
};

type WorkingSet = { weightKg: number; reps: number; rpe: number | null };

const repRangeForPhase = (phase: ProgressionPhase) => {
  if (phase === "Strength") return { min: 3, max: 6, preferred: 4 };
  if (phase === "Power") return { min: 2, max: 5, preferred: 3 };
  return { min: 6, max: 12, preferred: 8 };
};

const toWorkingSets = (sets: PerformanceSet[]): WorkingSet[] =>
  sets.flatMap((set) => {
    if (set.setType === "warmup") return [];
    const weightKg = Number(set.weightKg);
    const reps = Number(set.reps);
    if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(reps) || reps <= 0) return [];
    const rawRpe = Number(set.rpe);
    return [{ weightKg, reps, rpe: Number.isFinite(rawRpe) && rawRpe >= 1 && rawRpe <= 10 ? rawRpe : null }];
  });

const estimatedOneRepMax = (set: WorkingSet) => set.weightKg * (1 + set.reps / 30);
const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const roundToPlate = (weightKg: number) => Math.round(weightKg * 2) / 2;

export const recommendExerciseProgression = (input: ExerciseProgressionInput): ExerciseProgression => {
  const range = repRangeForPhase(input.phase);
  const sessionSets = input.sessions.map((session) => toWorkingSets(session.sets)).filter((sets) => sets.length > 0);
  if (!sessionSets.length) {
    return {
      weightKg: null,
      reps: String(range.preferred),
      sets: Math.max(1, input.baseSets),
      reason: "No prior record for this exercise, so choose a comfortable starting load.",
    };
  }

  const latestSets = sessionSets[0];
  const latestTopSet = latestSets.reduce((best, set) =>
    estimatedOneRepMax(set) > estimatedOneRepMax(best) ? set : best
  );
  const targetReps =
    input.phase === "Hypertrophy"
      ? range.preferred
      : Math.min(range.max, Math.max(range.min, latestTopSet.reps));
  const recentOneRepMaxes = sessionSets.slice(0, 3).map((sets) =>
    Math.max(...sets.map(estimatedOneRepMax))
  );
  const baselineOneRepMax = median(recentOneRepMaxes) ?? estimatedOneRepMax(latestTopSet);
  const priorOneRepMax = median(recentOneRepMaxes.slice(1));
  const strengthIsDeclining =
    priorOneRepMax != null && recentOneRepMaxes[0] < priorOneRepMax * 0.95;
  const latestSessionRpe = median(latestSets.flatMap((set) => (set.rpe == null ? [] : [set.rpe])));
  const latestMatchesTarget = latestTopSet.reps === targetReps;
  let weightKg = latestMatchesTarget
    ? latestTopSet.weightKg
    : roundToPlate(baselineOneRepMax / (1 + targetReps / 30));
  // Workout length supplies an explicit volume budget; performance determines the prescription.
  const sets = Math.max(1, input.baseSets);
  const reasons: string[] = [
    `Last ${input.exerciseName}: ${roundToPlate(latestTopSet.weightKg)} kg x ${latestTopSet.reps}` +
      (latestTopSet.rpe == null ? "." : ` @ RPE ${latestTopSet.rpe}.`),
  ];

  if (strengthIsDeclining) {
    weightKg = roundToPlate(weightKg * 0.95);
    reasons.push("Recent estimated strength is down, so load was reduced.");
  } else if (latestSessionRpe != null && latestSessionRpe <= 7 && input.decisionIntensityPct >= 0 && !input.highFatigue) {
    weightKg = roundToPlate(weightKg + 2.5);
    reasons.push("Recent effort was controlled, so a small load progression is appropriate.");
  } else if (latestSessionRpe != null && latestSessionRpe >= 9) {
    weightKg = roundToPlate(weightKg * 0.95);
    reasons.push("Recent effort was very high, so load was reduced.");
  } else {
    reasons.push("Repeat a proven working prescription before progressing.");
  }

  if (input.decisionIntensityPct < 0 || input.highFatigue) {
    weightKg = roundToPlate(weightKg * Math.max(0.9, 1 + input.decisionIntensityPct / 100));
    reasons.push("Recovery signals call for a lighter load.");
  } else if (input.dietPhase === "Cut") {
    reasons.push("The cut phase favors controlled loading.");
  }

  return { weightKg, reps: String(targetReps), sets, reason: reasons.join(" ") };
};
