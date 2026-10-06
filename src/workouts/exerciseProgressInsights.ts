export type ProgressSet = {
  weightKg: number | null;
  reps: string;
  rpe?: string;
  setType?: string;
};

export type ProgressSessionInput = {
  date: Date;
  sets: ProgressSet[];
};

export type ExerciseProgressSession = {
  key: string;
  date: Date;
  estimatedOneRepMaxKg: number;
  bestWeightKg: number;
  bestSetReps: number;
  bestSetRpe: number | null;
  volumeKg: number;
  isStrengthPr: boolean;
};

export type ExerciseProgressInsights = {
  sessions: ExerciseProgressSession[];
  latest: ExerciseProgressSession | null;
  best: ExerciseProgressSession | null;
  changeFromPreviousPct: number | null;
};

const parsePositive = (value: string | undefined): number | null => {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const estimateOneRepMaxKg = (weightKg: number, reps: number): number =>
  weightKg * (1 + Math.min(reps, 30) / 30);

export const buildExerciseProgressInsights = (
  inputs: ProgressSessionInput[]
): ExerciseProgressInsights => {
  let priorBest = 0;
  const sessions = [...inputs]
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .flatMap((session) => {
      const workingSets = session.sets.flatMap((set) => {
        if (set.setType === "warmup") return [];
        const reps = parsePositive(set.reps);
        const weightKg = set.weightKg;
        if (reps == null || typeof weightKg !== "number" || !Number.isFinite(weightKg) || weightKg <= 0) {
          return [];
        }
        return [{
          weightKg,
          reps,
          rpe: parsePositive(set.rpe),
          estimatedOneRepMaxKg: estimateOneRepMaxKg(weightKg, reps),
        }];
      });
      if (workingSets.length === 0) return [];

      const topSet = workingSets.reduce((best, set) =>
        set.estimatedOneRepMaxKg > best.estimatedOneRepMaxKg ? set : best
      );
      const estimatedOneRepMaxKg = Math.round(topSet.estimatedOneRepMaxKg * 10) / 10;
      const isStrengthPr = estimatedOneRepMaxKg > priorBest + 0.05;
      priorBest = Math.max(priorBest, estimatedOneRepMaxKg);

      return [{
        key: `${session.date.getTime()}-${estimatedOneRepMaxKg}`,
        date: session.date,
        estimatedOneRepMaxKg,
        bestWeightKg: topSet.weightKg,
        bestSetReps: topSet.reps,
        bestSetRpe: topSet.rpe,
        volumeKg: Math.round(workingSets.reduce((sum, set) => sum + set.weightKg * set.reps, 0)),
        isStrengthPr,
      }];
    });

  const latest = sessions.at(-1) ?? null;
  const previous = sessions.at(-2) ?? null;
  const best = sessions.reduce<ExerciseProgressSession | null>(
    (current, session) =>
      !current || session.estimatedOneRepMaxKg > current.estimatedOneRepMaxKg ? session : current,
    null
  );
  const changeFromPreviousPct =
    latest && previous && previous.estimatedOneRepMaxKg > 0
      ? Math.round(
          ((latest.estimatedOneRepMaxKg - previous.estimatedOneRepMaxKg) /
            previous.estimatedOneRepMaxKg) *
            1000
        ) / 10
      : null;

  return { sessions, latest, best, changeFromPreviousPct };
};
