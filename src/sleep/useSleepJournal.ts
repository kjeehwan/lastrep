import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useFocusEffect } from "expo-router";
import { auth, db } from "../config/firebaseConfig";
import { hasHealthSyncConsent } from "../health/healthSyncConsent";
import { getSleepJournalWindow, sleepJournalProfileKey, type SleepJournalWindow } from "./sleepJournalWindow";
import { containsSleepRange, type SleepDateRange } from "./sleepWindowScope";
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
  const [window, setWindow] = useState<SleepDateRange | null>(null);
  const [initialDate, setInitialDate] = useState<string | null>(null);
  const requested = useRef<SleepDateRange | null>(null);
  const cache = useRef<SleepJournalWindow[]>([]);
  const profileKey = useRef<string | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const uidRef = useRef<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, (user) => {
    uidRef.current = user?.uid ?? null;
    generation.current++;
    requested.current = null; cache.current = []; profileKey.current = null; setWindow(null); setInitialDate(null);
    setEntries([]); setLoading(!!user); setError(null); setTarget(7); setOrigin(null);
    setConsent(false); setPermitted(false); setLastChecked(null); setAvailability("checking");
    setAccount(user ? { uid: user.uid, label: user.email ?? "your account" } : null);
    setAuthLoaded(true);
  }), []);
  const load = useCallback(async (range: SleepDateRange | null, force = false) => {
    if (!account || account.uid !== uidRef.current) return;
    requested.current = range;
    const request = ++generation.current;
    const publish = (journal: SleepJournalWindow) => {
      setEntries(journal.entries); setOrigin(journal.origin); setWindow(journal.range);
      setInitialDate(journal.initialDate); setError(null);
      // Targets belong to the settings listener; revisiting a cached window must not restore an older target.
    };
    const saved = !force && range && cache.current.find(item =>
      item.profileKey === profileKey.current && containsSleepRange(item.range, range));
    if (saved) { publish(saved); setLoading(false); return; }
    setLoading(true);
    try {
      const journal = await getSleepJournalWindow(account.uid, range);
      if (request !== generation.current || account.uid !== uidRef.current) return;
      requested.current = journal.range;
      profileKey.current = journal.profileKey;
      cache.current = [journal, ...cache.current.filter(item => item.profileKey === journal.profileKey)].slice(0, 8);
      publish(journal);
    } catch {
      if (request === generation.current && account.uid === uidRef.current)
        setError("Could not load this sleep history. Previously loaded records are kept. Reconnect and try again.");
    } finally { if (request === generation.current && account.uid === uidRef.current) setLoading(false); }
  }, [account]);
  const refresh = useCallback(() => load(requested.current, true), [load]);
  const requestWindow = useCallback((range: SleepDateRange) => {
    if (requested.current?.start === range.start && requested.current?.end === range.end) return;
    void load(range);
  }, [load]);
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
      if (account.uid !== uidRef.current) return;
      const data = snapshot.data();
      const savedTarget = data?.sleepSettings?.targetHours;
      if (typeof savedTarget === "number" && savedTarget > 0 && savedTarget <= 24) setTarget(savedTarget);
      const revision = sleepJournalProfileKey(data);
      if (lastRevision !== revision) { lastRevision = revision; profileKey.current = revision; cache.current = cache.current.filter(item => item.profileKey === revision); void refresh(); }
    }, () => { if (account.uid !== uidRef.current) return; setError("Could not load sleep. Reconnect and try again."); setLoading(false); });
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
  return { account, authLoaded, entries, target, origin, loading, error, availability, consent, permitted, lastChecked, window, initialDate, requestWindow, refresh, refreshAccess };
}
