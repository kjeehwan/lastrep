import { availableWeightAtOrBelow, type AvailableWeights } from "./availableWeights";

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
  availableWeights?: AvailableWeights;
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
  const latestOneRepMax = estimatedOneRepMax(latestTopSet);
  const latestRpes = latestSets.flatMap((set) => (set.rpe == null ? [] : [set.rpe]));
  const latestSessionRpe = median(latestRpes);
  const latestPeakRpe = latestRpes.length ? Math.max(...latestRpes) : null;
  const latestWasMaximal = latestPeakRpe != null && latestPeakRpe >= 9;
  // The latest demonstrated performance is the ceiling when asking for more reps. Older,
  // stronger sessions can inform a trend, but must not create an unsafe load-and-rep jump.
  const raisesRepTarget = targetReps > latestTopSet.reps;
  const baselineOneRepMax = latestWasMaximal || raisesRepTarget
    ? Math.min(median(recentOneRepMaxes) ?? latestOneRepMax, latestOneRepMax)
    : median(recentOneRepMaxes) ?? latestOneRepMax;
  const priorOneRepMax = median(recentOneRepMaxes.slice(1));
  const strengthIsDeclining =
    !latestWasMaximal && priorOneRepMax != null && recentOneRepMaxes[0] < priorOneRepMax * 0.95;
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
  } else if (
    !latestWasMaximal &&
    latestSessionRpe != null &&
    latestSessionRpe <= 7 &&
    input.decisionIntensityPct >= 0 &&
    !input.highFatigue
  ) {
    weightKg = roundToPlate(weightKg + 2.5);
    reasons.push("Recent effort was controlled, so a small load progression is appropriate.");
  } else if (latestWasMaximal) {
    weightKg = roundToPlate(weightKg * 0.95);
    reasons.push("Recent effort was very high, so the prescription stays below that current limit.");
  } else {
    reasons.push("Repeat a proven working prescription before progressing.");
  }

  if (input.decisionIntensityPct < 0) {
    weightKg = roundToPlate(weightKg * Math.max(0.9, 1 + input.decisionIntensityPct / 100));
    reasons.push("Recovery signals call for a lighter load.");
  } else if (input.highFatigue && !latestWasMaximal) {
    weightKg = roundToPlate(weightKg * 0.95);
    reasons.push("Recent workout fatigue calls for a lighter load.");
  } else if (input.dietPhase === "Cut") {
    reasons.push("The cut phase favors controlled loading.");
  }

  let reps = targetReps;
  if (input.availableWeights) {
    const available = availableWeightAtOrBelow(weightKg, input.availableWeights);
    if (weightKg > latestTopSet.weightKg && (available == null || available <= latestTopSet.weightKg)) {
      weightKg = latestTopSet.weightKg;
      reps += 1;
      reasons.push("The next available weight is too large a jump, so add a rep instead.");
    } else if (available != null && available >= latestTopSet.weightKg * 0.5) {
      weightKg = available;
    } else {
      weightKg = latestTopSet.weightKg;
      reps = Math.max(1, Math.min(targetReps, latestTopSet.reps - 1));
      reasons.push("No suitable lighter weight is available, so reduce reps at the current load.");
    }
  }
  return { weightKg, reps: String(reps), sets, reason: reasons.join(" ") };
};
