import AsyncStorage from "@react-native-async-storage/async-storage";
import { mutateSleepJournal } from "./sleepJournal";
import { commitManualSleep, deriveSleepDays, emptySleepEntry, sleepDateKey, validateSleepHours } from "./sleepSessionModel";
import { providerSleepEntry, readAllSleepPages, reconcileHealthSleep, type ProviderSleepRecord } from "./healthSleepImport";
import { Linking, Platform } from "react-native";
import { applicationId } from "expo-application";
import { collection, doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import {
  SdkAvailabilityStatus,
  SLEEP_PROFILE_FIELDS,
  USER_SLEEP_PROFILE_FIELD,
  USERS_COLLECTION,
  type SleepNightlySummary,
  type SleepProfile,
  type SleepSource,
} from "../contracts";
import type { Permission } from "react-native-health-connect";
import { hasHealthSyncConsent } from "../health/healthSyncConsent";
import { confirmAppDialog } from "../ui/appDialog";

const DEFAULT_SLEEP_SOURCE: SleepSource = "manual";
export const HEALTH_SLEEP_STALE_HOURS = 36;
const SLEEP_HISTORY_DAYS = 30;

type HealthConnectModule = typeof import("react-native-health-connect");

export type HealthConnectAvailability =
  | "available"
  | "provider_update_required"
  | "unavailable"
  | "unsupported";

export type SleepSyncResult =
  | { status: "success"; sleepHours: number; sampleRecordedAt: Timestamp }
  | { status: "permission_denied" }
  | { status: "no_data" }
  | { status: "provider_update_required" }
  | { status: "unavailable" }
  | { status: "unsupported" }
  | { status: "error"; message: string };

export type AutoSleepSyncResult = "synced" | "skipped" | "failed";

const sleepReadPermission: Permission = {
  accessType: "read",
  recordType: "SleepSession",
};

const loadHealthConnect = async (): Promise<HealthConnectModule> =>
  import("react-native-health-connect");



const normalizeSleepHours = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 24) return null;
  return Math.round(value * 10) / 10;
};

const normalizeSource = (value: unknown): SleepSource =>
  value === "health" ? "health" : DEFAULT_SLEEP_SOURCE;

const normalizeTimestamp = (value: unknown): Timestamp | null =>
  value instanceof Timestamp ? value : null;
const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const normalizeRecentNightlyHours = (value: unknown): SleepNightlySummary[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Record<string, unknown>;
      const sleepHours = normalizeSleepHours(row?.sleepHours);
      const dateKey = row?.dateKey;
      if (sleepHours == null || !isDateKey(dateKey)) return null;
      return {
        dateKey,
        sleepHours,
        source: normalizeSource(row?.source),
        recordedAt: normalizeTimestamp(row?.recordedAt),
      } satisfies SleepNightlySummary;
    })
    .filter((item): item is SleepNightlySummary => item != null)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, SLEEP_HISTORY_DAYS);
};



export const buildSleepProfile = (
  latestSleepHours: number | null,
  source: SleepSource,
  sampleRecordedAt: Timestamp | null,
  lastSyncedAt: Timestamp | null,
  recentNightlyHours: SleepNightlySummary[],
  originAppPackage: string | null,
  originLabel: string | null
): SleepProfile => ({
  latestSleepHours,
  source,
  sampleRecordedAt,
  lastSyncedAt,
  recentNightlyHours,
  originAppPackage,
  originLabel,
});

export const getSleepProfile = async (uid: string): Promise<SleepProfile> => {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  const data = snapshot.data()?.[USER_SLEEP_PROFILE_FIELD] as Record<string, unknown> | undefined;
  const summary = data?.journalSummary && typeof data.journalSummary === "object" ? data.journalSummary as Record<string, unknown> : data;

  return buildSleepProfile(
    normalizeSleepHours(summary?.[SLEEP_PROFILE_FIELDS.latestSleepHours]),
    normalizeSource(summary?.[SLEEP_PROFILE_FIELDS.source]),
    normalizeTimestamp(summary?.[SLEEP_PROFILE_FIELDS.sampleRecordedAt]),
    normalizeTimestamp(data?.[SLEEP_PROFILE_FIELDS.lastSyncedAt]),
    normalizeRecentNightlyHours(summary?.[SLEEP_PROFILE_FIELDS.recentNightlyHours]),
    normalizeString(data?.[SLEEP_PROFILE_FIELDS.originAppPackage]),
    normalizeString(data?.[SLEEP_PROFILE_FIELDS.originLabel])
  );
};

export const getHealthConnectAvailability = async (): Promise<HealthConnectAvailability> => {
  if (Platform.OS !== "android") return "unsupported";
  if (Number(Platform.Version) < 28) return "unsupported";
  const healthConnect = await loadHealthConnect();
  const sdkStatus = await healthConnect.getSdkStatus();

  if (sdkStatus === SdkAvailabilityStatus.SDK_AVAILABLE) return "available";
  if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return "provider_update_required";
  }
  return "unavailable";
};

