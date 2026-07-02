import type { Timestamp } from "firebase/firestore";
import { USERS_COLLECTION } from "./entitlement";

export const USER_BODY_COMPOSITION_FIELD = "bodyCompositionProfile" as const;
export const USER_BODY_COMPOSITION_PATH = `${USERS_COLLECTION}/{uid}/${USER_BODY_COMPOSITION_FIELD}` as const;
export const BODY_COMPOSITION_SOURCES = ["manual", "health"] as const;

export const BODY_COMPOSITION_FIELDS = {
  manual: "manual",
  synced: "synced",
  history: "history",
  lastSyncedAt: "lastSyncedAt",
  originAppPackage: "originAppPackage",
  originLabel: "originLabel",
} as const;

export type BodyCompositionSource = (typeof BODY_COMPOSITION_SOURCES)[number];

export interface BodyCompositionMetricSnapshot {
  weightKg: number | null;
  bodyFatPercent: number | null;
  muscleMassKg: number | null;
  recordedAt: Timestamp | null;
  source: BodyCompositionSource | null;
  originLabel: string | null;
}

export interface BodyCompositionHistoryEntry {
  recordedAt: Timestamp | null;
  source: BodyCompositionSource;
  originLabel: string | null;
  weightKg: number | null;
  bodyFatPercent: number | null;
  muscleMassKg: number | null;
}

export interface BodyCompositionProfile {
  manual: BodyCompositionMetricSnapshot;
  synced: BodyCompositionMetricSnapshot;
  history: BodyCompositionHistoryEntry[];
  lastSyncedAt: Timestamp | null;
  originAppPackage: string | null;
  originLabel: string | null;
}
