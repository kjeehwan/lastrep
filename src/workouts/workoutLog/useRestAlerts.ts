import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { confirmAppDialog } from "../../ui/appDialog";
import { auth } from "../../config/firebaseConfig";
import { restAlertsNative, type RestAlertsStatus } from "./restAlertsNative";
import { restAlertsPlan, shouldPlayForegroundRest } from "./restAlertsPlan";
import type { RestClock } from "./timerClock";

const PROMPT_KEY = "workout-rest-alerts-prompted-v1";
let permissionRequest: Promise<boolean> | null = null;

async function enableAlerts(force: boolean): Promise<boolean> {
  const native = restAlertsNative;
  if (!native) return false;
  let status = await native.status();
  if (status.exact && status.notifications) return true;
  if (!force && await AsyncStorage.getItem(PROMPT_KEY)) return false;
  await AsyncStorage.setItem(PROMPT_KEY, "1");
  const accepted = await confirmAppDialog("Rest timer alerts", "Allow notifications and Alarms & reminders so rest alerts can sound while another app is open or your phone is locked. Alerts follow your notification sound settings.", "Enable alerts");
  if (!accepted) return false;
  if (!status.notifications) {
    if (Number(Platform.Version) >= 33 && !await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    status = await native.status();
    if (!status.notifications) { await native.openNotificationSettings(); return false; }
  }
  if (!status.exact) { await native.openExactSettings(); return false; }
  return true;
}

export function useRestAlerts(uid: string | null, hydrated: boolean, clocks: Record<string, RestClock>, exercises: { id: string; name: string }[], playGong: () => Promise<void>) {
  const [status, setStatus] = useState<RestAlertsStatus>({ exact: false, notifications: false });
  const entries = JSON.stringify(restAlertsPlan(clocks, exercises));
  const alive = useRef(true);
  const revision = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const sync = useCallback(async () => {
    if (!restAlertsNative || !uid || !hydrated || auth.currentUser?.uid !== uid) return;
    const expectedRevision = revision.current;
    try {
      await restAlertsNative.setOwner(uid);
      if (auth.currentUser?.uid !== uid || expectedRevision !== revision.current) return;
      await restAlertsNative.sync(uid, entries);
      const next = await restAlertsNative.status();
      if (alive.current) setStatus(next);
    } catch { console.warn("Could not schedule rest alerts"); }
  }, [uid, hydrated, entries]);
  const latestSync = useRef(sync);
  useEffect(() => { latestSync.current = sync; }, [sync]);
  useEffect(() => { void Promise.resolve().then(sync); }, [sync]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void sync(); });
    return () => subscription.remove();
  }, [sync]);
  const request = async (force = false) => {
    if (!restAlertsNative) return;
    try {
      const before = await restAlertsNative.status();
      if (before.exact && before.notifications) return;
      if (!permissionRequest) permissionRequest = enableAlerts(force).finally(() => { permissionRequest = null; });
      await permissionRequest;
      await latestSync.current();
    } catch { console.warn("Could not enable rest alerts"); }
  };
  const complete = useCallback(async (id: string, deadline: number | undefined) => {
    if (!uid || auth.currentUser?.uid !== uid) return;
    let managed = false;
    try { if (uid && deadline != null) managed = await restAlertsNative?.finish(uid, id, deadline) ?? false; }
    catch { /* Use the foreground sound only if this completion is still timely. */ }
    if (!managed && shouldPlayForegroundRest(deadline, Date.now(), AppState.currentState === "active")) await playGong();
  }, [uid, playGong]);
  const start = (id: string, name: string, deadline: number | undefined) => {
    revision.current += 1;
    if (uid && auth.currentUser?.uid === uid && deadline != null) void restAlertsNative?.start?.(uid, id, deadline, name).catch(() => console.warn("Could not start rest alert"));
  };
  const cancel = (id: string) => {
    revision.current += 1;
    if (uid) void restAlertsNative?.cancel?.(uid, id).catch(() => console.warn("Could not cancel rest alert"));
  };
  const clear = () => { revision.current += 1; if (uid) void restAlertsNative?.clear?.(uid).catch(() => console.warn("Could not clear rest alerts")); };
  return { available: !!restAlertsNative, ready: status.exact && status.notifications, request, complete, start, cancel, clear };
}
