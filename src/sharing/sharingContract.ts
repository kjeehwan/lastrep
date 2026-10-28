/** Shared wire contract. Pure TypeScript: safe to import from the native client. */
export type SharedSetType = "normal" | "warmup" | "failure" | "drop";
export type ExerciseTargets = { minReps: number | null; maxReps: number | null; targetRpe: number | null };
export type SharedWorkoutSet = {
  weightKg: number | null;
  reps: string;
  targetRpe: number | null;
  setType: SharedSetType;
  durationSec: number | null;
  distanceKm: number | null;
};
export type SharedWorkoutExercise = {
  targets?: ExerciseTargets | null;
  name: string;
  mode: "resistance" | "cardio";
  unit: "kg" | "lbs" | "km" | "mi";
  restSec: number;
  tempo: string;
  instructions: string;
  cardioSessionType?: "steady" | "intervals" | "sprint" | "recovery";
  cardioEffortLevel?: "easy" | "moderate" | "hard" | "max";
  sets: SharedWorkoutSet[];
};
export type SharedWorkoutPlan = {
  version: 1;
  title: string;
  effortScale: "rpe" | "rir";
  exercises: SharedWorkoutExercise[];
};
export type SharingPerson = { uid: string; nickname: string; username: string };
export type SharingSettings = {
  enabled: boolean;
  username: string;
  unreadCount: number;
  requestCount: number;
};
export type SharingDelivery = {
  id: string;
  snapshotId: string;
  title: string;
  sender: SharingPerson;
  status: "request" | "inbox";
  unread: boolean;
  createdAtMs: number;
};
export type SharingSent = {
  id: string;
  snapshotId: string;
  title: string;
  recipients: (SharingPerson & { status: string })[];
  createdAtMs: number;
};
export const SHARING_LIMITS = {
  recipients: 10,
  deliveriesPerDay: 100,
  snapshotsPerDay: 50,
  searchPerMinute: 30,
  pendingSendersPerDay: 20,
  historyDays: 30,
  linkDays: 30,
  exercises: 40,
  sets: 40,
} as const;
export function normalizeSharingUsername(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}
export function validSharingUsername(value: string) {
  return (
    /^[a-z0-9._]{3,24}$/.test(value) &&
    ![
      "admin",
      "administrator",
      "lastrep",
      "support",
      "system",
      "moderator",
    ].includes(value)
  );
}
export function sharingSearchKey(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Invalid workout plan.");
  return v as Record<string, unknown>;
};
const keys = (v: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(v).some((key) => !allowed.includes(key)))
    throw Error("Only workout plan fields can be shared.");
};
const text = (v: unknown, max: number, required = false) => {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw Error("Invalid workout text.");
  return v.trim();
};
const number = (
  v: unknown,
  min: number,
  max: number,
  nullable = false,
): number | null => {
  if (nullable && v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    throw Error("Invalid workout value.");
  return v;
};
export function parseExerciseTargets(input: unknown): ExerciseTargets | null {
  if (input == null) return null;
  const value = object(input);
  keys(value, ["minReps", "maxReps", "targetRpe"]);
  const minReps = number(value.minReps, 1, 100, true);
  const maxReps = number(value.maxReps, 1, 100, true);
  const targetRpe = number(value.targetRpe, 6, 10, true);
  if ((minReps == null) !== (maxReps == null) || (minReps != null && maxReps != null && (!Number.isInteger(minReps) || !Number.isInteger(maxReps) || minReps > maxReps))) throw Error("Enter a valid whole rep range.");
  return minReps == null && targetRpe == null ? null : { minReps, maxReps, targetRpe };
}
export function parseSharedWorkoutPlan(input: unknown): SharedWorkoutPlan {
  const p = object(input);
  keys(p, ["version", "title", "effortScale", "exercises"]);
  if (
    p.version !== 1 ||
    !["rpe", "rir"].includes(String(p.effortScale)) ||
    !Array.isArray(p.exercises) ||
    !p.exercises.length ||
    p.exercises.length > SHARING_LIMITS.exercises
  )
    throw Error("Invalid workout plan.");
  const exercises = p.exercises.map((raw) => {
    const e = object(raw);
    keys(e, [
      "name",
      "mode",
      "unit",
      "restSec",
      "tempo",
      "instructions",
      "sets",
      "cardioSessionType",
      "cardioEffortLevel",
      "targets",
    ]);
    if (
      !["resistance", "cardio"].includes(String(e.mode)) ||
      !(e.mode === "cardio" ? ["km", "mi"] : ["kg", "lbs"]).includes(
        String(e.unit),
      ) ||
      !Array.isArray(e.sets) ||
      !e.sets.length ||
      e.sets.length > SHARING_LIMITS.sets
    )
      throw Error("Invalid exercise.");
    if (
      e.cardioSessionType !== undefined &&
      !["steady", "intervals", "sprint", "recovery"].includes(
        String(e.cardioSessionType),
      )
    )
      throw Error("Invalid cardio session type.");
    if (
      e.cardioEffortLevel !== undefined &&
      !["easy", "moderate", "hard", "max"].includes(String(e.cardioEffortLevel))
    )
      throw Error("Invalid cardio effort level.");
    const restSec = number(e.restSec, 0, 3600)!;
    if (!Number.isInteger(restSec)) throw Error("Rest must use whole seconds.");
    const tempo = text(e.tempo, 20);
    if (tempo && !/^(?:\d{1,2}|X)(?:-(?:\d{1,2}|X)){3}$/i.test(tempo))
      throw Error("Use four tempo parts, such as 3-0-1-0.");
    const sets = e.sets.map((rawSet) => {
      const s = object(rawSet);
      keys(s, [
        "weightKg",
        "reps",
        "targetRpe",
        "setType",
        "durationSec",
        "distanceKm",
      ]);
      if (!["normal", "warmup", "failure", "drop"].includes(String(s.setType)))
        throw Error("Invalid set type.");
      const reps = text(s.reps, 4);
      if (
        e.mode !== "cardio" &&
        (!/^\d+$/.test(reps) || +reps < 1 || +reps > 1000)
      )
        throw Error("Enter whole reps above zero.");
      return {
        weightKg:
          e.mode === "cardio" ? null : number(s.weightKg, 0, 1500, true),
        reps,
        targetRpe: number(s.targetRpe, 6, 10, true),
        setType: s.setType as SharedSetType,
        durationSec: number(s.durationSec, 0, 86400, true),
        distanceKm: number(s.distanceKm, 0, 2000, true),
      };
    });
    return {
      name: text(e.name, 100, true),
      ...(e.targets !== undefined ? { targets: e.mode === "cardio" ? null : parseExerciseTargets(e.targets) } : {}),
      mode: e.mode as SharedWorkoutExercise["mode"],
      unit: e.unit as SharedWorkoutExercise["unit"],
      restSec,
      tempo,
      instructions: text(e.instructions, 500),
      ...(e.mode === "cardio" && e.cardioSessionType
        ? {
            cardioSessionType:
              e.cardioSessionType as SharedWorkoutExercise["cardioSessionType"],
          }
        : {}),
      ...(e.mode === "cardio" && e.cardioEffortLevel
        ? {
            cardioEffortLevel:
              e.cardioEffortLevel as SharedWorkoutExercise["cardioEffortLevel"],
          }
        : {}),
      sets,
    };
  });
  const result: SharedWorkoutPlan = {
    version: 1,
    title: text(p.title, 80, true),
    effortScale: p.effortScale as "rpe" | "rir",
    exercises,
  };
  if (JSON.stringify(result).length > 48000)
    throw Error("This workout is too large to share.");
  return result;
}
