import type { CustomerInfo } from "react-native-purchases";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRestoreController, isPaidPremiumConfirmed, RESTORE_MESSAGES, runRestoreFlow } from "./restoreFlow";

const product = "lastrep_premium_monthly";
const customer = (active = true) => ({
  entitlements: { active: active ? { premium: { isActive: true, store: "PLAY_STORE", productIdentifier: product } } : {} },
  activeSubscriptions: active ? [product] : [],
}) as unknown as CustomerInfo;
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };
const deps = { identify: vi.fn(), restore: vi.fn(), confirm: vi.fn(), currentUid: vi.fn() };

beforeEach(() => {
  vi.resetAllMocks();
  deps.currentUid.mockReturnValue("user");
  deps.restore.mockResolvedValue({ status: "RESTORED", customerInfo: customer() });
  deps.confirm.mockResolvedValue(true);
});

async function display() {
  const publish = vi.fn();
  await createRestoreController(deps).run("user", publish);
  expect(publish.mock.calls[0]).toEqual(["Checking purchases...", true]);
  return publish.mock.calls.at(-1);
}

describe("restore outcomes and exact user feedback", () => {
  it("confirms a store subscription and backend Premium", async () => {
    expect(await display()).toEqual(["Purchases restored. Premium is active.", false]);
    expect(deps.confirm).toHaveBeenCalledWith("user", product, expect.any(AbortSignal));
    expect(deps.identify.mock.invocationCallOrder[0]).toBeLessThan(deps.restore.mock.invocationCallOrder[0]);
  });
  it("reports no active purchase even if access was manually granted", async () => {
    deps.restore.mockResolvedValue({ status: "RESTORED", customerInfo: customer(false) });
    expect(await display()).toEqual(["No active subscription found. Make sure you're using the Google Play account you subscribed with.", false]);
    expect(deps.confirm).not.toHaveBeenCalled();
  });
  it("reports found but unconfirmed rather than implying ongoing verification", async () => {
    deps.confirm.mockResolvedValue(false);
    expect(await display()).toEqual(["An active subscription was found, but Lastrep hasn't confirmed Premium access yet. Please try again shortly.", false]);
  });
  it("keeps a backend read failure separate from a store failure", async () => {
    deps.confirm.mockRejectedValue(new Error("permission_denied"));
    expect(await display()).toEqual([RESTORE_MESSAGES.unconfirmed, false]);
  });
  it.each(["identity", "request", "result"])("shows exact failure feedback for %s failure", async (kind) => {
    if (kind === "identity") deps.identify.mockRejectedValue(new Error("offline"));
    if (kind === "request") deps.restore.mockRejectedValue(new Error("offline"));
    if (kind === "result") deps.restore.mockResolvedValue({ status: "ERROR", errorCode: "network" });
    expect(await display()).toEqual(["Couldn't restore purchases. Check your connection and try again.", false]);
  });
  it.each(["expired", "unrelated", "otherStore", "missingSubscription"])("does not restore %s entitlement", async (kind) => {
    const info = customer();
    const premium = info.entitlements.active.premium;
    if (kind === "expired") { Object.assign(premium, { isActive: false }); info.activeSubscriptions.length = 0; }
    if (kind === "unrelated") { Object.assign(premium, { productIdentifier: "other_product" }); info.activeSubscriptions[0] = "other_product"; }
    if (kind === "otherStore") { Object.assign(premium, { store: "PROMOTIONAL" }); info.activeSubscriptions.length = 0; }
    if (kind === "missingSubscription") info.activeSubscriptions.length = 0;
    deps.restore.mockResolvedValue({ status: "RESTORED", customerInfo: info });
    expect(await display()).toEqual([RESTORE_MESSAGES.notFound, false]);
  });
  it("does not claim no subscription when a paid product exists but Premium mapping is missing", async () => {
    const info = customer(); delete info.entitlements.active.premium;
    deps.restore.mockResolvedValue({ status: "RESTORED", customerInfo: info });
    expect(await display()).toEqual([RESTORE_MESSAGES.unconfirmed, false]);
  });
  it("explains an independent grant without claiming a paid purchase was restored", async () => {
    deps.confirm.mockResolvedValue("existingAccess");
    expect(await display()).toEqual([RESTORE_MESSAGES.alreadyActive, false]);
  });
  it("explains an independent grant even when the store product lacks Premium mapping", async () => {
    const info = customer(); delete info.entitlements.active.premium;
    deps.restore.mockResolvedValue({ status: "RESTORED", customerInfo: info });
    deps.confirm.mockResolvedValue("existingAccess");
    expect(await display()).toEqual([RESTORE_MESSAGES.alreadyActive, false]);
  });
  it("supports annual subscriptions with base-plan-qualified identifiers", async () => {
    const info = customer();
    Object.assign(info.entitlements.active.premium, { productIdentifier: "lastrep_premium_annual", productPlanIdentifier: "yearly" });
    info.activeSubscriptions[0] = "lastrep_premium_annual:yearly";
    deps.restore.mockResolvedValue({ status: "RESTORED", customerInfo: info });
    expect(await display()).toEqual([RESTORE_MESSAGES.restored, false]);
    expect(deps.confirm).toHaveBeenCalledWith("user", "lastrep_premium_annual:yearly", expect.any(AbortSignal));
  });
  it("ignores repeated taps until the native request settles", async () => {
    const pending = deferred<{ status: "RESTORED"; customerInfo: CustomerInfo }>();
    deps.restore.mockReturnValue(pending.promise);
    const publish = vi.fn(), controller = createRestoreController(deps);
    const first = controller.run("user", publish);
    await Promise.resolve();
    await controller.run("user", publish);
    expect(deps.restore).toHaveBeenCalledTimes(1);
    pending.resolve({ status: "RESTORED", customerInfo: customer() });
    await first;
    expect(publish).toHaveBeenCalledTimes(2);
  });
  it("suppresses results after leaving the screen", async () => {
    const pending = deferred<boolean>();
    deps.confirm.mockReturnValue(pending.promise);
    const publish = vi.fn(), controller = createRestoreController(deps);
    const request = controller.run("user", publish);
    await Promise.resolve(); await Promise.resolve();
    controller.cancel(); pending.resolve(true); await request;
    expect(publish.mock.calls).toEqual([[RESTORE_MESSAGES.loading, true]]);
  });
  it("suppresses old-account results and permits a later new-account request", async () => {
    const pending = deferred<boolean>(); deps.confirm.mockReturnValue(pending.promise);
    const publish = vi.fn(), controller = createRestoreController(deps);
    const request = controller.run("user", publish);
    await Promise.resolve(); await Promise.resolve();
    deps.currentUid.mockReturnValue("other"); pending.resolve(true); await request;
    expect(publish).toHaveBeenCalledTimes(1);
    deps.confirm.mockResolvedValue(true);
    await controller.run("other", publish);
    expect(publish).toHaveBeenLastCalledWith(RESTORE_MESSAGES.restored, false);
  });
  it("does not even identify an already-cancelled or different account", async () => {
    const controller = new AbortController(); controller.abort();
    expect(await runRestoreFlow("user", controller.signal, deps)).toBeNull();
    expect(deps.identify).not.toHaveBeenCalled();
  });
  it("treats a malformed store response as an error, not no purchase", async () => {
    deps.restore.mockResolvedValue({ status: "RESTORED" });
    expect(await display()).toEqual([RESTORE_MESSAGES.failed, false]);
  });
  it("permits retry after a completed no-purchase check", async () => {
    const controller = createRestoreController(deps), publish = vi.fn();
    deps.restore.mockResolvedValueOnce({ status: "RESTORED", customerInfo: customer(false) });
    await controller.run("user", publish);
    await controller.run("user", publish);
    expect(deps.restore).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenLastCalledWith(RESTORE_MESSAGES.restored, false);
  });
});

