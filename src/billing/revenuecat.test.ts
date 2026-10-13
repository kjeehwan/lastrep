import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constants: { expoConfig: { android: { package: "com.kjeehwan.lastrep.dev" } } },
  configure: vi.fn(),
  setLogLevel: vi.fn(),
  setLogHandler: vi.fn(),
  restore: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-constants", () => ({ default: mocks.constants }));
vi.mock("react-native-purchases", () => ({
  default: {
    configure: mocks.configure,
    setLogLevel: mocks.setLogLevel,
    setLogHandler: mocks.setLogHandler,
    restorePurchases: mocks.restore,
  },
  LOG_LEVEL: { INFO: "INFO", WARN: "WARN", ERROR: "ERROR" },
}));
vi.mock("../config/billingConfig", () => ({ REVENUECAT_API_KEY_ANDROID: "test-key" }));

describe("RevenueCat build isolation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.constants.expoConfig.android.package = "com.kjeehwan.lastrep.dev";
  });

  it("recognizes a standalone dev package without relying on __DEV__", async () => {
    const billing = await import("./revenuecat");
    expect(billing.isDevBillingBuild()).toBe(true);
  });

  it("does not initialize billing or sync identity for dev packages", async () => {
    const billing = await import("./revenuecat");
    await billing.initializeRevenueCat();
    await billing.syncRevenueCatIdentity("test-user");
    await billing.syncRevenueCatIdentity(null);
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.setLogHandler).not.toHaveBeenCalled();
  });

  it("blocks explicit dev billing calls before SDK configuration", async () => {
    const billing = await import("./revenuecat");
    await expect(billing.configureRevenueCat()).rejects.toMatchObject({
      code: "dev_billing_unavailable",
    });
    expect(mocks.configure).not.toHaveBeenCalled();
  });

  it("keeps production SDK configuration enabled and idempotent", async () => {
    mocks.constants.expoConfig.android.package = "com.kjeehwan.lastrep";
    const billing = await import("./revenuecat");
    expect(billing.isDevBillingBuild()).toBe(false);
    await billing.initializeRevenueCat();
    await billing.configureRevenueCat();
    expect(mocks.configure).toHaveBeenCalledExactlyOnceWith({ apiKey: "test-key" });
    expect(mocks.setLogHandler).toHaveBeenCalledOnce();
  });
  it("preserves the store response for restore outcome evaluation", async () => {
    mocks.constants.expoConfig.android.package = "com.kjeehwan.lastrep";
    const info = { entitlements: { active: {} }, activeSubscriptions: [] };
    mocks.restore.mockResolvedValue(info);
    const billing = await import("./revenuecat");
    const result = await billing.restorePurchases();
    expect(result.status).toBe("RESTORED");
    if (result.status === "RESTORED") expect(result.customerInfo).toBe(info);
  });
});
