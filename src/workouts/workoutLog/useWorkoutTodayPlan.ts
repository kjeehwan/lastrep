import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteField, doc, Timestamp, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../../config/firebaseConfig";
import { EXERCISE_CATALOG } from "../exerciseCatalog";
import type { DailyDecisionContext, LastResultPayload, PlannedWorkoutSummary } from "../../types/decision";
import { loadWorkoutPlanContext, RECOVERY_INPUTS_KEY, type RecoveryInputs } from "../../services/decision/loadWorkoutPlanContext";
import { buildDeterministicTodayPlan } from "../../services/decision/todayPlanEngine";
import { hashDecisionInputs } from "../../services/decision/inputHash";
import { showAppAlert } from "../../ui/appDialog";

export function useWorkoutTodayPlan(uid: string | null, plannedWorkout: PlannedWorkoutSummary) {
  const [plan, setPlan] = useState<LastResultPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryInputs>({ soreness: 4, fatigue: 4, motivation: 6 });
  const [inputsChanged, setInputsChanged] = useState(false);
  const [contextVisible, setContextVisible] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const uidRef = useRef(uid);

  useEffect(() => {
    mountedRef.current = true;
    uidRef.current = uid;
    return () => { mountedRef.current = false; requestRef.current += 1; };
  }, [uid]);

  const reset = useCallback(() => {
    requestRef.current += 1;
    setPlan(null); setVisible(false); setBusy(false); setError(null);
    setInputsChanged(false); setContextVisible(false); setContextSaving(false);
  }, []);

  const review = useCallback(async () => {
    if (!uid || !mountedRef.current) return;
    const request = ++requestRef.current;
    setVisible(true);
    setBusy(true);
    setError(null);
    try {
      const snapshot = await loadWorkoutPlanContext(uid, plannedWorkout, inputsChanged ? recovery : undefined);
      if (request !== requestRef.current || uidRef.current !== uid) return;
      const result = buildDeterministicTodayPlan(snapshot.inputs, snapshot.workouts, new Date(), EXERCISE_CATALOG, snapshot.sleepTargetHours);
      const payload = { createdAt: Timestamp.now(), inputs: snapshot.inputs, result };
      setPlan(payload);
      setRecovery(snapshot.recovery);
      setInputsChanged(false);
      void updateDoc(doc(db, "users", uid), {
        "usage.decisions.lastResult": payload,
        "usage.decisions.lastInputHash": hashDecisionInputs(snapshot.inputs),
      }).catch((failure) => console.log("Failed to save today's plan", failure));
    } catch (failure) {
      if (request !== requestRef.current || uidRef.current !== uid) return;
      console.log("Failed to review today's plan", failure);
      setError("Could not load your latest data. Try again.");
    } finally {
      if (request === requestRef.current && uidRef.current === uid) setBusy(false);
    }
  }, [uid, plannedWorkout, inputsChanged, recovery]);

  const changeRecovery = (key: keyof RecoveryInputs, value: number) => {
    const next = { ...recovery, [key]: Math.round(value) };
    setRecovery(next);
    setInputsChanged(true);
    if (uid) void AsyncStorage.setItem(`${RECOVERY_INPUTS_KEY}:${uid}`, JSON.stringify(next))
      .catch((failure) => console.log("Failed to save recovery inputs", failure));
  };

  const saveContext = async (context: DailyDecisionContext) => {
    if (!uid || contextSaving || !mountedRef.current) return;
    setContextSaving(true);
    try {
      const updatedAt = Timestamp.now();
      await updateDoc(doc(db, "users", uid), {
        todayPlanContext: { ...context, updatedAt },
        activePainContext: context.pain ? { ...context.pain, updatedAt } : deleteField(),
      });
      if (uidRef.current !== uid || !mountedRef.current) return;
      setContextVisible(false);
      await review();
    } catch (failure) {
      console.log("Failed to save today's context", failure);
      if (mountedRef.current && uidRef.current === uid) showAppAlert("Context not saved", "Please try again.");
    } finally {
      if (mountedRef.current && uidRef.current === uid) setContextSaving(false);
    }
  };

  return { reset, plan, setPlan, visible, setVisible, busy, error, recovery, inputsChanged, review, changeRecovery,
    contextVisible, setContextVisible, contextSaving, saveContext };
}
