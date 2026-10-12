import { randomUUID } from "node:crypto";
import { CRC32C } from "@google-cloud/storage";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as functions from "firebase-functions/v1";
import sharp from "sharp";
import { canCommitPhoto, canDeletePhoto, decodePhotoInput, isOwnPhotoPath, photoObjectPath, PHOTO_MAX_AGE_MS } from "./profilePhotoPolicy";

const region = functions.region("asia-northeast3");
const uploads = (uid: string) => getFirestore().collection(`users/${uid}/profilePhotoUploads`);
const user = (uid: string) => getFirestore().doc(`users/${uid}`);
const bucket = () => getStorage().bucket();

function requireUser(context: functions.https.CallableContext): string {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in to manage your photo.");
  return context.auth.uid;
}

// Claim before deletion so cleanup cannot race a staged photo's commit.
async function cleanupPhoto(uid: string, id: string): Promise<void> {
  const ref = uploads(uid).doc(id);
  const path = await getFirestore().runTransaction(async (tx) => {
    const [entry, profile] = await Promise.all([tx.get(ref), tx.get(user(uid))]);
    const data = entry.data();
    if (!data || !isOwnPhotoPath(uid, data.path) || !canDeletePhoto(data.path, profile.data()?.profilePhotoPath)) return null;
    tx.update(ref, { status: "deleting" });
    return data.path as string;
  });
  if (!path) return;
  await bucket().file(path).delete({ ignoreNotFound: true });
  await ref.delete();
}

