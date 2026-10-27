import { createHash } from "node:crypto";
import {
  getFirestore,
  Timestamp,
  type DocumentData,
} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { SHARING_LIMITS } from "./workoutSharingContract";

export const sharingHistoryMs = () => SHARING_LIMITS.historyDays * 86400_000;
export function sharingExpiry(now = Date.now()) {
  const expiresAtMs = now + sharingHistoryMs();
  return { expiresAtMs, expiresAt: Timestamp.fromMillis(expiresAtMs) };
}
export function sharingExpired(data?: DocumentData, now = Date.now()) {
  if (!data) return true;
  const createdAt =
    typeof data.createdAtMs === "number"
      ? data.createdAtMs
      : data.createdAt?.toMillis?.();
  const deadline =
    typeof data.expiresAtMs === "number"
      ? data.expiresAtMs
      : typeof createdAt === "number"
        ? createdAt + sharingHistoryMs()
        : 0;
  return !Number.isFinite(deadline) || deadline <= now;
}

/** Inbox deletion must update counts and release only the matching pending request. TTL cannot do that. */
export async function expireSharingDelivery(
  uid: string,
  deliveryId: string,
  now = Date.now(),
) {
  const db = getFirestore(),
    entryRef = db.doc(`users/${uid}/sharingInbox/${deliveryId}`),
    settingsRef = db.doc(`users/${uid}/sharing/settings`);
  return db.runTransaction(async (tx) => {
    const [entry, settings, account] = await tx.getAll(
      entryRef,
      settingsRef,
      db.doc(`users/${uid}`),
    );
    if (!entry.exists || !sharingExpired(entry.data(), now)) return false;
    const data = entry.data()!,
      senderKey = createHash("sha256").update(data.sender.uid).digest("hex"),
      relationRef = db.doc(`users/${uid}/sharingSenders/${senderKey}`);
    const relation = await tx.get(relationRef);
    tx.delete(entryRef);
    if (account.exists && !account.data()?.profilePhotoDeletionStartedAt)
      tx.set(
        settingsRef,
        {
          unreadCount: Math.max(
            0,
            (Number(settings.data()?.unreadCount) || 0) - (data.unread ? 1 : 0),
          ),
          requestCount: Math.max(
            0,
            (Number(settings.data()?.requestCount) || 0) -
              (data.status === "request" ? 1 : 0),
          ),
        },
        { merge: true },
      );
    if (
      relation.data()?.status === "request" &&
      relation.data()?.deliveryId === deliveryId
    )
      tx.delete(relationRef);
    return true;
  });
}
export async function cleanExpiredSharingInbox(uid?: string, now = Date.now()) {
  const db = getFirestore(),
    source = uid
      ? db.collection(`users/${uid}/sharingInbox`)
      : db.collectionGroup("sharingInbox");
  const expired = await source
    .where("expiresAt", "<=", Timestamp.fromMillis(now))
    .limit(100)
    .get();
  let removed = 0;
  for (const entry of expired.docs) {
    const owner = entry.ref.parent.parent!;
    if (await expireSharingDelivery(owner.id, entry.id, now)) removed++;
  }
  return removed;
}
export const expireWorkoutSharingInbox = functions
  .region("asia-northeast3")
  .runWith({ timeoutSeconds: 120, maxInstances: 1 })
  .pubsub.schedule("every 15 minutes")
  .onRun(async () => {
    await cleanExpiredSharingInbox();
    return null;
  });
