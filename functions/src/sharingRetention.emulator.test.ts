import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { beforeAll, describe, expect, it } from "vitest";
import { handleWorkoutSharing } from "./workoutSharing";
import { cleanExpiredSharingInbox, sharingHistoryMs } from "./sharingRetention";

const call = (input: Record<string, unknown>, uid: string | null) =>
  handleWorkoutSharing(
    {
      ...(input.op === "send" ? { intentCreatedAtMs: Date.now() } : {}),
      ...input,
    },
    uid,
  );
const plan = {
  version: 1,
  title: "Retention example",
  effortScale: "rpe",
  exercises: [
    {
      name: "Bench Press",
      mode: "resistance",
      unit: "lbs",
      restSec: 150,
      tempo: "",
      instructions: "",
      sets: [
        {
          weightKg: 60,
          reps: "8",
          targetRpe: 8,
          setType: "normal",
          durationSec: null,
          distanceKm: null,
        },
      ],
    },
  ],
};
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "30-day sharing retention",
  () => {
    const suffix = Date.now().toString(36),
      sender = `retention-s-${suffix}`,
      recipient = `retention-r-${suffix}`;
    let snapshotId = "",
      deliveryId = "",
      oldSentId = "",
      currentSentId = "";
    const expire = () => ({
      expiresAtMs: Date.now() - 1000,
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
      createdAtMs: Date.now() - sharingHistoryMs() - 1000,
    });
    const latest = async () =>
      (
        await getFirestore()
          .collection(`users/${recipient}/sharingInbox`)
          .orderBy("createdAtMs", "desc")
          .get()
      ).docs[0];
    beforeAll(async () => {
      if (!getApps().length)
        initializeApp({ projectId: "demo-lastrep-sharing" });
      for (const uid of [sender, recipient]) {
        await getFirestore()
          .doc(`users/${uid}`)
          .set({ nickname: "Retention example" });
        await call(
          { op: "username", username: uid.replaceAll("-", ".").slice(-24) },
          uid,
        );
        await call({ op: "enabled", enabled: true }, uid);
      }
    });
    it("expires delivery access, clears pending counts once, and rejects stale replays after receipt removal", async () => {
      const input = {
        op: "send",
        requestId: `initial-${suffix}`,
        plan,
        recipients: [recipient],
      };
      const sent = (await call(input, sender)) as any;
      snapshotId = sent.snapshotId;
      oldSentId = sent.id;
      const first = await latest();
      deliveryId = first.id;
      expect(first.data().expiresAtMs - first.data().createdAtMs).toBe(
        sharingHistoryMs(),
      );
      await first.ref.update(expire());
      await getFirestore()
        .doc(`users/${sender}/sharingSent/${oldSentId}`)
        .update(expire());
      await getFirestore()
        .doc(`workoutShareSnapshots/${snapshotId}`)
        .update(expire());
      await expect(
        call({ op: "respond", deliveryId, action: "accept" }, recipient),
      ).rejects.toMatchObject({ code: "not-found" });
      expect(await cleanExpiredSharingInbox(recipient)).toBe(1);
      expect(await cleanExpiredSharingInbox(recipient)).toBe(0);
      expect(await call({ op: "settings" }, recipient)).toMatchObject({
        requestCount: 0,
        unreadCount: 0,
      });
      await getFirestore()
        .doc(`users/${sender}/sharingReceipts/${oldSentId}`)
        .delete();
      await expect(
        call(
          {
            ...input,
            intentCreatedAtMs: Date.now() - sharingHistoryMs() - 1000,
          },
          sender,
        ),
      ).rejects.toMatchObject({ code: "failed-precondition" });
      expect(
        (
          await getFirestore()
            .collection(`users/${recipient}/sharingInbox`)
            .get()
        ).empty,
      ).toBe(true);
    });
    it("a fresh delivery renews the reused snapshot without reopening expired Sent entries", async () => {
      const next = (await call(
        {
          op: "send",
          requestId: `fresh-${suffix}`,
          plan,
          recipients: [recipient],
        },
        sender,
      )) as any;
      currentSentId = next.id;
      expect(next.snapshotId).toBe(snapshotId);
      expect(next.recipients[0].status).toBe("request");
      expect(
        (
          await getFirestore().doc(`workoutShareSnapshots/${snapshotId}`).get()
        ).data()?.expiresAtMs,
      ).toBeGreaterThan(Date.now());
      await expect(
        call({ op: "snapshot", sentId: oldSentId }, sender),
      ).rejects.toMatchObject({ code: "not-found" });
      expect(
        await call({ op: "snapshot", sentId: currentSentId }, sender),
      ).toMatchObject({ plan });
      deliveryId = (await latest()).id;
      await call({ op: "respond", deliveryId, action: "accept" }, recipient);
      await call({ op: "importRoutine", deliveryId }, recipient);
    });
    it("removes expired Inbox entries while preserving accepted senders and independent routines", async () => {
      await getFirestore()
        .doc(`users/${recipient}/sharingInbox/${deliveryId}`)
        .update(expire());
      expect(await cleanExpiredSharingInbox(recipient)).toBe(1);
      expect(await call({ op: "settings" }, recipient)).toMatchObject({
        unreadCount: 0,
        requestCount: 0,
      });
      const routine = (
        await getFirestore()
          .doc(`users/${recipient}/routines/shared-${snapshotId}`)
          .get()
      ).data()!;
      expect(routine.exercises[0]).toMatchObject({ unit: "lbs", restSec: 150 });
      expect(routine.exercises[0].sets[0]).toMatchObject({ targetRpe: 8 });
      expect(routine.exercises[0].sets[0]).not.toHaveProperty("rpe");
      const repeat = (await call(
        {
          op: "send",
          requestId: `known-${suffix}`,
          plan,
          recipients: [recipient],
        },
        sender,
      )) as any;
      expect(repeat.recipients[0].status).toBe("inbox");
      deliveryId = (await latest()).id;
    });
    it("preserves a sender block when its last delivery expires", async () => {
      await call({ op: "respond", deliveryId, action: "block" }, recipient);
      await getFirestore()
        .doc(`users/${recipient}/sharingInbox/${deliveryId}`)
        .update(expire());
      await cleanExpiredSharingInbox(recipient);
      const repeat = (await call(
        {
          op: "send",
          requestId: `blocked-${suffix}`,
          plan,
          recipients: [recipient],
        },
        sender,
      )) as any;
      expect(repeat.recipients[0].status).toBe("unavailable");
    });
    it("expired external links cannot be read, and a newly shared link gets a fresh 30-day window", async () => {
      const link = (await call({ op: "link", plan }, sender)) as any;
      expect(link.expiresAtMs - Date.now()).toBeLessThanOrEqual(
        sharingHistoryMs(),
      );
      const key = createHash("sha256").update(link.token).digest("hex");
      await getFirestore().doc(`workoutShareLinks/${key}`).update(expire());
      await getFirestore()
        .doc(`users/${sender}/sharingLinks/${snapshotId}`)
        .update(expire());
      await expect(
        call({ op: "snapshot", token: link.token }, null),
      ).rejects.toMatchObject({ code: "not-found" });
      const next = (await call({ op: "link", plan }, sender)) as any;
      expect(next.token).not.toBe(link.token);
      expect(next.expiresAtMs).toBeGreaterThan(Date.now());
    });
    it("cleanup never recreates sharing settings for a deleted account", async () => {
      const expiredRef = getFirestore().doc(
        `users/${recipient}/sharingInbox/expired-orphan`,
      );
      await expiredRef.set({
        sender: { uid: sender },
        status: "inbox",
        unread: true,
        ...expire(),
      });
      await getFirestore()
        .doc(`users/${recipient}`)
        .set({ profilePhotoDeletionStartedAt: Date.now() });
      await getFirestore().doc(`users/${recipient}/sharing/settings`).delete();
      expect(await cleanExpiredSharingInbox(recipient)).toBe(1);
      expect(
        (await getFirestore().doc(`users/${recipient}/sharing/settings`).get())
          .exists,
      ).toBe(false);
    });
  },
);
