import { Platform } from "react-native";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import type { Permission } from "react-native-health-connect";
import { db } from "../config/firebaseConfig";
import {
  BODY_COMPOSITION_FIELDS,
  BODY_COMPOSITION_SOURCES,
  USER_BODY_COMPOSITION_FIELD,
  USERS_COLLECTION,
  type BodyCompositionHistoryEntry,
  type BodyCompositionMetricSnapshot,
  type BodyCompositionProfile,
  type BodyCompositionSource,
} from "../contracts";
import {
  getHealthConnectAvailability,
  openHealthConnectAppPermissionsScreen,
  openHealthConnectDataManagementScreen,
} from "../sleep/sleep";
import {
  hasSamsungHealthBodyCompositionPermission as hasSamsungHealthPermissionNative,
  isSamsungHealthBodyCompositionAvailable,
  readLatestSamsungHealthBodyComposition,
  requestSamsungHealthBodyCompositionPermission as requestSamsungHealthPermissionNative,
} from "./samsungHealth";

type HealthConnectModule = typeof import("react-native-health-connect");

export type BodyCompositionSyncResult =
  | { status: "success"; syncedAt: Timestamp }
  | { status: "permission_denied" }
  | { status: "no_data" }
  | { status: "provider_update_required" }
  | { status: "unavailable" }
  | { status: "unsupported" }
  | { status: "error"; message: string };
export type AutoBodyCompositionSyncResult = "synced" | "skipped" | "failed";

type BodyCompositionInput = {
  weightKg?: number | null;
  bodyFatPercent?: number | null;
  muscleMassKg?: number | null;
};

const loadHealthConnect = async (): Promise<HealthConnectModule> =>
  import("react-native-health-connect");

const bodyCompositionReadPermissions: Permission[] = [
  { accessType: "read", recordType: "Weight" },
  { accessType: "read", recordType: "BodyFat" },
  { accessType: "read", recordType: "LeanBodyMass" },
];

const HISTORY_LIMIT = 60;

const getErrorMessage = (error: unknown): string =>
  (error as { message?: string })?.message?.trim() || "";

export const getSamsungHealthAccessIssueMessage = (error: unknown): string | null => {
  const message = getErrorMessage(error);
  if (!message) return null;
  if (message.includes("Could not get policy") || message.includes("AuthorizationException: 2003")) {
    return "Samsung Health direct sync is blocked for this build. For local testing, enable Samsung Health developer mode for Data Read. For release, register the app package and SHA-256 with Samsung.";
  }
  return `Samsung Health error: ${message}`;
};

const normalizeNullableNumber = (value: unknown, max?: number): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  if (typeof max === "number" && value > max) return null;
  return Math.round(value * 10) / 10;
};

const normalizeTimestamp = (value: unknown): Timestamp | null =>
  value instanceof Timestamp ? value : null;

const normalizeSource = (value: unknown): BodyCompositionSource | null =>
  BODY_COMPOSITION_SOURCES.includes(value as BodyCompositionSource)
    ? (value as BodyCompositionSource)
    : null;

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const compareHistoryEntries = (a: BodyCompositionHistoryEntry, b: BodyCompositionHistoryEntry) => {
  const timeDiff = (b.recordedAt?.toMillis() ?? 0) - (a.recordedAt?.toMillis() ?? 0);
  if (timeDiff !== 0) return timeDiff;
  if (a.source === b.source) return 0;
  return a.source === "manual" ? -1 : 1;
};

const normalizeMetricSnapshot = (
  value: unknown,
  fallbackSource: BodyCompositionSource | null = null
): BodyCompositionMetricSnapshot => {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    weightKg: normalizeNullableNumber(row.weightKg, 500),
    bodyFatPercent: normalizeNullableNumber(row.bodyFatPercent, 100),
    muscleMassKg: normalizeNullableNumber(row.muscleMassKg, 500),
    recordedAt: normalizeTimestamp(row.recordedAt),
    source: normalizeSource(row.source) ?? fallbackSource,
    originLabel: normalizeString(row.originLabel),
  };
};

const normalizeHistory = (value: unknown): BodyCompositionHistoryEntry[] => {
  if (!Array.isArray(value)) return [];
  const history: BodyCompositionHistoryEntry[] = [];
  for (const item of value) {
    const row = item as Record<string, unknown>;
    const source = normalizeSource(row.source);
    const recordedAt = normalizeTimestamp(row.recordedAt);
    if (!source || !recordedAt) continue;
    history.push({
      recordedAt,
      source,
      originLabel: normalizeString(row.originLabel),
      weightKg: normalizeNullableNumber(row.weightKg, 500),
      bodyFatPercent: normalizeNullableNumber(row.bodyFatPercent, 100),
      muscleMassKg: normalizeNullableNumber(row.muscleMassKg, 500),
    });
  }
  return history
    .sort(compareHistoryEntries)
    .slice(0, HISTORY_LIMIT);
};

