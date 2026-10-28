import { beforeAll, describe, expect, it } from "vitest";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  handleWorkoutSharing,
  deleteWorkoutSharingForAccount,
} from "./workoutSharing";

const call = (input: Record<string, unknown>, uid: string | null) =>
  handleWorkoutSharing(
    {
      ...(input.op === "send" ? { intentCreatedAtMs: Date.now() } : {}),
      ...input,
    },
    uid,
  );

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
const sample = {
  version: 1,
  title: "Chest",
  effortScale: "rpe",
  exercises: [
    {
      name: "Bench Press",
      targets: { minReps: 8, maxReps: 12, targetRpe: 8.5 },
      mode: "resistance",
      unit: "kg",
      restSec: 90,
      tempo: "",
      instructions: "",
      sets: [
        {
          weightKg: 100,
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
describe.skipIf(!enabled)("workout sharing Firestore transactions", () => {
  const suffix = Date.now().toString(36),
    a = `sender-${suffix}`,
    b = `recipient-${suffix}`,
    c = `other-${suffix}`;
  let delivery = "",
    sentId = "",
    snapshotId = "";
  beforeAll(async () => {
    if (!getApps().length) initializeApp({ projectId: "demo-lastrep-sharing" });
    for (const [uid, nickname] of [
      [a, "Zoe"],
      [b, "Ada"],
      [c, "Ada"],
    ]) {
      await getFirestore().doc(`users/${uid}`).set({ nickname });
      await call(
        { op: "username", username: uid.replaceAll("-", ".").slice(0, 24) },
        uid,
      );
      await call({ op: "enabled", enabled: true }, uid);
    }
  }, 30_000);
  it("denies unauthenticated use and reserves usernames atomically", async () => {
    await expect(call({ op: "settings" }, null)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    await expect(
      call({ op: "enabled", enabled: false, expectedUid: b }, a),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(await call({ op: "settings" }, a)).toMatchObject({ enabled: true });
    const name = `race.${suffix}`;
    const results = await Promise.allSettled([
      call({ op: "username", username: name }, b),
      call({ op: "username", username: name }, c),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("defaults sharing off, keeps identity separate, and removes opted-out accounts from discovery", async () => {
    const uid = `fresh-${suffix}`;
    await getFirestore().doc(`users/${uid}`).set({ nickname: "Fresh Example" });
    expect(await call({ op: "settings" }, uid)).toMatchObject({
      enabled: false,
      username: "",
    });
    await expect(
      call({ op: "enabled", enabled: true }, uid),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    await call({ op: "username", username: `fresh.${suffix}` }, uid);
    expect(await call({ op: "settings" }, uid)).toMatchObject({
      enabled: false,
    });
    expect(
      ((await call({ op: "search", query: "Fresh" }, a)) as any).people,
    ).toHaveLength(0);
    await call({ op: "enabled", enabled: true }, uid);
    expect(
      ((await call({ op: "search", query: "Fresh" }, a)) as any).people,
    ).toHaveLength(1);
    await call({ op: "enabled", enabled: false }, uid);
    expect(
      ((await call({ op: "search", query: "Fresh" }, a)) as any).people,
    ).toHaveLength(0);
    expect(await call({ op: "settings" }, uid)).toMatchObject({
      username: `fresh.${suffix}`,
    });
  });
  it("makes first send a request; retries create one delivery and one sent item", async () => {
    const input = {
      op: "send",
      requestId: `request-${suffix}`,
      plan: sample,
      recipients: [b],
    };
    const [first, second] = (await Promise.all([
      call(input, a),
      call(input, a),
    ])) as any[];
    expect(first).toEqual(second);
    expect(first.recipients[0].status).toBe("request");
    sentId = first.id;
    snapshotId = first.snapshotId;
    const list = (await call({ op: "list", kind: "requests" }, b)) as any;
    expect(list.items).toHaveLength(1);
    delivery = list.items[0].id;
    await expect(
      call({ op: "snapshot", deliveryId: delivery }, b),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      call({ ...input, plan: { ...sample, title: "Changed" } }, a),
    ).rejects.toMatchObject({ code: "already-exists" });
  }, 30_000); // Concurrent Firestore transactions can retry beyond Vitest's 5-second default.
  it("prevents request flooding, accepts once, and marks read once", async () => {
    const repeat = (await call(
      {
        op: "send",
        requestId: `repeat-${suffix}`,
        plan: sample,
        recipients: [b],
      },
      a,
    )) as any;
    expect(repeat.recipients[0].status).toBe("awaiting-acceptance");
    await call({ op: "respond", deliveryId: delivery, action: "accept" }, b);
    await call({ op: "respond", deliveryId: delivery, action: "accept" }, b);
    expect(await call({ op: "settings" }, b)).toMatchObject({
      unreadCount: 1,
      requestCount: 0,
    });
    expect(
      await call({ op: "snapshot", deliveryId: delivery }, b),
    ).toMatchObject({ snapshotId, plan: sample });
    await call({ op: "respond", deliveryId: delivery, action: "read" }, b);
    await call({ op: "respond", deliveryId: delivery, action: "read" }, b);
    expect(await call({ op: "settings" }, b)).toMatchObject({ unreadCount: 0 });
    const imported = (await call(
      { op: "importRoutine", deliveryId: delivery },
      b,
    )) as any;
    expect(imported.created).toBe(true);
    const savedRoutine = (await getFirestore().doc(`users/${b}/routines/${imported.id}`).get()).data();
    expect(savedRoutine?.exercises[0].targets).toEqual(sample.exercises[0].targets);
    expect(savedRoutine?.exercises[0].sets[0]).toMatchObject({ targetRpe: 8 });
    expect(savedRoutine?.exercises[0].sets[0]).not.toHaveProperty("rpe");
    expect(
      await call({ op: "importRoutine", deliveryId: delivery }, b),
    ).toMatchObject({ created: false });
  });
  it("allows a deliberate repeat to an accepted recipient with the same immutable snapshot", async () => {
    const result = (await call(
      {
        op: "send",
        requestId: `another-${suffix}`,
        plan: sample,
        recipients: [b],
      },
      a,
    )) as any;
    expect(result.snapshotId).toBe(snapshotId);
    expect(result.id).not.toBe(sentId);
    expect(result.recipients[0].status).toBe("inbox");
    expect(((await call({ op: "list" }, b)) as any).items).toHaveLength(2);
  });
  it("rejects other accounts' snapshots and honors opt-out and block", async () => {
    await expect(call({ op: "snapshot", sentId }, c)).rejects.toMatchObject({
      code: "not-found",
    });
    await call({ op: "enabled", enabled: false }, b);
    expect(
      (
        (await call(
          {
            op: "send",
            requestId: `off-${suffix}`,
            plan: sample,
            recipients: [b],
          },
          a,
        )) as any
      ).recipients[0].status,
    ).toBe("unavailable");
    await call({ op: "enabled", enabled: true }, b);
    await call({ op: "respond", deliveryId: delivery, action: "block" }, b);
    expect(
      (
        (await call(
          {
            op: "send",
            requestId: `blocked-${suffix}`,
            plan: sample,
            recipients: [b],
          },
          a,
        )) as any
      ).recipients[0].status,
    ).toBe("unavailable");
  });
  it("reuses an external link, permits bearer preview and enforces revocation", async () => {
    const link = (await call({ op: "link", plan: sample }, a)) as any;
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(((await call({ op: "link", plan: sample }, a)) as any).token).toBe(
      link.token,
    );
    expect(
      await call({ op: "snapshot", token: link.token }, null),
    ).toMatchObject({ plan: sample });
    await call({ op: "revokeLink", snapshotId: link.snapshotId }, a);
    await expect(
      call({ op: "snapshot", token: link.token }, null),
    ).rejects.toMatchObject({ code: "not-found" });
  });
  it("sends separately to multiple people, deduplicates recipient selection, and respects decline cooldown", async () => {
    const result = (await call(
      {
        op: "send",
        requestId: `multi-${suffix}`,
        plan: sample,
        recipients: [c, b, c],
      },
      a,
    )) as any;
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients.find((p: any) => p.uid === b).status).toBe(
      "unavailable",
    );
    expect(result.recipients.find((p: any) => p.uid === c).status).toBe(
      "request",
    );
    const requests = (await call({ op: "list", kind: "requests" }, c)) as any;
    expect(requests.items).toHaveLength(1);
    expect(requests.items[0]).not.toHaveProperty("recipients");
    await call(
      { op: "respond", deliveryId: requests.items[0].id, action: "decline" },
      c,
    );
    await call(
      { op: "respond", deliveryId: requests.items[0].id, action: "decline" },
      c,
    );
    expect(await call({ op: "settings" }, c)).toMatchObject({
      requestCount: 0,
      unreadCount: 0,
    });
    const retry = (await call(
      {
        op: "send",
        requestId: `declined-${suffix}`,
        plan: sample,
        recipients: [c],
      },
      a,
    )) as any;
    expect(retry.recipients[0].status).toBe("unavailable");
  });
  it("enforces recipient and daily delivery limits, while successful retries do not spend the quota twice", async () => {
    await expect(
      call(
        {
          op: "send",
          requestId: `many-${suffix}`,
          plan: sample,
          recipients: Array.from({ length: 11 }, (_, i) => `test-${i}`),
        },
        a,
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    const day = new Date().toISOString().slice(0, 10);
    const quota = getFirestore().doc(`users/${a}/sharingLimits/send-${day}`);
    await quota.set({ deliveries: 100, snapshots: 0 });
    // Already completed requests remain retryable even after the quota is exhausted.
    const previous = (await call(
      {
        op: "send",
        requestId: `request-${suffix}`,
        plan: sample,
        recipients: [b],
      },
      a,
    )) as any;
    expect(previous.id).toBe(sentId);
    await expect(
      call(
        {
          op: "send",
          requestId: `over-limit-${suffix}`,
          plan: sample,
          recipients: [c],
        },
        a,
      ),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect((await quota.get()).data()?.deliveries).toBe(100);
  });
  it("account deletion removes shared references while preserving imported routines", async () => {
    await getFirestore()
      .doc(`users/${a}`)
      .set({ profilePhotoDeletionStartedAt: Date.now() }, { merge: true });
    await deleteWorkoutSharingForAccount(a);
    expect(((await call({ op: "list" }, b)) as any).items).toHaveLength(0);
    expect(
      (await getFirestore().collection(`users/${b}/routines`).get()).size,
    ).toBe(1);
    await expect(call({ op: "snapshot", sentId }, a)).rejects.toMatchObject({
      code: "not-found",
    });
  });
});
