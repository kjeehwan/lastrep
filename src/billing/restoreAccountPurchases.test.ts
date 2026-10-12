import { beforeEach, describe, expect, it, vi } from "vitest";
import { restoreAccountPurchases } from "./restoreAccountPurchases";

const mocks = vi.hoisted(() => ({ login: vi.fn(), restore: vi.fn(), sync: vi.fn() }));
vi.mock("./revenuecat", () => ({
  ensureRevenueCatLoggedIn: mocks.login,
  restorePurchases: mocks.restore,
  syncRevenueCatPurchases: mocks.sync,
}));

describe("settings purchase restoration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.restore.mockResolvedValue({ status: "RESTORED" });
  });
  it("identifies the signed-in account before restoring and syncing", async () => {
    await restoreAccountPurchases("account-1");
    expect(mocks.login).toHaveBeenCalledWith("account-1");
    expect(mocks.login.mock.invocationCallOrder[0]).toBeLessThan(mocks.restore.mock.invocationCallOrder[0]);
    expect(mocks.restore.mock.invocationCallOrder[0]).toBeLessThan(mocks.sync.mock.invocationCallOrder[0]);
  });
  it("does not report completion when restoring fails", async () => {
    mocks.restore.mockResolvedValue({ status: "ERROR", errorCode: "network" });
    await expect(restoreAccountPurchases("account-1")).rejects.toThrow("network");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("does not restore when account identification fails", async () => {
    mocks.login.mockRejectedValue(new Error("identity_failed"));
    await expect(restoreAccountPurchases("account-1")).rejects.toThrow("identity_failed");
    expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("reports a verification failure if the follow-up sync fails", async () => {
    mocks.sync.mockRejectedValue(new Error("sync_failed"));
    await expect(restoreAccountPurchases("account-1")).rejects.toThrow("sync_failed");
  });
});
