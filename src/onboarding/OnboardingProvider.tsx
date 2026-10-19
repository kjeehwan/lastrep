import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { auth } from "../config/firebaseConfig";
import { useOfflineStatus } from "../hooks/useOfflineStatus";
import { emptyDraft, initialProgress, onboardingKey, type OnboardingCache, type OnboardingDraft, type OnboardingStep } from "./onboardingState";
import { loadOnboardingCache, saveOnboardingStep } from "./onboardingService";

const OFFLINE_MESSAGE = "You are offline. Reconnect and try again. Your entries are still here.";

function useOnboardingState() {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const cache = useRef<OnboardingCache>({ progress: initialProgress, draft: emptyDraft });
  const lock = useRef(false);
  const writes = useRef(Promise.resolve());
  const generation = useRef(0);
  const { isOffline, ready: networkReady } = useOfflineStatus();
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, user => {
      const scope = ++generation.current;
      setUid(user?.uid ?? null); setReady(false); setDraft(emptyDraft); setError(null); setBusy(false); lock.current = false;
      if (!user) { setReady(true); return; }
      void loadOnboardingCache(user.uid).then(value => {
        if (!active || scope !== generation.current) return;
        cache.current = value; setDraft(value.draft); setReady(true);
      }).catch(() => {
        if (active && scope === generation.current) setError("Couldn't load your setup. Reconnect and retry.");
      });
    });
    const invalidate = () => { generation.current += 1; };
    return () => { active = false; invalidate(); unsubscribe(); };
  }, [reload]);
  const persist = (value: OnboardingCache, account: string, scope: number) => {
    writes.current = writes.current.then(() => AsyncStorage.setItem(onboardingKey(account), JSON.stringify(value))).catch(() => {
      if (scope === generation.current) setError("Couldn't keep a draft on this device. Your entries are still here; try Continue to save.");
    });
    return writes.current;
  };
  const change = (patch: Partial<OnboardingDraft>) => {
    if (!uid || !ready || lock.current) return;
    const value = { ...cache.current, draft: { ...cache.current.draft, ...patch } };
    cache.current = value; setDraft(value.draft); setError(null);
    void persist(value, uid, generation.current);
  };
  const advance = async (step: OnboardingStep, skip = false) => {
    if (!uid || !ready || lock.current) return null;
    if (isOffline) { setError(OFFLINE_MESSAGE); return null; }
    const account = uid, scope = generation.current;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await saveOnboardingStep(account, step, cache.current.draft, skip);
      if (scope !== generation.current || auth.currentUser?.uid !== account) return null;
      cache.current = { ...cache.current, progress: result.progress };
      await persist(cache.current, account, scope);
      return scope === generation.current && auth.currentUser?.uid === account ? result.destination : null;
    } catch {
      if (scope === generation.current) setError("Couldn't save this step. Check your connection and try again. Your entries are still here.");
      return null;
    } finally { if (scope === generation.current) { lock.current = false; setBusy(false); } }
  };
  // Connection status supersedes an offline preflight warning, not a failed save.
  const feedback = error === OFFLINE_MESSAGE && networkReady && !isOffline ? null : error;
  return { uid, ready, draft, busy, error: feedback, change, advance, retry: () => setReload(value => value + 1) };
}
const OnboardingContext = createContext<ReturnType<typeof useOnboardingState> | null>(null);
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const value = useOnboardingState();
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
export function useOnboarding() {
  const value = useContext(OnboardingContext);
  if (!value) throw Error("Onboarding provider missing");
  return value;
}
