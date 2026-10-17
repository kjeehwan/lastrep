import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useFocusEffect } from "expo-router";
import { auth, db } from "../config/firebaseConfig";
import { hasHealthSyncConsent } from "../health/healthSyncConsent";
import { getSleepJournal } from "./sleepJournal";
import { getHealthConnectAvailability, hasHealthSleepPermission, autoSyncSleepFromHealthConnectIfEligible, type HealthConnectAvailability } from "./sleep";
import type { SleepEntry } from "./sleepSessionModel";
import { scheduleAfterInteractions } from "../utils/scheduleAfterInteractions";

export function useSleepJournal() {
  const [account, setAccount] = useState<{ uid: string; label: string } | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [target, setTarget] = useState(7);
  const [origin, setOrigin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<HealthConnectAvailability | "checking">("checking");
  const [consent, setConsent] = useState(false);
  const [permitted, setPermitted] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const uidRef = useRef<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, (user) => {
    uidRef.current = user?.uid ?? null;
    generation.current++;
    setEntries([]); setLoading(!!user); setError(null); setTarget(7); setOrigin(null);
    setConsent(false); setPermitted(false); setLastChecked(null); setAvailability("checking");
    setAccount(user ? { uid: user.uid, label: user.email ?? "your account" } : null);
    setAuthLoaded(true);
  }), []);
  const refresh = useCallback(async () => {
    if (!account) return;
    const request = ++generation.current;
    try {
      const journal = await getSleepJournal(account.uid);
      if (request !== generation.current || account.uid !== uidRef.current) return;
      setEntries(journal.entries); setOrigin(journal.profile?.originAppPackage ?? null); setError(null);
      const savedTarget = journal.target;
      if (typeof savedTarget === "number" && savedTarget > 0 && savedTarget <= 24) setTarget(savedTarget);
    } catch {
      if (request === generation.current) setError("Could not refresh sleep. Your saved records are still shown.");
    } finally { if (request === generation.current) setLoading(false); }
  }, [account]);
  const refreshAccess = useCallback(async () => {
    if (!account) return;
    try {
      const [accepted, available, checked] = await Promise.all([hasHealthSyncConsent(account.uid), getHealthConnectAvailability(), AsyncStorage.getItem(`sleep-last-check:${account.uid}`)]);
      const granted = available === "available" && await hasHealthSleepPermission();
      if (account.uid !== uidRef.current) return;
      setConsent(accepted); setAvailability(available); setPermitted(granted); setLastChecked(checked);
    } catch { if (account.uid === uidRef.current) { setAvailability("unavailable"); setPermitted(false); } }
  }, [account]);
  useEffect(() => {
    if (!account) return;
    let lastRevision: unknown = Symbol("initial");
    const unsubscribe = onSnapshot(doc(db, "users", account.uid), (snapshot) => {
      const data = snapshot.data();
      const savedTarget = data?.sleepSettings?.targetHours;
      if (typeof savedTarget === "number" && savedTarget > 0 && savedTarget <= 24) setTarget(savedTarget);
      const revision = data?.sleepProfile?.journalRevision ?? data?.sleepProfile?.sampleRecordedAt?.toMillis?.() ?? 0;
      if (lastRevision !== revision) { lastRevision = revision; void refresh(); }
    }, () => { setError("Could not load sleep. Reconnect and try again."); setLoading(false); });
    return () => { unsubscribe(); invalidate(); };
  }, [account, refresh, invalidate]);
  useFocusEffect(useCallback(() => {
    const task = scheduleAfterInteractions(() => {
      void refreshAccess();
      if (account) void autoSyncSleepFromHealthConnectIfEligible(account.uid, { minIntervalMinutes: 30 }).then(() => refreshAccess());
    });
    const foreground = AppState.addEventListener("change", (state) => { if (state === "active") void refreshAccess(); });
    return () => { task.cancel(); foreground.remove(); };
  }, [account, refreshAccess]));
  return { account, authLoaded, entries, target, origin, loading, error, availability, consent, permitted, lastChecked, refresh, refreshAccess };
}