const inferOriginLabel = (originAppPackage: string | null): string | null => {
  if (!originAppPackage) return null;
  if (originAppPackage.toLowerCase().includes("inbody")) return "InBody";
  if (originAppPackage.includes("shealth")) return "Samsung Health / Galaxy Watch";
  if (originAppPackage.includes("google.android.apps.fitness")) return "Google Fit";
  return "Health Connect";
};

const resolveLatestMetricSnapshot = (
  profile: BodyCompositionProfile
): BodyCompositionMetricSnapshot => {
  const resolveFromSnapshots = (key: "weightKg" | "bodyFatPercent" | "muscleMassKg") => {
    const candidates = [profile.manual, profile.synced]
      .filter(
        (snapshot): snapshot is BodyCompositionMetricSnapshot =>
          typeof snapshot[key] === "number" && snapshot.recordedAt instanceof Timestamp
      )
      .sort((a, b) => {
        const timeDiff = b.recordedAt!.toMillis() - a.recordedAt!.toMillis();
        if (timeDiff !== 0) return timeDiff;
        if (a.source === b.source) return 0;
        return a.source === "manual" ? -1 : 1;
      });
    const latest = candidates[0];
    if (!latest) {
      return {
        value: null,
        recordedAt: null,
        source: null,
        originLabel: null,
      };
    }
    return {
      value: latest[key],
      recordedAt: latest.recordedAt,
      source: latest.source,
      originLabel: latest.originLabel,
    };
  };

  const effectiveSourceFor = (key: "weightKg" | "bodyFatPercent" | "muscleMassKg") => {
    const latestHistoryEntry = profile.history.find((entry) => typeof entry[key] === "number");
    if (latestHistoryEntry) {
      return {
        value: latestHistoryEntry[key],
        recordedAt: latestHistoryEntry.recordedAt,
        source: latestHistoryEntry.source,
        originLabel: latestHistoryEntry.originLabel,
      };
    }
    return resolveFromSnapshots(key);
  };

  const weight = effectiveSourceFor("weightKg");
  const bodyFat = effectiveSourceFor("bodyFatPercent");
  const muscle = effectiveSourceFor("muscleMassKg");
  const latestMetric =
    [weight, bodyFat, muscle]
      .filter(
        (
          value
        ): value is {
          value: number | null;
          recordedAt: Timestamp;
          source: BodyCompositionSource | null;
          originLabel: string | null;
        } => value.recordedAt instanceof Timestamp
      )
      .sort((a, b) => b.recordedAt.toMillis() - a.recordedAt.toMillis())[0] ?? null;

  return {
    weightKg: weight.value,
    bodyFatPercent: bodyFat.value,
    muscleMassKg: muscle.value,
    recordedAt: latestMetric?.recordedAt ?? null,
    source: latestMetric?.source ?? null,
    originLabel: latestMetric?.originLabel ?? null,
  };
};

const pushHistoryEntry = (
  history: BodyCompositionHistoryEntry[],
  entry: BodyCompositionHistoryEntry
): BodyCompositionHistoryEntry[] =>
  [entry, ...history]
    .sort(compareHistoryEntries)
    .slice(0, HISTORY_LIMIT);

export const buildBodyCompositionProfile = (
  manual: BodyCompositionMetricSnapshot,
  synced: BodyCompositionMetricSnapshot,
  history: BodyCompositionHistoryEntry[],
  lastSyncedAt: Timestamp | null,
  originAppPackage: string | null,
  originLabel: string | null
): BodyCompositionProfile => ({
  manual,
  synced,
  history,
  lastSyncedAt,
  originAppPackage,
  originLabel,
});

export const getBodyCompositionProfile = async (
  uid: string
): Promise<BodyCompositionProfile> => {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  const data = snapshot.data()?.[USER_BODY_COMPOSITION_FIELD] as Record<string, unknown> | undefined;
  return buildBodyCompositionProfile(
    normalizeMetricSnapshot(data?.[BODY_COMPOSITION_FIELDS.manual], "manual"),
    normalizeMetricSnapshot(data?.[BODY_COMPOSITION_FIELDS.synced], "health"),
    normalizeHistory(data?.[BODY_COMPOSITION_FIELDS.history]),
    normalizeTimestamp(data?.[BODY_COMPOSITION_FIELDS.lastSyncedAt]),
    normalizeString(data?.[BODY_COMPOSITION_FIELDS.originAppPackage]),
    normalizeString(data?.[BODY_COMPOSITION_FIELDS.originLabel])
  );
};

