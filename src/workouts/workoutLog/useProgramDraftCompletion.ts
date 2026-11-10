import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { auth } from "../../config/firebaseConfig";
import type { ProgramLink } from "../programFlow";
import { completedProgramWorkoutId, programCompletionRef } from "./programDraftCompletion";

/** Completion is shared; draft contents stay local to each installation. */
export function useProgramDraftCompletion(uid: string | null, link: ProgramLink | null) {
  const key = uid && link ? `${uid}:${link.programId}:${link.runId}:${link.ordinal}` : null;
  const [state, setState] = useState<{ key: string; checked: boolean; workoutId: string | null } | null>(null);
  useEffect(() => {
    if (!uid || !link || !key) return;
    let alive = true;
    const stop = onSnapshot(programCompletionRef(uid, link), snapshot => {
      if (alive && auth.currentUser?.uid === uid) setState({ key, checked: true, workoutId: completedProgramWorkoutId(snapshot.data()) });
    }, () => {
      // Offline/missing evidence must never discard or label an unfinished draft complete.
      if (alive && auth.currentUser?.uid === uid) setState({ key, checked: true, workoutId: null });
    });
    return () => { alive = false; stop(); };
  }, [uid, key, link]);
  return { key, checked: !key || state?.key === key && state.checked, workoutId: state?.key === key ? state.workoutId : null };
}
