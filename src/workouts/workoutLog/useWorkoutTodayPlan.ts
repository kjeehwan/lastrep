import { deleteField, doc, onSnapshot, Timestamp, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../../config/firebaseConfig";
import { EXERCISE_CATALOG } from "../exerciseCatalog";
import type { DailyDecisionContext, LastResultPayload, PlannedWorkoutSummary } from "../../types/decision";
import { loadWorkoutPlanContext, type RecoveryInputs } from "../../services/decision/loadWorkoutPlanContext";
import { buildDeterministicTodayPlan } from "../../services/decision/todayPlanEngine";
import { hashDecisionInputs } from "../../services/decision/inputHash";
import { showAppAlert } from "../../ui/appDialog";
import { recoveryComplete } from "../../services/decision/recoveryCheckIn";
import { planContextRevision } from "../../services/decision/planContextRevision";
import { newDeloadPeriod } from "../deload";

export function useWorkoutTodayPlan(uid: string | null, plannedWorkout: PlannedWorkoutSummary, onReviewed?: () => void) {
  const [plan, setPlan] = useState<LastResultPayload | null>(null);
  const [visible, updateVisible] = useState(false);
  const visibleRef = useRef(false);
  const setVisible = useCallback((value: boolean) => {
    visibleRef.current = value;
    updateVisible(value);
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryInputs>({ soreness: 4, fatigue: 4, motivation: 6 });
  const [contextSnapshot,setContextSnapshot] = useState<{uid:string;revision:string}|null>(null);
  const [reviewedRevision,setReviewedRevision] = useState<string|null>(null);
  const inputsChanged = Boolean(plan && contextSnapshot?.uid===uid && reviewedRevision!==contextSnapshot.revision);
  const [contextVisible, setContextVisible] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);
  const uidRef = useRef(uid);
  useEffect(()=>{
    if(!uid)return;
    return onSnapshot(doc(db,"users",uid),document=>setContextSnapshot({uid,revision:planContextRevision(document.data()??{})}));
  },[uid]);

  useEffect(() => {
    mountedRef.current = true;
    uidRef.current = uid;
    return () => { mountedRef.current = false; requestRef.current += 1; };
  }, [uid]);

  const reset = useCallback(() => {
    requestRef.current += 1;
    setPlan(null); setVisible(false); setBusy(false); setError(null);
    setReviewedRevision(null); setContextVisible(false); setContextSaving(false);
  }, [setVisible]);

  const review = useCallback(async () => {
    if (!uid || !mountedRef.current) return;
    const request = ++requestRef.current;
    setVisible(true);
    setBusy(true);
    setError(null);
    try {
      const snapshot = await loadWorkoutPlanContext(uid, plannedWorkout);
      if (request !== requestRef.current || uidRef.current !== uid) return;
      if (!recoveryComplete(snapshot.recoveryCheckIn)) {
        setPlan(null); setVisible(false); setContextVisible(true); return;
      }
      const result = buildDeterministicTodayPlan(snapshot.inputs, snapshot.workouts, new Date(), EXERCISE_CATALOG, snapshot.sleepTargetHours);
      const payload = { createdAt: Timestamp.now(), inputs: snapshot.inputs, result };
      setPlan(payload);
      if (visibleRef.current) onReviewed?.();
      setRecovery(snapshot.recovery);
      setReviewedRevision(snapshot.contextRevision);
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
  }, [uid, plannedWorkout, onReviewed, setVisible]);

  const changeRecovery = (key: keyof RecoveryInputs, value: number) => {
    // Legacy callers also enter the shared staged form; there is no separate local check-in.
    setContextVisible(true);
  };
  const changeDeload = async (enabled:boolean) => {
    if(!uid||uidRef.current!==uid)throw Error("Your account changed.");
    await updateDoc(doc(db,"users",uid),{workoutDeload:enabled?newDeloadPeriod(String(Timestamp.now().toMillis())):deleteField()});
    if(enabled&&uidRef.current===uid)await review();
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
    contextVisible, setContextVisible, contextSaving, saveContext,changeDeload };
}
