import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { initialProgress, onboardingDestination, onboardingKey, parseCache, parseDraft, parseProgress, stepSubmission, type OnboardingCache, type OnboardingDraft, type OnboardingStep } from "./onboardingState";

export async function resolveOnboardingDestination(uid: string, data?: Record<string, unknown> | null) {
  const cache = await AsyncStorage.getItem(onboardingKey(uid)).then(parseCache).catch(() => null);
  // Account-local checkpoints keep cold starts usable without a network round trip.
  if (data === undefined && cache) return onboardingDestination(null, cache);
  const account = data === undefined ? await getDoc(doc(db, "users", uid)).then(snapshot => snapshot.data() ?? null).catch(() => null) : data;
  return onboardingDestination(account, cache);
}
export async function createOnboardingUser(uid: string, defaults: Record<string, unknown>) {
  const saved = await runTransaction(db, async transaction => {
    if (auth.currentUser?.uid !== uid) throw Error("Account changed");
    const ref = doc(db, "users", uid);
    const existing = await transaction.get(ref);
    if (auth.currentUser?.uid !== uid) throw Error("Account changed");
    // Retry after a partial registration must never reset saved profile/progress.
    const data = existing.exists() ? existing.data()! : { ...defaults, onboarding: initialProgress };
    if (!existing.exists()) transaction.set(ref, data);
    return { progress: parseProgress(data.onboarding) ?? { ...initialProgress, completed: true }, draft: parseDraft(data) };
  });
  // The server checkpoint is authoritative even if device storage is unavailable.
  await AsyncStorage.setItem(onboardingKey(uid), JSON.stringify(saved)).catch(() => undefined);
  return onboardingDestination({ onboarding: saved.progress }, saved);
}
export async function loadOnboardingCache(uid: string): Promise<OnboardingCache> {
  const local = await AsyncStorage.getItem(onboardingKey(uid)).then(parseCache).catch(() => null);
  if (local) return local;
  const snapshot = await getDoc(doc(db, "users", uid));
  const data = snapshot.data();
  return { progress: parseProgress(data?.onboarding) ?? initialProgress, draft: parseDraft(data) };
}
export async function saveOnboardingStep(uid: string, step: OnboardingStep, draft: OnboardingDraft, skip: boolean) {
  const submission = stepSubmission(step, draft, skip);
  const alreadyComplete = await runTransaction(db, async transaction => {
    if (auth.currentUser?.uid !== uid) throw Error("Account changed");
    const ref = doc(db, "users", uid);
    const snapshot = await transaction.get(ref);
    if (auth.currentUser?.uid !== uid) throw Error("Account changed");
    if (parseProgress(snapshot.data()?.onboarding)?.completed) return true;
    transaction.set(ref, submission.fields, { merge: true });
    return false;
  }, { maxAttempts: 3 });
  return alreadyComplete ? { ...submission, progress: { ...submission.progress, completed: true }, destination: "/(tabs)/home" as const } : submission;
}
