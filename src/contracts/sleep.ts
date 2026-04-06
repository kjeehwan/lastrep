import type { Timestamp } from "firebase/firestore";
import { USERS_COLLECTION } from "./entitlement";

export const USER_SLEEP_PROFILE_FIELD = "sleepProfile" as const;
export const USER_SLEEP_PROFILE_PATH = `${USERS_COLLECTION}/{uid}/${USER_SLEEP_PROFILE_FIELD}` as const;
export const SLEEP_SOURCES = ["manual", "health"] as const;
export const SdkAvailabilityStatus = {
  SDK_UNAVAILABLE: 1,
  SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
  SDK_AVAILABLE: 3,
} as const;

export const SLEEP_PROFILE_FIELDS = {
  latestSleepHours: "latestSleepHours",
  source: "source",
  sampleRecordedAt: "sampleRecordedAt",
  lastSyncedAt: "lastSyncedAt",
  recentNightlyHours: "recentNightlyHours",
  originAppPackage: "originAppPackage",
  originLabel: "originLabel",
} as const;

export type SleepSource = (typeof SLEEP_SOURCES)[number];

export interface SleepNightlySummary {
  dateKey: string;
  sleepHours: number;
  source: SleepSource;
  recordedAt: Timestamp | null;
}

export interface SleepProfile {
  latestSleepHours: number | null;
  source: SleepSource;
  sampleRecordedAt: Timestamp | null;
  lastSyncedAt: Timestamp | null;
  recentNightlyHours: SleepNightlySummary[];
  originAppPackage: string | null;
  originLabel: string | null;
}
