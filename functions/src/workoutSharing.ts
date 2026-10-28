import {
  cleanExpiredSharingInbox,
  expireSharingDelivery,
  sharingExpired,
  sharingExpiry,
  sharingHistoryMs,
} from "./sharingRetention";
import { createHash, randomBytes } from "node:crypto";
import {
  getFirestore,
  Timestamp,
  FieldPath,
  type DocumentData,
} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import {
  normalizeSharingUsername,
  validSharingUsername,
  sharingSearchKey,
  parseSharedWorkoutPlan,
  SHARING_LIMITS,
  type SharingPerson,
  type SharedWorkoutPlan,
} from "./workoutSharingContract";

function fail(
  code: functions.https.FunctionsErrorCode,
  message: string,
): never {
  throw new functions.https.HttpsError(code, message);
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const db = () => getFirestore();
const settings = (uid: string) => db().doc(`users/${uid}/sharing/settings`);
const profile = (uid: string) => db().doc(`users/${uid}`);
const inbox = (uid: string) => db().collection(`users/${uid}/sharingInbox`);
const sent = (uid: string) => db().collection(`users/${uid}/sharingSent`);
const relation = (recipient: string, sender: string) =>
  db().doc(`users/${recipient}/sharingSenders/${hash(sender)}`);
const defaults = (data?: DocumentData) => ({
  enabled: data?.enabled === true,
  username: typeof data?.username === "string" ? data.username : "",
  unreadCount: Math.max(0, Number(data?.unreadCount) || 0),
  requestCount: Math.max(0, Number(data?.requestCount) || 0),
});
const person = (
  uid: string,
  pref?: DocumentData,
  user?: DocumentData,
): SharingPerson => ({
  uid,
  username: String(pref?.username || ""),
  nickname:
    typeof user?.nickname === "string" && user.nickname.trim()
      ? user.nickname.trim().slice(0, 40)
      : "Lastrep user",
});
const live = (data?: DocumentData) =>
  !!data && !data.profilePhotoDeletionStartedAt;
const id = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{8,128}$/.test(value)
    ? value
    : fail("invalid-argument", "Invalid request identifier.");
function plan(input: unknown) {
  try {
    return parseSharedWorkoutPlan(input);
  } catch (error) {
    return fail(
      "invalid-argument",
      error instanceof Error ? error.message : "Invalid workout plan.",
    );
  }
}
async function throttle(
  uid: string,
  action: string,
  maximum: number,
  windowMs = 60_000,
) {
  const key = Math.floor(Date.now() / windowMs),
    ref = db().doc(`users/${uid}/sharingLimits/${action}-${key}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if ((snap.data()?.count || 0) >= maximum)
      fail("resource-exhausted", "Too many requests. Please try again later.");
    tx.set(ref, {
      count: (snap.data()?.count || 0) + 1,
      expiresAt: Timestamp.fromMillis(Date.now() + 86400_000),
    });
  });
}
async function saveIdentity(uid: string, input: Record<string, unknown>) {
  const username =
    input.op === "username"
      ? normalizeSharingUsername(String(input.username || ""))
      : null;
  if (username !== null && !validSharingUsername(username))
    fail(
      "invalid-argument",
      "Use an available username with 3–24 letters, numbers, dots or underscores.",
    );
  return db().runTransaction(async (tx) => {
    const [s, u] = await tx.getAll(settings(uid), profile(uid));
    if (!live(u.data()))
      fail("failed-precondition", "Complete your account setup first.");
    const current = defaults(s.data()),
      next = {
        ...current,
        ...(username !== null
          ? { username }
          : { enabled: input.enabled === true }),
      };
    if (next.enabled && !next.username)
      fail(
        "failed-precondition",
        "Choose a username before turning sharing on.",
      );
    const claimRef = next.username
      ? db().doc(`sharingUsernames/${next.username}`)
      : null;
    const claim = claimRef ? await tx.get(claimRef) : null;
    if (claim?.exists && claim.data()?.uid !== uid)
      fail("already-exists", "That username is taken. Try another.");
    if (claimRef) tx.set(claimRef, { uid, updatedAt: Timestamp.now() });
    if (current.username && current.username !== next.username)
      tx.delete(db().doc(`sharingUsernames/${current.username}`));
    tx.set(
      settings(uid),
      { ...next, updatedAt: Timestamp.now() },
      { merge: true },
    );
    const directory = db().doc(`sharingDirectory/${uid}`);
    if (next.enabled) {
      const p = person(uid, next, u.data());
      tx.set(directory, {
        ...p,
        nameKey: sharingSearchKey(p.nickname),
        updatedAt: Timestamp.now(),
      });
    } else tx.delete(directory);
    return next;
  });
}
async function search(uid: string, input: Record<string, unknown>) {
  const q = sharingSearchKey(String(input.query || "").replace(/^@/, ""));
  if (q.length < 2 || q.length > 40) return { people: [] };
  if (!defaults((await settings(uid).get()).data()).enabled)
    fail("permission-denied", "Enable sharing to find people.");
  await throttle(uid, "search", SHARING_LIMITS.searchPerMinute);
  const results = await Promise.all(
    ["username", "nameKey"].map((field) =>
      db()
        .collection("sharingDirectory")
        .orderBy(field)
        .startAt(q)
        .endAt(q + "\uf8ff")
        .limit(20)
        .get(),
    ),
  );
  const found = new Map<string, SharingPerson>();
  results.forEach((r) =>
    r.docs.forEach((doc) => {
      const p = doc.data();
      if (p.uid !== uid)
        found.set(p.uid, {
          uid: p.uid,
          nickname: p.nickname,
          username: p.username,
        });
    }),
  );
  return {
    people: [...found.values()]
      .sort(
        (a, b) =>
          a.nickname.localeCompare(b.nickname) ||
          a.username.localeCompare(b.username),
      )
      .slice(0, 30),
  };
}
async function send(uid: string, input: Record<string, unknown>) {
  const requestId = id(input.requestId),
    snapshot = plan(input.plan);
  const intentCreatedAtMs = input.intentCreatedAtMs;
  if (
    typeof intentCreatedAtMs !== "number" ||
    !Number.isFinite(intentCreatedAtMs) ||
    intentCreatedAtMs > Date.now() + 300_000 ||
    intentCreatedAtMs < Date.now() - sharingHistoryMs()
  )
    fail(
      "failed-precondition",
      "This send request has expired. Start a new send and check your device's date and time.",
    );
  const recipients = Array.isArray(input.recipients)
    ? [...new Set(input.recipients.map(String))].sort()
    : [];
  if (
    !recipients.length ||
    recipients.length > SHARING_LIMITS.recipients ||
    recipients.some((r) => r === uid || !r || r.includes("/") || r.length > 128)
  )
    fail(
      "invalid-argument",
      `Select 1 to ${SHARING_LIMITS.recipients} other people.`,
    );
  await Promise.all(
    recipients.map(async (recipient) => {
      const pending = (await relation(recipient, uid).get()).data();
      if (
        pending?.status === "request" &&
        sharingExpired(pending) &&
        typeof pending.deliveryId === "string"
      )
        await expireSharingDelivery(recipient, pending.deliveryId);
    }),
  );
  const snapshotId = hash(uid + ":" + JSON.stringify(snapshot)),
    intentHash = hash(snapshotId + recipients.join(":"));
  const receiptRef = db().doc(`users/${uid}/sharingReceipts/${requestId}`),
    snapshotRef = db().doc(`workoutShareSnapshots/${snapshotId}`);
  const day = new Date().toISOString().slice(0, 10),
    limitRef = db().doc(`users/${uid}/sharingLimits/send-${day}`),
    sentRef = sent(uid).doc(requestId);
  return db().runTransaction(async (tx) => {
    const refs = [
      receiptRef,
      settings(uid),
      profile(uid),
      limitRef,
      snapshotRef,
      ...recipients.flatMap((r) => [settings(r), profile(r), relation(r, uid)]),
    ];
    const docs = await tx.getAll(...refs),
      [receipt, ownSettings, ownProfile, limits, oldSnapshot] = docs;
    if (receipt.exists) {
      if (receipt.data()?.intentHash !== intentHash)
        fail(
          "already-exists",
          "This send request was already used for another workout.",
        );
      return receipt.data()!.result;
    }
    if (!live(ownProfile.data()) || !defaults(ownSettings.data()).enabled)
      fail("failed-precondition", "Enable sharing before sending in Lastrep.");
    const used = Number(limits.data()?.deliveries) || 0,
      created = Number(limits.data()?.snapshots) || 0;
    if (
      used + recipients.length > SHARING_LIMITS.deliveriesPerDay ||
      (!oldSnapshot.exists && created >= SHARING_LIMITS.snapshotsPerDay)
    )
      fail(
        "resource-exhausted",
        "Today's sharing limit has been reached. Please try again tomorrow.",
      );
    const sender = person(uid, ownSettings.data(), ownProfile.data()),
      now = Date.now(),
      outcomes: (SharingPerson & { status: string })[] = [];
    recipients.forEach((r, index) => {
      const [pref, user, rel] = docs.slice(5 + index * 3, 8 + index * 3),
        p = person(r, pref.data(), user.data()),
        state = rel.data();
      if (
        !defaults(pref.data()).enabled ||
        !live(user.data()) ||
        state?.status === "blocked" ||
        state?.cooldownUntilMs > now
      ) {
        outcomes.push({
          uid: r,
          nickname: "Unavailable",
          username: "",
          status: "unavailable",
        });
        return;
      }
      if (state?.status === "request") {
        outcomes.push({ ...p, status: "awaiting-acceptance" });
        return;
      }
      const accepted = state?.status === "accepted",
        counters = defaults(pref.data()),
        pendingToday =
          pref.data()?.pendingDay === day
            ? Number(pref.data()?.pendingToday) || 0
            : 0;
      if (!accepted && pendingToday >= SHARING_LIMITS.pendingSendersPerDay) {
        outcomes.push({ ...p, status: "unavailable" });
        return;
      }
      const deliveryId = hash(uid + ":" + requestId + ":" + r);
      tx.create(inbox(r).doc(deliveryId), {
        snapshotId,
        sender,
        title: snapshot.title,
        status: accepted ? "inbox" : "request",
        unread: accepted,
        createdAtMs: now,
        createdAt: Timestamp.fromMillis(now),
        ...sharingExpiry(now),
      });
      if (!accepted)
        tx.set(relation(r, uid), {
          senderUid: uid,
          status: "request",
          deliveryId,
          createdAtMs: now,
        });
      tx.set(
        settings(r),
        {
          unreadCount: counters.unreadCount + (accepted ? 1 : 0),
          requestCount: counters.requestCount + (accepted ? 0 : 1),
          ...(!accepted
            ? { pendingDay: day, pendingToday: pendingToday + 1 }
            : {}),
        },
        { merge: true },
      );
      outcomes.push({ ...p, status: accepted ? "inbox" : "request" });
    });
    const delivered = outcomes.filter(
      (p) => p.status === "inbox" || p.status === "request",
    );
    if (delivered.length && !oldSnapshot.exists)
      tx.create(snapshotRef, {
        ownerUid: uid,
        sender,
        plan: snapshot,
        createdAt: Timestamp.fromMillis(now),
        ...sharingExpiry(now),
      });
    if (delivered.length && oldSnapshot.exists)
      tx.update(
        snapshotRef,
        sharingExpiry(
          Math.max(
            now,
            Number(oldSnapshot.data()?.expiresAtMs || 0) - sharingHistoryMs(),
          ),
        ),
      );
    tx.set(limitRef, {
      deliveries: used + recipients.length,
      snapshots: created + (delivered.length && !oldSnapshot.exists ? 1 : 0),
      expiresAt: Timestamp.fromMillis(now + 7 * 86400_000),
    });
    if (delivered.length)
      tx.create(sentRef, {
        snapshotId,
        title: snapshot.title,
        recipients: delivered,
        createdAtMs: now,
        createdAt: Timestamp.fromMillis(now),
        ...sharingExpiry(now),
      });
    const result = {
      id: requestId,
      snapshotId,
      recipients: outcomes,
      createdAtMs: now,
    };
    tx.create(receiptRef, {
      intentCreatedAtMs,
      intentHash,
      result,
      createdAt: Timestamp.fromMillis(now),
      ...sharingExpiry(now),
    });
    return result;
  });
}
async function respond(uid: string, input: Record<string, unknown>) {
  const deliveryId = id(input.deliveryId),
    action = String(input.action);
  if (!["accept", "decline", "block", "read", "remove"].includes(action))
    fail("invalid-argument", "Invalid sharing action.");
  return db().runTransaction(async (tx) => {
    const ref = inbox(uid).doc(deliveryId),
      [delivery, prefs, account] = await tx.getAll(
        ref,
        settings(uid),
        profile(uid),
      );
    if (!live(account.data()))
      fail("failed-precondition", "Your account is unavailable.");
    if (!delivery.exists)
      fail("not-found", "This shared workout is unavailable.");
    const data = delivery.data()!,
      counts = defaults(prefs.data()),
      relRef = relation(uid, data.sender.uid),
      rel = await tx.get(relRef);
    if ((action === "read" || action === "accept") && sharingExpired(data))
      fail("not-found", "This shared workout has expired.");
    if (action === "read") {
      if (data.status !== "inbox")
        fail("permission-denied", "Accept this sharing request first.");
      if (data.unread) {
        tx.update(ref, { unread: false });
        tx.set(
          settings(uid),
          { unreadCount: Math.max(0, counts.unreadCount - 1) },
          { merge: true },
        );
      }
    } else if (action === "remove") {
      tx.delete(ref);
      tx.set(
        settings(uid),
        {
          unreadCount: Math.max(0, counts.unreadCount - (data.unread ? 1 : 0)),
          requestCount: Math.max(
            0,
            counts.requestCount - (data.status === "request" ? 1 : 0),
          ),
        },
        { merge: true },
      );
      if (data.status === "request")
        tx.set(relRef, {
          senderUid: data.sender.uid,
          status: "declined",
          cooldownUntilMs: Date.now() + 7 * 86400_000,
          expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400_000),
        });
    } else {
      if (data.status !== "request" && action !== "block") return { ok: true };
      const pending = data.status === "request";
      tx.set(relRef, {
        senderUid: data.sender.uid,
        status:
          action === "accept"
            ? "accepted"
            : action === "block"
              ? "blocked"
              : "declined",
        cooldownUntilMs: action === "decline" ? Date.now() + 7 * 86400_000 : 0,
        ...(action === "decline"
          ? { expiresAt: Timestamp.fromMillis(Date.now() + 7 * 86400_000) }
          : {}),
      });
      tx.update(ref, {
        status:
          action === "accept"
            ? "inbox"
            : action === "block"
              ? "blocked"
              : "declined",
        unread: action === "accept",
      });
      tx.set(
        settings(uid),
        {
          requestCount: Math.max(0, counts.requestCount - (pending ? 1 : 0)),
          unreadCount: Math.max(
            0,
            counts.unreadCount -
              (data.unread ? 1 : 0) +
              (action === "accept" ? 1 : 0),
          ),
        },
        { merge: true },
      );
      // A later repeated response must not resurrect an accepted/declined request.
      void rel;
    }
    return { ok: true };
  });
}
async function authorizedSnapshot(
  uid: string | null,
  input: Record<string, unknown>,
): Promise<{
  snapshotId: string;
  plan: SharedWorkoutPlan;
  sender: SharingPerson;
}> {
  let snapshotId: string | undefined;
  if (input.token) {
    const token = String(input.token);
    if (!/^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{32})$/.test(token))
      fail("not-found", "This sharing link is unavailable.");
    const link = (
      await db()
        .doc(`workoutShareLinks/${hash(token)}`)
        .get()
    ).data();
    if (!link || link.revoked || link.expiresAtMs < Date.now())
      fail("not-found", "This sharing link is unavailable.");
    // A bearer link grants preview only. Bound repeated public reads without storing IP addresses.
    const window = Math.floor(Date.now() / 60_000),
      quota = db().doc(`workoutShareReadLimits/${hash(token)}-${window}`);
    await db().runTransaction(async (tx) => {
      const count = Number((await tx.get(quota)).data()?.count) || 0;
      if (count >= 120)
        fail(
          "resource-exhausted",
          "This link has had too many requests. Please try again shortly.",
        );
      tx.set(quota, {
        count: count + 1,
        expiresAt: Timestamp.fromMillis(Date.now() + 86400_000),
      });
    });
    snapshotId = link.snapshotId;
  } else if (uid && input.sentId) {
    const entry = (await sent(uid).doc(id(input.sentId)).get()).data();
    if (sharingExpired(entry))
      fail("not-found", "This shared workout has expired.");
    snapshotId = entry?.snapshotId;
  } else if (uid && input.deliveryId) {
    const delivery = (await inbox(uid).doc(id(input.deliveryId)).get()).data();
    if (sharingExpired(delivery))
      fail("not-found", "This shared workout has expired.");
    if (delivery?.status !== "inbox")
      fail("permission-denied", "Accept this sharing request first.");
    snapshotId = delivery.snapshotId;
  }
  if (!snapshotId) fail("not-found", "This shared workout is unavailable.");
  const snapshot = (
    await db().doc(`workoutShareSnapshots/${snapshotId}`).get()
  ).data();
  if (sharingExpired(snapshot))
    fail("not-found", "This shared workout has expired.");
  if (!snapshot || !live((await profile(snapshot.ownerUid).get()).data()))
    fail("not-found", "This shared workout is unavailable.");
  return {
    snapshotId,
    plan: parseSharedWorkoutPlan(snapshot.plan),
    sender: snapshot.sender,
  };
}
async function externalLink(uid: string, input: Record<string, unknown>) {
  const snapshot = plan(input.plan),
    snapshotId = hash(uid + ":" + JSON.stringify(snapshot)),
    ownerRef = db().doc(`users/${uid}/sharingLinks/${snapshotId}`);
  await throttle(uid, "links", 20, 86400_000);
  return db().runTransaction(async (tx) => {
    const [old, user, pref, stored] = await tx.getAll(
      ownerRef,
      profile(uid),
      settings(uid),
      db().doc(`workoutShareSnapshots/${snapshotId}`),
    );
    if (!live(user.data()))
      fail("failed-precondition", "Your account is unavailable.");
    const expiry = sharingExpiry(),
      expiresAtMs = expiry.expiresAtMs;
    if (
      old.exists &&
      !old.data()?.revoked &&
      old.data()!.expiresAtMs > Date.now()
    ) {
      tx.update(ownerRef, expiry);
      tx.update(
        db().doc(`workoutShareLinks/${hash(old.data()!.token)}`),
        expiry,
      );
      if (stored.exists)
        tx.update(
          stored.ref,
          sharingExpiry(
            Math.max(
              Date.now(),
              Number(stored.data()?.expiresAtMs || 0) - sharingHistoryMs(),
            ),
          ),
        );
      return { token: old.data()!.token, snapshotId, expiresAtMs };
    }
    const token = randomBytes(24).toString("base64url");
    if (!stored.exists)
      tx.create(stored.ref, {
        ownerUid: uid,
        sender: person(uid, pref.data(), user.data()),
        plan: snapshot,
        createdAt: Timestamp.now(),
        ...expiry,
      });
    else
      tx.update(
        stored.ref,
        sharingExpiry(
          Math.max(
            Date.now(),
            Number(stored.data()?.expiresAtMs || 0) - sharingHistoryMs(),
          ),
        ),
      );
    tx.set(ownerRef, { token, snapshotId, revoked: false, ...expiry });
    tx.create(db().doc(`workoutShareLinks/${hash(token)}`), {
      ownerUid: uid,
      snapshotId,
      revoked: false,
      ...expiry,
    });
    return { token, snapshotId, expiresAtMs };
  });
}
async function revokeLink(uid: string, input: Record<string, unknown>) {
  const snapshotId = id(input.snapshotId),
    ref = db().doc(`users/${uid}/sharingLinks/${snapshotId}`);
  await db().runTransaction(async (tx) => {
    const link = (await tx.get(ref)).data();
    if (!link) return;
    tx.update(ref, { revoked: true });
    tx.update(db().doc(`workoutShareLinks/${hash(link.token)}`), {
      revoked: true,
    });
  });
  return { ok: true };
}
async function list(uid: string, input: Record<string, unknown>) {
  const kind = input.kind === "sent" ? "sent" : "inbox";
  let q = (
    kind === "sent"
      ? sent(uid)
      : inbox(uid).where(
          "status",
          "==",
          input.kind === "requests" ? "request" : "inbox",
        )
  )
    .where("createdAtMs", ">", Date.now() - sharingHistoryMs())
    .orderBy("createdAtMs", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  const after = input.cursor as
    { createdAtMs?: unknown; id?: unknown } | undefined;
  if (
    after &&
    typeof after.createdAtMs === "number" &&
    typeof after.id === "string"
  )
    q = q.startAfter(after.createdAtMs, id(after.id));
  const docs = await q.limit(40).get(),
    last = docs.docs[docs.size - 1];
  return {
    items: docs.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor:
      docs.size === 40
        ? { createdAtMs: last.data().createdAtMs, id: last.id }
        : null,
  };
}
async function reviewRecipients(uid: string, input: Record<string, unknown>) {
  if (!defaults((await settings(uid).get()).data()).enabled)
    fail("failed-precondition", "Enable sharing first.");
  await throttle(uid, "review", 30);
  const recipients = Array.isArray(input.recipients)
    ? [...new Set(input.recipients.map(String))]
    : [];
  if (
    !recipients.length ||
    recipients.length > SHARING_LIMITS.recipients ||
    recipients.some((r) => !r || r === uid || r.includes("/") || r.length > 128)
  )
    fail("invalid-argument", "Choose valid recipients.");
  return {
    recipients: await Promise.all(
      recipients.map(async (r) => {
        const [pref, user, rel] = await db().getAll(
          settings(r),
          profile(r),
          relation(r, uid),
        );
        const state = rel.data();
        if (
          !defaults(pref.data()).enabled ||
          !live(user.data()) ||
          state?.status === "blocked" ||
          state?.cooldownUntilMs > Date.now()
        )
          return {
            uid: r,
            nickname: "Unavailable",
            username: "",
            status: "unavailable",
          };
        return {
          ...person(r, pref.data(), user.data()),
          status:
            state?.status === "accepted"
              ? "inbox"
              : state?.status === "request"
                ? "awaiting-acceptance"
                : "request",
        };
      }),
    ),
  };
}
async function importRoutine(uid: string, input: Record<string, unknown>) {
  await throttle(uid, "import", 20);
  const shared = await authorizedSnapshot(uid, input),
    ref = db().doc(`users/${uid}/routines/shared-${shared.snapshotId}`);
  return db().runTransaction(async (tx) => {
    const [existing, user] = await tx.getAll(ref, profile(uid));
    if (!live(user.data()))
      fail("failed-precondition", "Your account is unavailable.");
    if (existing.exists) return { created: false, id: ref.id };
    tx.create(ref, {
      name: shared.plan.title,
      sharedSnapshotId: shared.snapshotId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      exercises: shared.plan.exercises.map((e) => ({
        name: e.name,
        mode: e.mode,
        notes: e.instructions,
        targets: e.targets ?? null,
        tempo: e.tempo,
        restSec: e.restSec,
        unit: e.unit,
        cardioSessionType: e.cardioSessionType ?? null,
        cardioEffortLevel: e.cardioEffortLevel ?? null,
        sets: e.sets.map((s) => ({
          reps: s.reps,
          defaultWeightKg: s.weightKg,
          defaultDistanceKm: s.distanceKm,
          defaultDurationSec: s.durationSec,
          setType: s.setType,
          targetRpe: s.targetRpe,
        })),
      })),
    });
    return { created: true, id: ref.id };
  });
}
export async function handleWorkoutSharing(raw: unknown, uid: string | null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    fail("invalid-argument", "Invalid sharing request.");
  const input = raw as Record<string, unknown>;
  if (input.expectedUid !== undefined && input.expectedUid !== uid)
    fail("unauthenticated", "Account changed. Sign in again to continue.");
  if (input.op === "snapshot" && input.token)
    return authorizedSnapshot(uid, input);
  if (!uid) fail("unauthenticated", "Sign in to share workouts.");
  if (input.op === "cleanup") {
    await throttle(uid, "cleanup", 5);
    await cleanExpiredSharingInbox(uid);
    return defaults((await settings(uid).get()).data());
  }
  if (input.op === "settings")
    return defaults((await settings(uid).get()).data());
  if (input.op === "username" || input.op === "enabled") {
    await throttle(uid, "identity", 20);
    return saveIdentity(uid, input);
  }
  if (input.op === "search") return search(uid, input);
  if (input.op === "review") return reviewRecipients(uid, input);
  if (input.op === "importRoutine") return importRoutine(uid, input);
  if (input.op === "send") return send(uid, input);
  if (input.op === "respond") return respond(uid, input);
  if (input.op === "snapshot") return authorizedSnapshot(uid, input);
  if (input.op === "link") return externalLink(uid, input);
  if (input.op === "revokeLink") return revokeLink(uid, input);
  if (input.op === "list") return list(uid, input);
  fail("invalid-argument", "Unknown sharing action.");
}
export const workoutSharing = functions
  .region("asia-northeast3")
  .runWith({ timeoutSeconds: 60, maxInstances: 5 })
  .https.onCall((raw: unknown, context) =>
    handleWorkoutSharing(raw, context.auth?.uid || null),
  );
export async function deleteWorkoutSharingForAccount(uid: string) {
  const pref = (await settings(uid).get()).data();
  await db().doc(`sharingDirectory/${uid}`).delete();
  if (pref?.username)
    await db().runTransaction(async (tx) => {
      const ref = db().doc(`sharingUsernames/${pref.username}`);
      const claim = await tx.get(ref);
      if (claim.data()?.uid === uid) tx.delete(ref);
    });
  const links = await db()
    .collection("workoutShareLinks")
    .where("ownerUid", "==", uid)
    .get();
  for (const d of links.docs) await d.ref.delete();
  const snapshots = await db()
    .collection("workoutShareSnapshots")
    .where("ownerUid", "==", uid)
    .get();
  for (const d of snapshots.docs) await d.ref.delete();
  // Clear references held by other accounts; imported routines/workouts remain independent.
  const received = await db()
    .collectionGroup("sharingInbox")
    .where("sender.uid", "==", uid)
    .get();
  for (const d of received.docs)
    await db().runTransaction(async (tx) => {
      const recipient = d.ref.parent.parent!;
      const [entry, pref, recipientProfile] = await tx.getAll(
        d.ref,
        settings(recipient.id),
        profile(recipient.id),
      );
      if (!entry.exists) return;
      const counts = defaults(pref.data());
      tx.delete(d.ref);
      if (live(recipientProfile.data()))
        tx.set(
          settings(recipient.id),
          {
            unreadCount: Math.max(
              0,
              counts.unreadCount - (entry.data()?.unread ? 1 : 0),
            ),
            requestCount: Math.max(
              0,
              counts.requestCount -
                (entry.data()?.status === "request" ? 1 : 0),
            ),
          },
          { merge: true },
        );
    });
  const relations = await db()
    .collectionGroup("sharingSenders")
    .where("senderUid", "==", uid)
    .get();
  for (const d of relations.docs) await d.ref.delete();
}
export const syncSharingNickname = functions
  .region("asia-northeast3")
  .firestore.document("users/{uid}")
  .onUpdate(async (change) => {
    if (change.before.data().nickname === change.after.data().nickname) return;
    const uid = change.after.id,
      pref = (await settings(uid).get()).data();
    if (!pref?.enabled || !live(change.after.data())) return;
    await db().runTransaction(async (tx) => {
      const [latestSettings, latestUser] = await tx.getAll(
        settings(uid),
        profile(uid),
      );
      if (!latestSettings.data()?.enabled || !live(latestUser.data())) return;
      const p = person(uid, latestSettings.data(), latestUser.data());
      tx.set(db().doc(`sharingDirectory/${uid}`), {
        ...p,
        nameKey: sharingSearchKey(p.nickname),
        updatedAt: Timestamp.now(),
      });
    });
  });
