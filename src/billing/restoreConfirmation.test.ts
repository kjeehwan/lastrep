import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmRestoredPremium, RESTORE_CONFIRM_TIMEOUT_MS } from "./restoreAccountPurchases";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: { uid: "user" } as { uid: string } | null },
  snapshot: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock("../config/firebaseConfig", () => ({ auth: mocks.auth, db: {} }));
vi.mock("firebase/firestore", () => ({ doc: vi.fn(), onSnapshot: mocks.snapshot }));
vi.mock("./revenuecat", () => ({ ensureRevenueCatLoggedIn: vi.fn(), restorePurchases: vi.fn() }));

const product = "lastrep_premium_monthly";
const paid = { isSubscribed: true, source: "revenuecat", productId: product, expiresAt: null };
let update: (snapshot: unknown) => void;
let fail: () => void;
const emit = (entitlement = paid, fromCache = false, hasPendingWrites = false) => update({
  data: () => ({ entitlement }), metadata: { fromCache, hasPendingWrites },
});

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.auth.currentUser = { uid: "user" };
  mocks.snapshot.mockImplementation((_ref, _options, next, error) => {
    update = next; fail = error; return mocks.unsubscribe;
  });
});
afterEach(() => vi.useRealTimers());

describe("bounded backend restore confirmation", () => {
  it("waits for server confirmation, then removes its listener and timer", async () => {
    const result = confirmRestoredPremium("user", product, new AbortController().signal);
    emit(paid, true); expect(mocks.unsubscribe).not.toHaveBeenCalled();
    emit(paid, false, true); expect(mocks.unsubscribe).not.toHaveBeenCalled();
    emit(); expect(await result).toBe(true);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("returns unconfirmed at exactly ten seconds when no paid entitlement arrives", async () => {
    const result = confirmRestoredPremium("user", product, new AbortController().signal);
    emit({ ...paid, isSubscribed: false });
    await vi.advanceTimersByTimeAsync(RESTORE_CONFIRM_TIMEOUT_MS - 1);
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe(false);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not accept manually granted Premium as restored access", async () => {
    const result = confirmRestoredPremium("user", product, new AbortController().signal);
    update({ data: () => ({ entitlement: { ...paid, manualGrantPermanent: true } }), metadata: { fromCache: false } });
    await vi.advanceTimersByTimeAsync(RESTORE_CONFIRM_TIMEOUT_MS);
    expect(await result).toBe(false);
  });
  it("cancels waiting immediately when leaving the screen", async () => {
    const controller = new AbortController();
    const result = confirmRestoredPremium("user", product, controller.signal);
    controller.abort();
    expect(await result).toBe(false);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cannot confirm against a changed account", async () => {
    const result = confirmRestoredPremium("user", product, new AbortController().signal);
    mocks.auth.currentUser = { uid: "other" }; emit();
    expect(await result).toBe(false);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it("cleans up on permission or network errors", async () => {
    const result = confirmRestoredPremium("user", product, new AbortController().signal);
    fail(); expect(await result).toBe(false);
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not subscribe when already cancelled", async () => {
    const controller = new AbortController(); controller.abort();
    expect(await confirmRestoredPremium("user", product, controller.signal)).toBe(false);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