export const getEffectiveBodyCompositionSnapshot = (
  profile: BodyCompositionProfile
): BodyCompositionMetricSnapshot => resolveLatestMetricSnapshot(profile);

export const saveManualBodyCompositionEntry = async (
  uid: string,
  input: BodyCompositionInput,
  now = new Date()
): Promise<void> => {
  const profile = await getBodyCompositionProfile(uid);
  const recordedAt = Timestamp.fromDate(now);
  const nextManual: BodyCompositionMetricSnapshot = {
    weightKg:
      typeof input.weightKg === "number" ? normalizeNullableNumber(input.weightKg, 500) : profile.manual.weightKg,
    bodyFatPercent:
      typeof input.bodyFatPercent === "number"
        ? normalizeNullableNumber(input.bodyFatPercent, 100)
        : profile.manual.bodyFatPercent,
    muscleMassKg:
      typeof input.muscleMassKg === "number"
        ? normalizeNullableNumber(input.muscleMassKg, 500)
        : profile.manual.muscleMassKg,
    recordedAt,
    source: "manual",
    originLabel: null,
  };
  const historyEntry: BodyCompositionHistoryEntry = {
    recordedAt,
    source: "manual",
    originLabel: null,
    weightKg: nextManual.weightKg,
    bodyFatPercent: nextManual.bodyFatPercent,
    muscleMassKg: nextManual.muscleMassKg,
  };

  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      [USER_BODY_COMPOSITION_FIELD]: {
        [BODY_COMPOSITION_FIELDS.manual]: nextManual,
        [BODY_COMPOSITION_FIELDS.history]: pushHistoryEntry(profile.history, historyEntry),
      },
    },
    { merge: true }
  );
};

export const hasHealthBodyCompositionPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  const availability = await getHealthConnectAvailability();
  if (availability !== "available") return false;
  const healthConnect = await loadHealthConnect();
  await healthConnect.initialize();
  const granted = await healthConnect.getGrantedPermissions();
  return bodyCompositionReadPermissions.every((permission) =>
    granted.some(
      (item) =>
        item.accessType === permission.accessType &&
        item.recordType === permission.recordType
    )
  );
};

export const requestHealthBodyCompositionPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  const availability = await getHealthConnectAvailability();
  if (availability !== "available") return false;
  const healthConnect = await loadHealthConnect();
  await healthConnect.initialize();
  const granted = await healthConnect.requestPermission(bodyCompositionReadPermissions);
  return bodyCompositionReadPermissions.every((permission) =>
    granted.some(
      (item) =>
        item.accessType === permission.accessType &&
        item.recordType === permission.recordType
    )
  );
};

export const hasSamsungHealthBodyCompositionPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  const available = await isSamsungHealthBodyCompositionAvailable();
  if (!available) return false;
  return hasSamsungHealthPermissionNative();
};

export const requestSamsungHealthBodyCompositionPermission = async (): Promise<boolean> => {
  if (Platform.OS !== "android") return false;
  const available = await isSamsungHealthBodyCompositionAvailable();
  if (!available) return false;
  return requestSamsungHealthPermissionNative();
};

type HealthMetricResult = {
  value: number | null;
  recordedAtMs: number | null;
  originAppPackage: string | null;
};

const readLatestMetric = async (
  healthConnect: HealthConnectModule,
  recordType: "Weight" | "BodyFat" | "LeanBodyMass",
  getValue: (record: Record<string, unknown>) => number | null
): Promise<HealthMetricResult> => {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  const result = await healthConnect.readRecords(recordType, {
    timeRangeFilter: {
      operator: "between",
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    },
    ascendingOrder: false,
    pageSize: 1,
  });
  const record = result.records[0] as Record<string, unknown> | undefined;
  if (!record) {
    return { value: null, recordedAtMs: null, originAppPackage: null };
  }
  const timeMs = new Date(String(record.time ?? record.endTime ?? record.startTime ?? "")).getTime();
  const metadata = record.metadata as { dataOrigin?: string } | undefined;
  return {
    value: getValue(record),
    recordedAtMs: Number.isFinite(timeMs) ? timeMs : null,
    originAppPackage: normalizeString(metadata?.dataOrigin),
  };
};

