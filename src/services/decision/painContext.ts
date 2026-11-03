import type { DailyDecisionContext, PainContext } from "../../types/decision";

/** Read older single-area check-ins without losing newer multi-area reports. */
export const painEntries = (context: Pick<DailyDecisionContext, "pain" | "pains"> | null | undefined): PainContext[] =>
  Array.isArray(context?.pains) ? context.pains : context?.pain ? [context.pain] : [];

export const primaryPain = (pains: PainContext[]): PainContext | null =>
  [...pains].sort((a,b) =>
    (Number(b.affectsPlannedWorkout) - Number(a.affectsPlannedWorkout)) * 10 +
    ({mild:1,moderate:2,severe:3}[b.severity] - {mild:1,moderate:2,severe:3}[a.severity]))[0] ?? null;
