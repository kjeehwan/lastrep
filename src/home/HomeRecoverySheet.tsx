import React from "react";
import { auth } from "../config/firebaseConfig";
import { RecoveryCheckInSheet } from "../services/decision/RecoveryCheckInSheet";
import type { RecoveryInputs } from "../services/decision/loadWorkoutPlanContext";

export function HomeRecoverySheet({ initial, onSave, onClose }: {
  initial: RecoveryInputs; contextSummary: string; onContext: () => void;
  onSave: (value: RecoveryInputs) => Promise<void>; onClose: () => void;
}) {
  const uid = auth.currentUser?.uid;
  return uid ? <RecoveryCheckInSheet uid={uid} onClose={onClose} onSaved={value => onSave({
    soreness: value.ratings.soreness ?? initial.soreness,
    fatigue: value.ratings.fatigue ?? initial.fatigue,
    motivation: value.ratings.motivation ?? initial.motivation,
  })} /> : null;
}
