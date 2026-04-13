import { Platform } from "react-native";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
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

const DEFAULT_SLEEP_SOURCE: SleepSource = "manual";
export const HEALTH_SLEEP_STALE_HOURS = 36;

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

const asIso = (date: Date) => date.toISOString();

const getSleepWindow = (now = new Date()) => {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);

  const end = new Date(now);
  end.setHours(Math.min(now.getHours(), 12), now.getMinutes(), 0, 0);
  if (end <= start) {
    end.setTime(now.getTime());
  }

  return { start, end };
};

const getOverlapMs = (aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number) => {
  const start = Math.max(aStartMs, bStartMs);
  const end = Math.min(aEndMs, bEndMs);
  return Math.max(0, end - start);
};

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
    .slice(0, 7);
};

const roundSleepHours = (value: number) => Math.round(value * 10) / 10;
const inferOriginLabel = (originAppPackage: string | null): string | null => {
  if (!originAppPackage) return null;
  if (originAppPackage.includes("shealth")) return "Samsung Health / Galaxy Watch";
  if (originAppPackage.includes("google.android.apps.fitness")) return "Google Fit";
  return "Health Connect";
};

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const upsertRecentNightlySummary = (
  summaries: SleepNightlySummary[],
  next: SleepNightlySummary
): SleepNightlySummary[] => {
  const map = new Map<string, SleepNightlySummary>();
  for (const item of summaries) {
    map.set(item.dateKey, item);
  }
  map.set(next.dateKey, next);
  return Array.from(map.values())
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 7);
};

const getRecentHealthNightlySummaries = async (
  healthConnect: HealthConnectModule,
  now: Date
): Promise<SleepNightlySummary[]> => {
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const records = await healthConnect.readRecords("SleepSession", {
    timeRangeFilter: {
      operator: "between",
      startTime: asIso(start),
      endTime: asIso(now),
    },
    ascendingOrder: false,
  });

  const grouped = new Map<string, { totalMs: number; latestEndMs: number }>();
  for (const record of records.records) {
    const startMs = new Date(record.startTime).getTime();
    const endMs = new Date(record.endTime).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const dateKey = formatDateKey(new Date(endMs));
    const existing = grouped.get(dateKey);
    const totalMs = (existing?.totalMs ?? 0) + (endMs - startMs);
    const latestEndMs = Math.max(existing?.latestEndMs ?? 0, endMs);
    grouped.set(dateKey, { totalMs, latestEndMs });
  }

  return Array.from(grouped.entries())
    .map(([dateKey, row]) => ({
      dateKey,
      sleepHours: roundSleepHours(row.totalMs / (60 * 60 * 1000)),
      source: "health" as const,
      recordedAt: Timestamp.fromMillis(row.latestEndMs),
    }))
    .filter((row) => row.sleepHours > 0)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 7);
};

const saveHealthSleepSample = async (
  uid: string,
  sleepHours: number,
  sampleRecordedAt: Timestamp,
  syncedAt: Timestamp,
  recentNightlyHours: SleepNightlySummary[],
  originAppPackage: string | null
) => {
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      [USER_SLEEP_PROFILE_FIELD]: {
        [SLEEP_PROFILE_FIELDS.latestSleepHours]: sleepHours,
        [SLEEP_PROFILE_FIELDS.source]: "health",
        [SLEEP_PROFILE_FIELDS.sampleRecordedAt]: sampleRecordedAt,
        [SLEEP_PROFILE_FIELDS.lastSyncedAt]: syncedAt,
        [SLEEP_PROFILE_FIELDS.recentNightlyHours]: recentNightlyHours,
        [SLEEP_PROFILE_FIELDS.originAppPackage]: originAppPackage,
        [SLEEP_PROFILE_FIELDS.originLabel]: inferOriginLabel(originAppPackage),
      },
    },
    { merge: true }
  );
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

  return buildSleepProfile(
    normalizeSleepHours(data?.[SLEEP_PROFILE_FIELDS.latestSleepHours]),
    normalizeSource(data?.[SLEEP_PROFILE_FIELDS.source]),
    normalizeTimestamp(data?.[SLEEP_PROFILE_FIELDS.sampleRecordedAt]),
    normalizeTimestamp(data?.[SLEEP_PROFILE_FIELDS.lastSyncedAt]),
    normalizeRecentNightlyHours(data?.[SLEEP_PROFILE_FIELDS.recentNightlyHours]),
    normalizeString(data?.[SLEEP_PROFILE_FIELDS.originAppPackage]),
    normalizeString(data?.[SLEEP_PROFILE_FIELDS.originLabel])
  );
};