describe("backend subscription confirmation", () => {
  const paid = () => ({ isSubscribed: true, source: "revenuecat", productId: product, expiresAt: { toMillis: () => Date.now() + 60000 } });
  it("requires a server-confirmed matching paid entitlement", () => {
    expect(isPaidPremiumConfirmed(paid(), product, false)).toBe(true);
    expect(isPaidPremiumConfirmed(paid(), product, true)).toBe(false);
    expect(isPaidPremiumConfirmed(paid(), "other", false)).toBe(false);
    expect(isPaidPremiumConfirmed({ ...paid(), productId: product + ":monthly" }, product, false)).toBe(true);
    expect(isPaidPremiumConfirmed({ ...paid(), productId: product + ":monthly" }, product + ":yearly", false)).toBe(false);
  });
  it("rejects manual grants, expired and inactive access", () => {
    expect(isPaidPremiumConfirmed({ ...paid(), manualGrantPermanent: true }, product, false)).toBe(false);
    expect(isPaidPremiumConfirmed({ ...paid(), expiresAt: { toMillis: () => Date.now() - 1 } }, product, false)).toBe(false);
    expect(isPaidPremiumConfirmed({ ...paid(), isSubscribed: false }, product, false)).toBe(false);
    expect(isPaidPremiumConfirmed({ ...paid(), source: null }, product, false)).toBe(false);
  });
});