export const hasHealthSleepPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  const availability = await getHealthConnectAvailability();
  if (availability !== "available") return false;

  const healthConnect = await loadHealthConnect();
  await healthConnect.initialize();
  const granted = await healthConnect.getGrantedPermissions();
  return granted.some(
    (item) =>
      item.accessType === sleepReadPermission.accessType &&
      item.recordType === sleepReadPermission.recordType
  );
};

export const requestHealthSleepPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  const availability = await getHealthConnectAvailability();
  if (availability !== "available") return false;

  const healthConnect = await loadHealthConnect();
  await healthConnect.initialize();
  const granted = await healthConnect.requestPermission([sleepReadPermission]);
  return granted.some(
    (item) =>
      item.accessType === sleepReadPermission.accessType &&
      item.recordType === sleepReadPermission.recordType
  );
};

export const openHealthConnectDataManagementScreen = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  try {
    const availability = await getHealthConnectAvailability();
    if (availability !== "available" && availability !== "provider_update_required") {
      return false;
    }
    const healthConnect = await loadHealthConnect();
    healthConnect.openHealthConnectDataManagement();
    return true;
  } catch {
    return false;
  }
};

export const openHealthConnectAppPermissionsScreen = async (): Promise<boolean | null> => {
  if (Platform.OS !== "android") return false;
  try {
    const availability = await getHealthConnectAvailability();
    if (availability !== "available" && availability !== "provider_update_required") {
      return false;
    }
    // Manage-data takes a provider package, not the app whose permissions to edit.
    if (Number(Platform.Version) >= 34 && applicationId) {
      try {
        await Linking.sendIntent("android.health.connect.action.MANAGE_HEALTH_PERMISSIONS", [
          { key: "android.intent.extra.PACKAGE_NAME", value: applicationId },
        ]);
        return true;
      } catch {
        // Some providers restrict this activity to system callers. The ordinary
        // settings action remains available to third-party apps.
      }
    }
    return await openHealthConnectSettingsScreen();
  } catch {
    return false;
  }
};

/** Separate fallback: opens Health Connect home, not app-specific management. */
export const openHealthConnectSettingsScreen = async (): Promise<boolean | null> => {
  if (Platform.OS !== "android") return false;
  try {
    const availability = await getHealthConnectAvailability();
    if (availability !== "available" && availability !== "provider_update_required") return false;
    const confirmed = await confirmAppDialog(
      "Health Connect permissions",
      "On the next screen, choose App permissions → Lastrep, then allow the data you want to sync.",
      "Open Health Connect",
    );
    if (!confirmed) return null;
    await Linking.sendIntent(Number(Platform.Version) >= 34
      ? "android.health.connect.action.HEALTH_HOME_SETTINGS"
      : "androidx.health.ACTION_HEALTH_CONNECT_SETTINGS");
    return true;
  } catch {
    return false;
  }
};

