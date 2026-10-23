import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { doc, getDocFromCache, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { getHealthConnectAvailability } from "../sleep/sleep";
import { hasHealthSyncConsent, hasStepsSyncConsent } from "./healthSyncConsent";
import { isCurrentSteps, localStepsWindow, parseDailySteps, type DailyStepsSnapshot } from "./dailyStepsModel";

export type StepsStatus = "loading" | "ready" | "permission" | "disconnected" | "unavailable" | "offline" | "error";
export type DailyStepsState = { status: StepsStatus; snapshot: DailyStepsSnapshot | null; saveError: boolean };
const empty: DailyStepsState = { status: "loading", snapshot: null, saveError: false };
const states = new Map<string, DailyStepsState>();
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<DailyStepsState>>();
const hydrated = new Set<string>();
const deletedAccounts = new Set<string>();
const key = (uid: string) => `dailyStepsSnapshot:v1:${uid}`;
export const getDailyStepsState = (uid: string | null) => uid ? states.get(uid) ?? empty : empty;
export const subscribeDailySteps = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const publish = (uid: string, patch: Partial<DailyStepsState>) => {
  const next = { ...getDailyStepsState(uid), ...patch }; states.set(uid, next); listeners.forEach(listener => listener()); return next;
};
export function seedDailySteps(uid: string, raw: unknown) {
  const snapshot = parseDailySteps(raw), previous = getDailyStepsState(uid).snapshot;
  if (!deletedAccounts.has(uid) && auth.currentUser?.uid === uid && snapshot && (!previous || snapshot.asOfMs > previous.asOfMs)) publish(uid, { snapshot });
}
/** Called after successful server-side account deletion, not on sign-out. */
export async function clearDailySteps(uid: string) {
  deletedAccounts.add(uid);
  states.delete(uid);
  hydrated.delete(uid);
  listeners.forEach(listener => listener());
  await AsyncStorage.removeItem(key(uid));
}
export async function hasStepsPermission() {
  if (Platform.OS !== "android" || await getHealthConnectAvailability() !== "available") return false;
  const hc = await import("react-native-health-connect"); await hc.initialize();
  return (await hc.getGrantedPermissions()).some(p => p.accessType === "read" && p.recordType === "Steps");
}
async function authorized(uid: string) {
  return !deletedAccounts.has(uid) && auth.currentUser?.uid === uid && await hasHealthSyncConsent(uid) && await hasStepsSyncConsent(uid) && auth.currentUser?.uid === uid && !deletedAccounts.has(uid);
}
async function run(uid: string, online: boolean, force: boolean): Promise<DailyStepsState> {
  if (deletedAccounts.has(uid) || auth.currentUser?.uid !== uid) return empty;
  if (!hydrated.has(uid)) {
    hydrated.add(uid);
    try { seedDailySteps(uid, JSON.parse(await AsyncStorage.getItem(key(uid)) ?? "null")); } catch { /* Use the account cache if available. */ }
    try { seedDailySteps(uid, (await getDocFromCache(doc(db, "users", uid))).data()?.dailySteps); } catch { /* No cached account document yet. */ }
  }
  if (!await authorized(uid)) return publish(uid, { status: "disconnected" });
  if (Platform.OS !== "android" || await getHealthConnectAvailability() !== "available") return publish(uid, { status: "unavailable" });
  if (!await hasStepsPermission()) return publish(uid, { status: "permission" });
  if (!online) return publish(uid, { status: "offline" });
  if (AppState.currentState !== "active") return getDailyStepsState(uid);
  const previous = getDailyStepsState(uid);
  const snapshotAge = previous.snapshot ? Date.now() - previous.snapshot.asOfMs : Infinity;
  if (!force && previous.snapshot && isCurrentSteps(previous.snapshot) && snapshotAge >= 0 && snapshotAge < 60_000 && !previous.saveError) return publish(uid, { status: "ready" });
  const window = localStepsWindow();
  const hc = await import("react-native-health-connect");
  if (AppState.currentState !== "active" || !await authorized(uid)) return getDailyStepsState(uid);
  let steps: number | null = null;
  if (window.startTime !== window.endTime) {
    const request = { timeRangeFilter: { operator: "between" as const, startTime: window.startTime, endTime: window.endTime } };
    const aggregate = await hc.aggregateRecord({ recordType: "Steps", ...request });
    const count = aggregate.COUNT_TOTAL;
    if (!Number.isSafeInteger(count) || count < 0 || count > 1_000_000) throw new Error("Invalid step aggregate");
    // The library converts an absent aggregate to zero. Check existence only;
    // never sum raw records, which would double-count overlapping sources.
    steps = count;
    if (count === 0 && !aggregate.dataOrigins.length) {
      const result = await hc.readRecords("Steps", { ...request, pageSize: 1 });
      if (!result.records.length) steps = null;
    }
  }
  if (!await authorized(uid)) return publish(uid, { status: "disconnected" });
  if (!await hasStepsPermission()) return publish(uid, { status: "permission" });
  if (AppState.currentState !== "active") return getDailyStepsState(uid);
  const current = localStepsWindow();
  if (window.dateKey !== current.dateKey || window.timeZone !== current.timeZone) return getDailyStepsState(uid);
  const snapshot: DailyStepsSnapshot = { dateKey: window.dateKey, timeZone: window.timeZone, steps, asOfMs: Date.now() };
  await AsyncStorage.setItem(key(uid), JSON.stringify(snapshot));
  if (!await authorized(uid)) return publish(uid, { status: "disconnected" });
  if (AppState.currentState !== "active") return getDailyStepsState(uid);
  const state = publish(uid, { status: "ready", snapshot, saveError: false });
  // Keep the local read usable during a mid-save connection loss. Firestore
  // queues the account-scoped replacement; later reads replace, never add to it.
  void setDoc(doc(db, "users", uid), { dailySteps: snapshot }, { merge: true }).catch(() => {
    if (getDailyStepsState(uid).snapshot?.asOfMs === snapshot.asOfMs) publish(uid, { saveError: true });
  });
  return state;
}
export function refreshDailySteps(uid: string, online: boolean, force = false) {
  const pending = inflight.get(uid);
  if (pending) return pending;
  const request = run(uid, online, force).catch(() => publish(uid, { status: "error" })).finally(() => { inflight.delete(uid); });
  inflight.set(uid, request); return request;
}
