import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import {
  SLEEP_PROFILE_FIELDS,
  USER_SLEEP_PROFILE_FIELD,
  USERS_COLLECTION,
  type SleepProfile,
  type SleepSource,
} from "../contracts";

const DEFAULT_SLEEP_SOURCE: SleepSource = "manual";

const normalizeSleepHours = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 24) return null;
  return Math.round(value * 10) / 10;
};

const normalizeSource = (value: unknown): SleepSource =>
  value === "health" ? "health" : DEFAULT_SLEEP_SOURCE;

const normalizeTimestamp = (value: unknown): Timestamp | null =>
  value instanceof Timestamp ? value : null;

export const buildSleepProfile = (
  latestSleepHours: number | null,
  source: SleepSource,
  sampleRecordedAt: Timestamp | null,
  lastSyncedAt: Timestamp | null
): SleepProfile => ({
  latestSleepHours,
  source,
  sampleRecordedAt,
  lastSyncedAt,
});

export const getSleepProfile = async (uid: string): Promise<SleepProfile> => {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
  const data = snapshot.data()?.[USER_SLEEP_PROFILE_FIELD] as
    | Record<string, unknown>
    | undefined;

  return buildSleepProfile(
    normalizeSleepHours(data?.[SLEEP_PROFILE_FIELDS.latestSleepHours]),
    normalizeSource(data?.[SLEEP_PROFILE_FIELDS.source]),
    normalizeTimestamp(data?.[SLEEP_PROFILE_FIELDS.sampleRecordedAt]),
    normalizeTimestamp(data?.[SLEEP_PROFILE_FIELDS.lastSyncedAt])
  );
};

export const saveManualSleepSample = async (
  uid: string,
  sleepHours: number,
  now = new Date()
): Promise<void> => {
  const nowTimestamp = Timestamp.fromDate(now);
  const roundedHours = Math.round(sleepHours * 10) / 10;
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      [USER_SLEEP_PROFILE_FIELD]: {
        [SLEEP_PROFILE_FIELDS.latestSleepHours]: roundedHours,
        [SLEEP_PROFILE_FIELDS.source]: "manual",
        [SLEEP_PROFILE_FIELDS.sampleRecordedAt]: nowTimestamp,
        [SLEEP_PROFILE_FIELDS.lastSyncedAt]: nowTimestamp,
      },
    },
    { merge: true }
  );
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
