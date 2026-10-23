import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { getDailyStepsState, refreshDailySteps, seedDailySteps, subscribeDailySteps } from "./dailySteps";
export function useDailySteps(uid: string | null) {
  const network = useOfflineStatus();
  const state = useSyncExternalStore(subscribeDailySteps, useCallback(() => getDailyStepsState(uid), [uid]), useCallback(() => getDailyStepsState(uid), [uid]));
  const refresh = useCallback((force = false) => uid ? refreshDailySteps(uid, network.ready && !network.isOffline, force) : Promise.resolve(getDailyStepsState(null)), [uid, network.ready, network.isOffline]);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), snapshot => seedDailySteps(uid, snapshot.data()?.dailySteps), () => { /* Cached values remain usable. */ });
  }, [uid]);
  useFocusEffect(useCallback(() => {
    if (AppState.currentState === "active") void refresh();
    const app = AppState.addEventListener("change", next => { if (next === "active") void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 60_000);
    return () => { app.remove(); clearInterval(timer); };
  }, [refresh]));
  return { ...state, refresh };
}