export const stageProfilePhoto = region.runWith({ memory: "512MB", timeoutSeconds: 60 }).https.onCall(async (data, context) => {
  const uid = requireUser(context);
  let input: Buffer;
  try { input = decodePhotoInput(data?.base64); }
  catch (error) { throw new functions.https.HttpsError("invalid-argument", (error as Error).message); }
  const rateRef = getFirestore().doc(`users/${uid}/private/profilePhotoRateLimit`);
  await getFirestore().runTransaction(async (tx) => {
    const [rate, profile] = await Promise.all([tx.get(rateRef), tx.get(user(uid))]);
    if (!profile.exists || profile.data()?.profilePhotoDeletionStartedAt) throw new functions.https.HttpsError("failed-precondition", "Account is unavailable for uploads.");
    const previous = rate.data();
    const now = Date.now();
    const sameWindow = now - (previous?.startedAtMs ?? 0) < 60 * 60 * 1000;
    const count = sameWindow ? (previous?.count ?? 0) : 0;
    if (count >= 12) throw new functions.https.HttpsError("resource-exhausted", "Too many photo uploads. Try again later.");
    tx.set(rateRef, { startedAtMs: sameWindow ? previous!.startedAtMs : now, count: count + 1 });
  });
  let image: Buffer;
  try {
    const decoder = sharp(input, { limitInputPixels: 40_000_000, animated: false });
    const metadata = await decoder.metadata();
    if (!["jpeg", "png", "webp", "heif"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Unsupported image");
    image = await decoder.rotate().resize(512, 512, { fit: "cover", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    throw new functions.https.HttpsError("invalid-argument", "Choose a valid JPEG, PNG, or WebP photo.");
  }
  const id = randomUUID();
  const path = photoObjectPath(uid, id);
  const crc = new CRC32C();
  crc.update(image);
  // Supply a checksum for server-side validation as well as client validation.
  await getFirestore().runTransaction(async (tx) => {
    const profile = await tx.get(user(uid));
    if (!profile.exists || profile.data()?.profilePhotoDeletionStartedAt) throw new functions.https.HttpsError("failed-precondition", "Account is unavailable for uploads.");
    tx.set(uploads(uid).doc(id), { path, status: "uploading", createdAt: Timestamp.now() });
  });
  const targetBucket = bucket();
  const [bucketMetadata] = await targetBucket.getMetadata();
  await targetBucket.file(path).save(image, {
    resumable: false,
    validation: "crc32c",
    // Override any default object ACL when ACLs are enabled on the bucket.
    ...(bucketMetadata.iamConfiguration?.uniformBucketLevelAccess?.enabled ? {} : { predefinedAcl: "private" }),
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType: "image/jpeg", cacheControl: "private, max-age=3600", crc32c: crc.toString() },
  });
  try {
    await getFirestore().runTransaction(async (tx) => {
      const profile = await tx.get(user(uid));
      if (!profile.exists || profile.data()?.profilePhotoDeletionStartedAt) throw new functions.https.HttpsError("failed-precondition", "Account is unavailable for uploads.");
      tx.update(uploads(uid).doc(id), { status: "staged" });
    });
  } catch (error) {
    await bucket().file(path).delete({ ignoreNotFound: true });
    await uploads(uid).doc(id).delete();
    throw error;
  }
  return { path };
});

export const commitProfilePhoto = region.https.onCall(async (data, context) => {
  const uid = requireUser(context);
  const path = data?.path;
  if (path !== null && !isOwnPhotoPath(uid, path)) throw new functions.https.HttpsError("invalid-argument", "Invalid photo reference.");
  const previousPath = await getFirestore().runTransaction(async (tx) => {
    const profileRef = user(uid);
    const profile = await tx.get(profileRef);
    if (!profile.exists || profile.data()?.profilePhotoDeletionStartedAt) throw new functions.https.HttpsError("failed-precondition", "Account is unavailable.");
    const previous = profile.data()?.profilePhotoPath ?? null;
    if (path !== null && path === previous) return previous;
    const previousRef = isOwnPhotoPath(uid, previous)
      ? uploads(uid).doc(previous.split("/").pop()!.replace(".jpg", "")) : null;
    const previousUpload = previousRef ? await tx.get(previousRef) : null;
    if (path !== null) {
      const ref = uploads(uid).doc(path.split("/").pop()!.replace(".jpg", ""));
      const staged = (await tx.get(ref)).data();
      if (!staged || !canCommitPhoto(staged.status, staged.createdAt.toMillis(), Date.now())) {
        throw new functions.https.HttpsError("failed-precondition", "Photo upload expired. Save the photo again.");
      }
      tx.update(ref, { status: "committed" });
    }
    if (previousRef && previousUpload?.exists) tx.update(previousRef, { status: "deleting" });
    tx.set(profileRef, { profilePhotoPath: path, profilePhotoUri: "", profilePhotoUpdatedAt: Timestamp.now() }, { merge: true });
    return previous;
  });
  if (isOwnPhotoPath(uid, previousPath) && previousPath !== path) {
    await cleanupPhoto(uid, previousPath.split("/").pop()!.replace(".jpg", "")).catch(() => {
      functions.logger.warn("profile_photo_cleanup_deferred", { uid });
    });
  }
  return { path };
});

export const getProfilePhoto = region.https.onCall(async (_data, context) => {
  const uid = requireUser(context);
  const profile = (await user(uid).get()).data();
  if (profile?.profilePhotoDeletionStartedAt) throw new functions.https.HttpsError("failed-precondition", "Account is unavailable.");
  const path = profile?.profilePhotoPath;
  if (!isOwnPhotoPath(uid, path)) return { path: null, base64: null };
  const [image] = await bucket().file(path).download({ validation: "crc32c" });
  return { path, base64: image.toString("base64") };
});

export const discardProfilePhotoUpload = region.https.onCall(async (data, context) => {
  const uid = requireUser(context);
  if (!isOwnPhotoPath(uid, data?.path)) throw new functions.https.HttpsError("invalid-argument", "Invalid photo reference.");
  await cleanupPhoto(uid, data.path.split("/").pop()!.replace(".jpg", ""));
  return { ok: true };
});

export const cleanupAbandonedProfilePhotos = region.pubsub.schedule("every 24 hours").onRun(async () => {
  // Only uncommitted/deleting uploads; active photos must not starve cleanup.
  const old = await getFirestore().collectionGroup("profilePhotoUploads")
    .where("status", "in", ["uploading", "staged", "deleting"])
    .where("createdAt", "<", Timestamp.fromMillis(Date.now() - PHOTO_MAX_AGE_MS)).limit(500).get();
  for (const entry of old.docs) {
    const uid = entry.ref.parent.parent!.id;
    await cleanupPhoto(uid, entry.id).catch(() => functions.logger.warn("profile_photo_cleanup_retry", { uid }));
  }
});

export async function deleteProfilePhotosForAccount(uid: string): Promise<void> {
  const [profile, entries] = await Promise.all([user(uid).get(), uploads(uid).limit(1).get()]);
  if (profile.data()?.profilePhotoPath || !entries.empty) {
    await bucket().deleteFiles({ prefix: `users/${uid}/profile-photos/` });
  }
}
