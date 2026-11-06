import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ exists: true, error: null as Error | null }));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({ getUser: async () => {
  if (auth.error) throw auth.error;
  if (!auth.exists) throw Object.assign(new Error("Synthetic deleted account"), { code: "auth/user-not-found" });
  return { uid: "billing-owner" };
} }) }));

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("billing account lifecycle", () => {
  let webhook: typeof import("./index").revenuecatWebhook;
  const uid = "billing-owner";
  const account = () => getFirestore().doc(`users/${uid}`);
  const event = (overrides: Record<string, unknown> = {}) => ({
    app_user_id: uid, id: "purchase-1", type: "INITIAL_PURCHASE",
    entitlement_ids: ["premium"], event_timestamp_ms: 200, ...overrides,
  });
  async function deliver(overrides: Record<string, unknown> = {}) {
    let code = 0, body: any;
    const response: any = { status: (next: number) => { code = next; return response; },
      json: (result: unknown) => { body = result; }, send: (result: unknown) => { body = result; } };
    await webhook({ method: "POST", headers: {}, get: () => "local-billing-test", body: { event: event(overrides) } } as any,
      response);
    return { code, body };
  }
  beforeAll(async () => {
    if (!getApps().length) initializeApp({ projectId: "demo-lastrep-billing" });
    if (!getApps()[0].options.projectId?.startsWith("demo-")) throw Error("Disposable project required");
    process.env.REVENUECAT_WEBHOOK_AUTH = "local-billing-test";
    webhook = (await import("./index")).revenuecatWebhook;
  });
  beforeEach(async () => {
    auth.exists = true; auth.error = null;
    await account().delete();
  });

  it("acknowledges a late event for deleted Auth without recreating data", async () => {
    auth.exists = false;
    expect(await deliver()).toMatchObject({ code: 200, body: { skipped: true, reason: "account_deleted" } });
    expect((await account().get()).exists).toBe(false);
  });
  it("ignores a deleting account while its Auth identity still exists", async () => {
    await account().set({ profilePhotoDeletionStartedAt: Timestamp.now() });
    expect(await deliver()).toMatchObject({ code: 200, body: { reason: "account_deleting" } });
    expect((await account().get()).data()?.entitlement).toBeUndefined();
  });
  it("retries missing profiles and applies the purchase after profile creation", async () => {
    expect(await deliver()).toMatchObject({ code: 500 });
    expect((await account().get()).exists).toBe(false);
    await account().set({ nickname: "Synthetic billing owner" });
    expect(await deliver()).toMatchObject({ code: 200, body: { skipped: false } });
    expect((await account().get()).data()?.entitlement.isSubscribed).toBe(true);
  });
  it("propagates transient Auth failure instead of acknowledging the event", async () => {
    auth.error = new Error("Synthetic Auth outage");
    expect(await deliver()).toMatchObject({ code: 500 });
    expect((await account().get()).exists).toBe(false);
  });
  it("preserves duplicate, stale-event and expiration behavior", async () => {
    await account().set({ nickname: "Synthetic billing owner" });
    await deliver();
    expect(await deliver()).toMatchObject({ body: { reason: "duplicate_event_id" } });
    expect(await deliver({ id: "old", type: "EXPIRATION", event_timestamp_ms: 100 }))
      .toMatchObject({ body: { reason: "stale_event" } });
    expect((await account().get()).data()?.entitlement.isSubscribed).toBe(true);
    await deliver({ id: "expired", type: "EXPIRATION", event_timestamp_ms: 300 });
    expect((await account().get()).data()?.entitlement.isSubscribed).toBe(false);
  });
  it("preserves permanent grants", async () => {
    await account().set({ entitlement: { manualGrantPermanent: true, isSubscribed: true } });
    expect(await deliver({ type: "EXPIRATION" })).toMatchObject({ body: { reason: "manual_grant_locked" } });
    expect((await account().get()).data()?.entitlement.isSubscribed).toBe(true);
  });
  it("does not restore entitlement while deletion races a purchase", async () => {
    await account().set({ nickname: "Synthetic billing owner" });
    await Promise.all([deliver(), account().set({ profilePhotoDeletionStartedAt: Timestamp.now() }, { merge: true })]);
    // Even if the first purchase committed before deletion started, subsequent
    // lifecycle events must stop at the persisted deletion marker.
    await account().update({ entitlement: null });
    expect(await deliver({ id: "renewal", type: "RENEWAL", event_timestamp_ms: 400 }))
      .toMatchObject({ body: { reason: "account_deleting" } });
    expect((await account().get()).data()?.entitlement).toBeNull();
  });
});