export const getHealthConnectAvailability = async (): Promise<HealthConnectAvailability> => {
  if (Platform.OS !== "android") return "unsupported";
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

export const syncSleepFromHealthConnect = async (
  uid: string,
  now = new Date()
): Promise<SleepSyncResult> => {
  if (Platform.OS !== "android") return { status: "unsupported" };

  try {
    const availability = await getHealthConnectAvailability();
    if (availability === "provider_update_required") return { status: "provider_update_required" };
    if (availability !== "available") return { status: "unavailable" };

    const healthConnect = await loadHealthConnect();
    await healthConnect.initialize();
    const hasPermission = await hasHealthSleepPermission();
    if (!hasPermission) return { status: "permission_denied" };

    const { start, end } = getSleepWindow(now);
    const records = await healthConnect.readRecords("SleepSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: asIso(start),
        endTime: asIso(end),
      },
      ascendingOrder: false,
    });

    if (!records.records.length) {
      console.log("[sleep_sync]", {
        event: "no_data",
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
      });
      return { status: "no_data" };
    }

    const startMs = start.getTime();
    const endMs = end.getTime();
    let totalSleepMs = 0;
    let latestRecordEndMs: number | null = null;
    let latestRecordOriginPackage: string | null = null;

    for (const record of records.records) {
      const recordStartMs = new Date(record.startTime).getTime();
      const recordEndMs = new Date(record.endTime).getTime();
      totalSleepMs += getOverlapMs(recordStartMs, recordEndMs, startMs, endMs);
      if (latestRecordEndMs == null || recordEndMs > latestRecordEndMs) {
        latestRecordEndMs = recordEndMs;
        latestRecordOriginPackage = normalizeString(
          (record as { metadata?: { dataOrigin?: string } }).metadata?.dataOrigin
        );
      }
    }

    if (totalSleepMs <= 0 || latestRecordEndMs == null) {
      return { status: "no_data" };
    }

    const sleepHours = roundSleepHours(totalSleepMs / (60 * 60 * 1000));
    const sampleRecordedAt = Timestamp.fromMillis(latestRecordEndMs);
    const syncedAt = Timestamp.fromDate(now);
    const recentNightlyHours = await getRecentHealthNightlySummaries(healthConnect, now);

    await saveHealthSleepSample(
      uid,
      sleepHours,
      sampleRecordedAt,
      syncedAt,
      recentNightlyHours,
      latestRecordOriginPackage
    );

    console.log("[sleep_sync]", {
      event: "sync_success",
      source: "health",
      sleepHours,
      sampleRecordedAt: sampleRecordedAt.toDate().toISOString(),
      syncedAt: syncedAt.toDate().toISOString(),
      recordCount: records.records.length,
    });

    return {
      status: "success",
      sleepHours,
      sampleRecordedAt,
    };
  } catch (error) {
    const message = (error as { message?: string })?.message ?? "Failed to sync sleep data.";
    console.log("[sleep_sync]", {
      event: "sync_error",
      message,
    });
    return { status: "error", message };
  }
};

export const autoSyncSleepFromHealthConnectIfEligible = async (
  uid: string,
  options?: { minIntervalMinutes?: number }
): Promise<AutoSleepSyncResult> => {
  if (Platform.OS !== "android") return "skipped";

  try {
    const availability = await getHealthConnectAvailability();
    if (availability !== "available") return "skipped";

    const hasPermission = await hasHealthSleepPermission();
    if (!hasPermission) return "skipped";

    const profile = await getSleepProfile(uid);
    const minIntervalMinutes = options?.minIntervalMinutes ?? 30;
    const lastSyncedAt = profile.lastSyncedAt?.toDate() ?? null;
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

export const saveManualSleepSample = async (
  uid: string,
  sleepHours: number,
  now = new Date()
): Promise<void> => {
  const dateKey = formatDateKey(now);
  await saveManualSleepForDateKey(uid, sleepHours, dateKey, now);
};

export const saveManualSleepForDateKey = async (
  uid: string,
  sleepHours: number,
  dateKey: string,
  now = new Date()
): Promise<void> => {
  const nowTimestamp = Timestamp.fromDate(now);
  const roundedHours = roundSleepHours(sleepHours);
  const profile = await getSleepProfile(uid);
  const manualSummary: SleepNightlySummary = {
    dateKey,
    sleepHours: roundedHours,
    source: "manual",
    recordedAt: nowTimestamp,
  };
  const recentNightlyHours = upsertRecentNightlySummary(profile.recentNightlyHours, manualSummary);
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      [USER_SLEEP_PROFILE_FIELD]: {
        [SLEEP_PROFILE_FIELDS.latestSleepHours]: roundedHours,
        [SLEEP_PROFILE_FIELDS.source]: "manual",
        [SLEEP_PROFILE_FIELDS.sampleRecordedAt]: nowTimestamp,
        [SLEEP_PROFILE_FIELDS.lastSyncedAt]: nowTimestamp,
        [SLEEP_PROFILE_FIELDS.recentNightlyHours]: recentNightlyHours,
        [SLEEP_PROFILE_FIELDS.originAppPackage]: null,
        [SLEEP_PROFILE_FIELDS.originLabel]: null,
      },
    },
    { merge: true }
  );
  console.log("[sleep_sync]", {
    event: "manual_override_set",
    dateKey,
    sleepHours: roundedHours,
    source: "manual",
  });
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