export const syncBodyCompositionFromHealthConnect = async (
  uid: string,
  now = new Date()
): Promise<BodyCompositionSyncResult> => {
  if (Platform.OS !== "android") return { status: "unsupported" };
  try {
    const availability = await getHealthConnectAvailability();
    if (availability === "provider_update_required") return { status: "provider_update_required" };
    if (availability !== "available") return { status: "unavailable" };
    const healthConnect = await loadHealthConnect();
    await healthConnect.initialize();
    const hasPermission = await hasHealthBodyCompositionPermission();
    if (!hasPermission) return { status: "permission_denied" };

    const [weight, bodyFat, leanBodyMass] = await Promise.all([
      readLatestMetric(healthConnect, "Weight", (record) =>
        normalizeNullableNumber((record.weight as { inKilograms?: number } | undefined)?.inKilograms, 500)
      ),
      readLatestMetric(healthConnect, "BodyFat", (record) =>
        normalizeNullableNumber(record.percentage, 100)
      ),
      readLatestMetric(healthConnect, "LeanBodyMass", (record) =>
        normalizeNullableNumber((record.mass as { inKilograms?: number } | undefined)?.inKilograms, 500)
      ),
    ]);

    const hasAnyData =
      typeof weight.value === "number" ||
      typeof bodyFat.value === "number" ||
      typeof leanBodyMass.value === "number";
    if (!hasAnyData) return { status: "no_data" };

    const profile = await getBodyCompositionProfile(uid);
    const syncedAt = Timestamp.fromDate(now);
    const recordedAtMs = [weight.recordedAtMs, bodyFat.recordedAtMs, leanBodyMass.recordedAtMs]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .sort((a, b) => b - a)[0];
    const originAppPackage =
      weight.originAppPackage ?? bodyFat.originAppPackage ?? leanBodyMass.originAppPackage ?? null;
    const originLabel = inferOriginLabel(originAppPackage);
    const syncedSnapshot: BodyCompositionMetricSnapshot = {
      weightKg: weight.value,
      bodyFatPercent: bodyFat.value,
      muscleMassKg: leanBodyMass.value,
      recordedAt: typeof recordedAtMs === "number" ? Timestamp.fromMillis(recordedAtMs) : syncedAt,
      source: "health",
      originLabel,
    };
    const historyEntry: BodyCompositionHistoryEntry = {
      recordedAt: syncedSnapshot.recordedAt,
      source: "health",
      originLabel,
      weightKg: weight.value,
      bodyFatPercent: bodyFat.value,
      muscleMassKg: leanBodyMass.value,
    };

    await setDoc(
      doc(db, USERS_COLLECTION, uid),
      {
        [USER_BODY_COMPOSITION_FIELD]: {
          [BODY_COMPOSITION_FIELDS.synced]: syncedSnapshot,
          [BODY_COMPOSITION_FIELDS.lastSyncedAt]: syncedAt,
          [BODY_COMPOSITION_FIELDS.originAppPackage]: originAppPackage,
          [BODY_COMPOSITION_FIELDS.originLabel]: originLabel,
          [BODY_COMPOSITION_FIELDS.history]: pushHistoryEntry(profile.history, historyEntry),
        },
      },
      { merge: true }
    );
    return { status: "success", syncedAt };
  } catch (error) {
    const message = getErrorMessage(error) || "Failed to sync body composition.";
    return { status: "error", message };
  }
};

