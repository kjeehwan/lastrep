import type { Timestamp } from "firebase/firestore";
import { USERS_COLLECTION } from "./entitlement";

export const USER_SLEEP_PROFILE_FIELD = "sleepProfile" as const;
export const USER_SLEEP_PROFILE_PATH = `${USERS_COLLECTION}/{uid}/${USER_SLEEP_PROFILE_FIELD}` as const;
export const SLEEP_SOURCES = ["manual", "health"] as const;

export const SLEEP_PROFILE_FIELDS = {
  latestSleepHours: "latestSleepHours",
  source: "source",
  sampleRecordedAt: "sampleRecordedAt",
  lastSyncedAt: "lastSyncedAt",
} as const;

export type SleepSource = (typeof SLEEP_SOURCES)[number];

export interface SleepProfile {
  latestSleepHours: number | null;
  source: SleepSource;
  sampleRecordedAt: Timestamp | null;
  lastSyncedAt: Timestamp | null;
}