const syncInFlight = new Map<string, Promise<SleepSyncResult>>();
export const syncSleepFromHealthConnect = (uid: string, now = new Date()): Promise<SleepSyncResult> => {
  const pending = syncInFlight.get(uid);
  if (pending) return pending;
  const task = importHealthSleep(uid, now).finally(() => syncInFlight.delete(uid));
  syncInFlight.set(uid, task);
  return task;
};
async function importHealthSleep(uid: string, now: Date): Promise<SleepSyncResult> {
  if (Platform.OS !== "android") return { status: "unsupported" };
  try {
    if (!(await hasHealthSyncConsent(uid))) return { status: "permission_denied" };
    const availability = await getHealthConnectAvailability();
    if (availability === "provider_update_required") return { status: "provider_update_required" };
    if (availability !== "available") return { status: "unavailable" };
    if (!(await hasHealthSleepPermission())) return { status: "permission_denied" };
    const health = await loadHealthConnect();
    await health.initialize();
    const deviceKey = "sleep-import-device-v1";
    let device = await AsyncStorage.getItem(deviceKey);
    if (!device) { device = doc(collection(db, "_ids")).id; await AsyncStorage.setItem(deviceKey, device); }
    const tokenKey = "sleep-changes-v1:" + uid + ":" + device;
    let token = await AsyncStorage.getItem(tokenKey);
    const authorize = async () => {
      if (!(await hasHealthSyncConsent(uid)) || !(await hasHealthSleepPermission())) throw Error("Sleep access was removed. No data was imported.");
    };
    // Establish a change cursor BEFORE the full read; replay is idempotent by provider identity.
    let changes = await health.getChanges(token ? { changesToken: token } : { recordTypes: ["SleepSession"] });
    const fullRead = !token || changes.changesTokenExpired;
    if (changes.changesTokenExpired) { changes = await health.getChanges({ recordTypes: ["SleepSession"] }); token = null; }
    const start = new Date(now); start.setDate(start.getDate() - SLEEP_HISTORY_DAYS); start.setHours(0, 0, 0, 0);
    const records: ProviderSleepRecord[] = [];
    if (fullRead) records.push(...await readAllSleepPages(async (pageToken) => {
      await authorize();
      return health.readRecords("SleepSession", { timeRangeFilter: { operator: "between", startTime: start.toISOString(), endTime: now.toISOString() }, ascendingOrder: false, ...(pageToken ? { pageToken } : {}) });
    }));
    const deleted: string[] = [], seenTokens = new Set<string>();
    while (true) {
      if (changes.changesTokenExpired) throw Error("Health Connect history changed during sync. Please retry.");
      for (const item of changes.upsertionChanges) {
        if ("startTime" in item.record && "endTime" in item.record) records.push(item.record as ProviderSleepRecord);
      }
      deleted.push(...changes.deletionChanges.map((item) => item.recordId));
      token = changes.nextChangesToken;
      if (!changes.hasMore) break;
      if (seenTokens.has(token)) throw Error("Health Connect repeated a changes page. Please retry.");
      seenTokens.add(token); await authorize(); changes = await health.getChanges({ changesToken: token });
    }
    const incoming = [...new Map(records.filter((record) => Date.parse(record.endTime) <= now.getTime() && Date.parse(record.endTime) >= start.getTime()).map((record) => {
      const row = providerSleepEntry(record, device!); return [row.id, row] as const;
    })).values()];
    // Upserts followed by deletion in one feed must finish deleted.
    const imported = incoming.filter((entry) => !deleted.includes(entry.providerId!));
    const previous = await getSleepProfile(uid);
    const origin = previous.originAppPackage ?? imported[0]?.origin ?? null;
    const next = await mutateSleepJournal(uid, (entries) => reconcileHealthSleep(entries, imported, deleted, device!, fullRead ? { start: start.getTime(), end: now.getTime() } : undefined), { syncedAt: now, origin, authorize });
    await AsyncStorage.setItem(tokenKey, token!);
    await AsyncStorage.setItem(`sleep-last-check:${uid}`, now.toISOString());
    const latest = deriveSleepDays(next, origin).days[0];
    if (!incoming.length && !deleted.length) return { status: "no_data" };
    if (!latest) return { status: "no_data" };
    return { status: "success", sleepHours: latest.hours, sampleRecordedAt: Timestamp.fromMillis(latest.recordedAtMs ?? now.getTime()) };
  } catch (error) {
    return { status: "error", message: (error as Error)?.message ?? "Could not sync sleep. Saved records are unchanged." };
  }
}

export const autoSyncSleepFromHealthConnectIfEligible = async (
  uid: string,
  options?: { minIntervalMinutes?: number }
): Promise<AutoSleepSyncResult> => {
  if (Platform.OS !== "android") return "skipped";

  try {
    if (!(await hasHealthSyncConsent(uid))) return "skipped";

    const availability = await getHealthConnectAvailability();
    if (availability !== "available") return "skipped";

    const hasPermission = await hasHealthSleepPermission();
    if (!hasPermission) return "skipped";

    const minIntervalMinutes = options?.minIntervalMinutes ?? 30;
    const savedCheck = await AsyncStorage.getItem(`sleep-last-check:${uid}`);
    const lastSyncedAt = savedCheck ? new Date(savedCheck) : null;
    if (lastSyncedAt) {
      const minutesSinceLastSync = (Date.now() - lastSyncedAt.getTime()) / (60 * 1000);
      if (minutesSinceLastSync < minIntervalMinutes) return "skipped";
    }

    const syncResult = await syncSleepFromHealthConnect(uid);
    return syncResult.status === "success" ? "synced" : "skipped";
  } catch {
    return "failed";
  }
};

export const saveManualSleepSample = async (uid: string, hours: number, now = new Date()): Promise<void> => {
  await saveManualSleepForDateKey(uid, hours, sleepDateKey(now), now);
};
export const saveManualSleepForDateKey = async (uid: string, hours: number, dateKey: string, now = new Date()): Promise<void> => {
  validateSleepHours(String(hours));
  const entry = emptySleepEntry(doc(collection(db, "_ids")).id, dateKey, hours, now);
  await mutateSleepJournal(uid, (entries) => commitManualSleep(entries, entry, null));
};

export const getSleepSampleAgeHours = (
  sampleRecordedAt: Timestamp | null,
  now = new Date()
): number | null => {
  if (!sampleRecordedAt) return null;
  const diffMs = now.getTime() - sampleRecordedAt.toDate().getTime();
  if (diffMs < 0) return 0;
  return Math.round((diffMs / (60 * 60 * 1000)) * 10) / 10;
};

export const isHealthSleepStale = (profile: SleepProfile, now = new Date()): boolean => {
  if (profile.source !== "health") return false;
  const age = getSleepSampleAgeHours(profile.sampleRecordedAt, now);
  if (age == null) return true;
  return age > HEALTH_SLEEP_STALE_HOURS;
};
