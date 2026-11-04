// Generated from src/sharing/sharingContract.ts. Run npm --prefix functions run build.
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
export type SharedProgramPlan = {
  version: 2;
  kind: "program";
  title: string;
  effortScale: "rpe" | "rir";
  days: { type: "workout" | "rest"; title: string; routineKey: string | null }[];
  routines: { key: string; plan: SharedWorkoutPlan }[];
};
export type SharedPlan = SharedWorkoutPlan | SharedProgramPlan;
export const isSharedProgram = (plan: SharedPlan): plan is SharedProgramPlan => plan.version === 2;
export type SharingPerson = { uid: string; nickname: string; username: string };
export type SharingSettings = {
  enabled: boolean;
  username: string;
  unreadCount: number;
  requestCount: number;
};
export type SharingDelivery = {
  kind?: "workout" | "program";
  id: string;
  snapshotId: string;
  title: string;
  sender: SharingPerson;
  status: "request" | "inbox";
  unread: boolean;
  createdAtMs: number;
};
export type SharingSent = {
  kind?: "workout" | "program";
  id: string;
  snapshotId: string;
  title: string;
  recipients: (SharingPerson & { status: "request" | "inbox" | "viewed" })[];
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
  programDays: 14,
  programExercises: 160,
  programSets: 1600,
  programCharacters: 120000,
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

/** Program snapshots contain local references only, never account/routine IDs or run history. */
export function parseSharedPlan(input: unknown): SharedPlan {
  const p = object(input);
  if (p.version !== 2) return parseSharedWorkoutPlan(input);
  keys(p, ["version", "kind", "title", "effortScale", "days", "routines"]);
  if (p.kind !== "program" || !["rpe", "rir"].includes(String(p.effortScale)) || !Array.isArray(p.days) || !p.days.length || p.days.length > SHARING_LIMITS.programDays || !Array.isArray(p.routines) || !p.routines.length || p.routines.length > SHARING_LIMITS.programDays) throw Error("Assign a routine or Rest to every program day.");
  const routines = p.routines.map(raw => {
    const r = object(raw); keys(r, ["key", "plan"]);
    const key = text(r.key, 24, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw Error("Invalid routine reference.");
    return { key, plan: parseSharedWorkoutPlan(r.plan) };
  });
  const references = new Set(routines.map(r => r.key));
  if (references.size !== routines.length) throw Error("Routine references must be unique.");
  const days = p.days.map(raw => {
    const d = object(raw); keys(d, ["type", "title", "routineKey"]);
    if (d.type !== "rest" && d.type !== "workout") throw Error("Assign every program day before sharing.");
    if (d.type === "rest" ? d.routineKey !== null : typeof d.routineKey !== "string" || !references.has(d.routineKey)) throw Error("The assigned routine is unavailable.");
    return { type: d.type as "workout" | "rest", title: text(d.title, 100, true), routineKey: d.routineKey as string | null };
  });
  const used = new Set(days.flatMap(d => d.routineKey ? [d.routineKey] : []));
  if (used.size !== references.size) throw Error("Share only routines assigned to this program.");
  const exercises = routines.flatMap(r => r.plan.exercises);
  const result: SharedProgramPlan = { version: 2, kind: "program", title: text(p.title, 100, true), effortScale: p.effortScale as "rpe" | "rir", days, routines };
  if (exercises.length > SHARING_LIMITS.programExercises || exercises.reduce((n,e) => n + e.sets.length, 0) > SHARING_LIMITS.programSets || JSON.stringify(result).length > SHARING_LIMITS.programCharacters) throw Error("This program is too large to share. Try a smaller cycle.");
  return result;
}