export const syncBodyCompositionFromSamsungHealth = async (
  uid: string,
  now = new Date()
): Promise<BodyCompositionSyncResult> => {
  if (Platform.OS !== "android") return { status: "unsupported" };
  try {
    const available = await isSamsungHealthBodyCompositionAvailable();
    if (!available) return { status: "unavailable" };

    const hasPermission = await hasSamsungHealthBodyCompositionPermission();
    if (!hasPermission) return { status: "permission_denied" };

    const latest = await readLatestSamsungHealthBodyComposition();
    if (!latest) return { status: "no_data" };

    const weightKg = normalizeNullableNumber(latest.weightKg, 500);
    const bodyFatPercent = normalizeNullableNumber(latest.bodyFatPercent, 100);
    const preferredMuscleKg =
      normalizeNullableNumber(latest.skeletalMuscleMassKg, 500) ??
      normalizeNullableNumber(latest.skeletalMuscleKg, 500) ??
      normalizeNullableNumber(latest.muscleMassKg, 500) ??
      normalizeNullableNumber(latest.muscleMassFieldKg, 500);

    const hasAnyData =
      typeof weightKg === "number" ||
      typeof bodyFatPercent === "number" ||
      typeof preferredMuscleKg === "number";
    if (!hasAnyData) return { status: "no_data" };

    const profile = await getBodyCompositionProfile(uid);
    const syncedAt = Timestamp.fromDate(now);
    const originAppPackage = normalizeString(latest.sourceAppId) ?? "com.sec.android.app.shealth";
    const originLabel = inferOriginLabel(originAppPackage) ?? "Samsung Health";
    const recordedAt =
      typeof latest.recordedAtMs === "number" && Number.isFinite(latest.recordedAtMs)
        ? Timestamp.fromMillis(Math.round(latest.recordedAtMs))
        : syncedAt;

    const syncedSnapshot: BodyCompositionMetricSnapshot = {
      weightKg,
      bodyFatPercent,
      muscleMassKg: preferredMuscleKg,
      recordedAt,
      source: "health",
      originLabel,
    };
    const historyEntry: BodyCompositionHistoryEntry = {
      recordedAt,
      source: "health",
      originLabel,
      weightKg,
      bodyFatPercent,
      muscleMassKg: preferredMuscleKg,
    };

    await setDoc(
      doc(db, USERS_COLLECTION, uid),
      {
        [USER_BODY_COMPOSITION_FIELD]: {
          [BODY_COMPOSITION_FIELDS.synced]: syncedSnapshot,
          [BODY_COMPOSITION_FIELDS.lastSyncedAt]: syncedAt,
          [BODY_COMPOSITION_FIELDS.originAppPackage]: originAppPackage,
          [BODY_COMPOSITION_FIELDS.originLabel]: originLabel,
          [BODY_COMPOSITION_FIELDS.history]: pushHistoryEntry(profile.history, historyEntry),
        },
      },
      { merge: true }
    );
    return { status: "success", syncedAt };
  } catch (error) {
    const message =
      getSamsungHealthAccessIssueMessage(error) ||
      getErrorMessage(error) ||
      "Failed to sync Samsung Health body composition.";
    return { status: "error", message };
  }
};

export const autoSyncBodyCompositionFromHealthConnectIfEligible = async (
  uid: string,
  options?: { minIntervalMinutes?: number }
): Promise<AutoBodyCompositionSyncResult> => {
  if (Platform.OS !== "android") return "skipped";

  try {
    const availability = await getHealthConnectAvailability();
    if (availability !== "available") return "skipped";

    const hasPermission = await hasHealthBodyCompositionPermission();
    if (!hasPermission) return "skipped";

    const profile = await getBodyCompositionProfile(uid);
    const minIntervalMinutes = options?.minIntervalMinutes ?? 60;
    const lastSyncedAt = profile.lastSyncedAt?.toDate() ?? null;
    if (lastSyncedAt) {
      const minutesSinceLastSync = (Date.now() - lastSyncedAt.getTime()) / (60 * 1000);
      if (minutesSinceLastSync < minIntervalMinutes) return "skipped";
    }

    const syncResult = await syncBodyCompositionFromHealthConnect(uid);
    return syncResult.status === "success" ? "synced" : "skipped";
  } catch {
    return "failed";
  }
};

export const autoSyncBodyCompositionFromSamsungHealthIfEligible = async (
  uid: string,
  options?: { minIntervalMinutes?: number }
): Promise<AutoBodyCompositionSyncResult> => {
  if (Platform.OS !== "android") return "skipped";

  try {
    const available = await isSamsungHealthBodyCompositionAvailable();
    if (!available) return "skipped";

    const hasPermission = await hasSamsungHealthBodyCompositionPermission();
    if (!hasPermission) return "skipped";

    const profile = await getBodyCompositionProfile(uid);
    const minIntervalMinutes = options?.minIntervalMinutes ?? 60;
    const lastSyncedAt = profile.lastSyncedAt?.toDate() ?? null;
    if (lastSyncedAt) {
      const minutesSinceLastSync = (Date.now() - lastSyncedAt.getTime()) / (60 * 1000);
      if (minutesSinceLastSync < minIntervalMinutes) return "skipped";
    }

    const syncResult = await syncBodyCompositionFromSamsungHealth(uid);
    return syncResult.status === "success" ? "synced" : "skipped";
  } catch {
    return "failed";
  }
};

export const openHealthBodyCompositionPermissionsScreen =
  openHealthConnectAppPermissionsScreen;

export const openHealthBodyCompositionDataManagementScreen =
  openHealthConnectDataManagementScreen;
