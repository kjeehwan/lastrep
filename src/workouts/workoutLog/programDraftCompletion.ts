import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebaseConfig";
import { normalizeProgramLink, type ProgramLink } from "../programFlow";
import type { DraftSlots } from "./workoutDraftSlots";

export function programCompletionRef(uid: string, link: ProgramLink) {
  return doc(db, "users", uid, "workoutPrograms", link.programId, "runs", link.runId, "occurrences", String(link.ordinal));
}
export function completedProgramWorkoutId(value: unknown): string | null {
  const data = value as { status?: string; workoutId?: unknown } | null;
  return data?.status === "completed" && typeof data.workoutId === "string" && data.workoutId ? data.workoutId : null;
}
/** Retain local differences without presenting a finished occurrence as resumable. */
export function retireCompletedDraft(draft: Record<string, unknown>, workoutId: string) {
  return { ...draft, completedProgramWorkoutId: workoutId, workoutTimerRunning: false,
    workoutTimerStartedAtMs: null, restTimerByExercise: {} };
}
export function resumableProgramDrafts(slots: DraftSlots): DraftSlots {
  return Object.fromEntries(Object.entries(slots).filter(([,draft]) => !draft.completedProgramWorkoutId));
}
export async function annotateCompletedProgramDrafts(uid: string, slots: DraftSlots): Promise<DraftSlots> {
  if (auth.currentUser?.uid !== uid) throw new Error("Your account changed.");
  const entries = await Promise.all(Object.entries(slots).map(async ([key, draft]) => {
    if (typeof draft.completedProgramWorkoutId === "string" && draft.completedProgramWorkoutId) return [key, retireCompletedDraft(draft, draft.completedProgramWorkoutId)] as const;
    const link = normalizeProgramLink(draft.programLink);
    if (!link) return [key, draft] as const;
    const completion = await getDoc(programCompletionRef(uid, link));
    const workoutId = completedProgramWorkoutId(completion.data()) ?? (typeof draft.completedProgramWorkoutId === "string" ? draft.completedProgramWorkoutId : null);
    return [key, workoutId ? retireCompletedDraft(draft, workoutId) : draft] as const;
  }));
  if (auth.currentUser?.uid !== uid) throw new Error("Your account changed.");
  return Object.fromEntries(entries);
}
