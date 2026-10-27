import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  SHARING_LIMITS,
  type SharedWorkoutPlan,
  type SharingPerson,
} from "./sharingContract";

export type {
  SharedWorkoutPlan,
  SharingPerson,
  SharingSettings,
  SharingDelivery,
  SharingSent,
} from "./sharingContract";
export type SharingCursor = { createdAtMs: number; id: string } | null;
export type SharingSnapshot = {
  snapshotId: string;
  plan: SharedWorkoutPlan;
  sender: SharingPerson;
};
export async function sharingCall<T>(
  op: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const call = httpsCallable<Record<string, unknown>, T>(
    getFunctions(getApp(), "asia-northeast3"),
    "workoutSharing",
    { timeout: 20_000 },
  );
  const expectedUid = Object.prototype.hasOwnProperty.call(data, "expectedUid")
    ? data.expectedUid
    : (getAuth().currentUser?.uid ?? null);
  return (await call({ ...data, op, expectedUid })).data;
}
export function sharingError(error: unknown): string {
  const code = (error as { code?: string })?.code || "";
  if (/not-found/.test(code))
    return "This shared workout is unavailable or has expired. Ask the sender to share it again.";
  if (/unavailable|internal/.test(code))
    return "Workout sharing is unavailable right now. Please try again later.";
  if (/unauthenticated/.test(code)) return "Sign in to continue.";
  return error instanceof Error
    ? error.message.replace(/^Firebase:\s*/, "")
    : "Couldn't complete this action. Please try again.";
}
export function sharingRequestId() {
  // IDs identify an intent, not a security token. Keep this same ID when retrying an uncertain send.
  return `send-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export async function sendWorkoutInLastrep(
  uid: string,
  plan: SharedWorkoutPlan,
  recipients: string[],
) {
  if (getAuth().currentUser?.uid !== uid) throw Error("Sign in to continue.");
  const key = `workout-sharing-send-v1:${uid}`,
    signature = JSON.stringify({ plan, recipients: [...recipients].sort() });
  let pending: {
    signature?: string;
    id?: string;
    createdAtMs?: number;
  } | null = null;
  try {
    pending = JSON.parse((await AsyncStorage.getItem(key)) || "null");
  } catch {
    /* Replace an invalid local intent before dispatch. */
  }
  const now = Date.now(),
    sameIntent =
      pending?.signature === signature &&
      typeof pending.id === "string" &&
      (pending.createdAtMs == null ||
        pending.createdAtMs >= now - SHARING_LIMITS.historyDays * 86400_000);
  const requestId = sameIntent ? pending!.id! : sharingRequestId();
  const intentCreatedAtMs =
    sameIntent && typeof pending!.createdAtMs === "number"
      ? pending!.createdAtMs
      : now;
  // Persist before dispatch so closing/reopening after an uncertain response cannot create a duplicate.
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      signature,
      id: requestId,
      createdAtMs: intentCreatedAtMs,
    }),
  );
  if (getAuth().currentUser?.uid !== uid)
    throw Error("Account changed. Sign in again to continue.");
  const result = await sharingCall<{
    recipients: (SharingPerson & { status: string })[];
  }>("send", {
    requestId,
    plan,
    recipients,
    expectedUid: uid,
    intentCreatedAtMs,
  });
  await AsyncStorage.removeItem(key).catch(() => undefined);
  return result;
}
