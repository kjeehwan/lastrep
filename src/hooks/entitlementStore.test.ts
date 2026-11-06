import { beforeEach, expect, it, vi } from "vitest";
import { createEntitlementStore } from "./entitlementStore";

const fake = vi.hoisted(() => ({ subscriptions: [] as {
  uid: string; next: (snapshot: any) => void; error: (error: any) => void; stop: ReturnType<typeof vi.fn>;
}[] }));
vi.mock("../config/firebaseConfig", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, _collection: string, uid: string) => uid,
  onSnapshot: (uid: string, next: (value: any) => void, error: (error: any) => void) => {
    const stop = vi.fn(); fake.subscriptions.push({ uid, next, error, stop }); return stop;
  },
}));
const saved = (entitlement: Record<string, unknown>, exists = true) => ({
  exists: () => exists, data: () => ({ entitlement }),
});
beforeEach(() => { fake.subscriptions = []; });

it("starts a new account loading and never reuses the previous account's premium result", () => {
  const alice = createEntitlementStore("alice"), onAlice = vi.fn();
  const stop = alice.subscribe(onAlice);
  fake.subscriptions[0].next(saved({ isSubscribed: true }));
  expect(alice.getSnapshot()).toEqual({ state: "active", isSubscribed: true });
  stop();
  const bob = createEntitlementStore("bob"), onBob = vi.fn();
  bob.subscribe(onBob);
  expect(bob.getSnapshot()).toEqual({ state: "loading", isSubscribed: null });
  fake.subscriptions[0].next(saved({ isSubscribed: false }));
  fake.subscriptions[0].error({ code: "unavailable" });
  expect(onAlice).toHaveBeenCalledTimes(1);
  expect(onBob).not.toHaveBeenCalled();
  fake.subscriptions[1].next(saved({ isSubscribed: false }));
  expect(bob.getSnapshot()).toEqual({ state: "inactive", isSubscribed: false });
  expect(fake.subscriptions[0].stop).toHaveBeenCalledOnce();
});

it("signed-out state stays loading without subscribing", () => {
  const store = createEntitlementStore(null);
  store.subscribe(vi.fn())();
  expect(fake.subscriptions).toHaveLength(0);
  expect(store.getSnapshot()).toEqual({ state: "loading", isSubscribed: null });
});

it("handles missing records, permanent grants and offline errors for the current account", () => {
  const store = createEntitlementStore("alice");
  store.subscribe(vi.fn());
  const subscription = fake.subscriptions[0];
  subscription.next(saved({}, false));
  expect(store.getSnapshot().state).toBe("inactive");
  subscription.next(saved({ manualGrantPermanent: true, isSubscribed: false }));
  expect(store.getSnapshot().state).toBe("active");
  subscription.error({ code: "unavailable" });
  expect(store.getSnapshot()).toEqual({ state: "inactive", isSubscribed: false });
});

it("suppresses callbacks from a disposed subscription after React resubscribes", () => {
  const store = createEntitlementStore("alice"), changed = vi.fn();
  const stop = store.subscribe(changed); stop(); store.subscribe(changed);
  fake.subscriptions[0].next(saved({ isSubscribed: true }));
  expect(store.getSnapshot().state).toBe("loading");
  fake.subscriptions[1].next(saved({ isSubscribed: false }));
  expect(store.getSnapshot().state).toBe("inactive");
  expect(changed).toHaveBeenCalledOnce();
});
