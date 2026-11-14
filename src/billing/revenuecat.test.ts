import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constants: { expoConfig: { android: { package: "com.kjeehwan.lastrep.dev" } } },
  configure: vi.fn(),
  setLogLevel: vi.fn(),
  setLogHandler: vi.fn(),
  restore: vi.fn(),
  invalidate: vi.fn(),
  purchase: vi.fn(),
  policy: { NEW_PURCHASES_ENABLED: false },
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-constants", () => ({ default: mocks.constants }));
vi.mock("react-native-purchases", () => ({
  default: {
    configure: mocks.configure,
    setLogLevel: mocks.setLogLevel,
    setLogHandler: mocks.setLogHandler,
    restorePurchases: mocks.restore,
    invalidateCustomerInfoCache: mocks.invalidate,
    purchasePackage: mocks.purchase,
  },
  LOG_LEVEL: { INFO: "INFO", WARN: "WARN", ERROR: "ERROR" },
}));
vi.mock("./accessPolicy", () => mocks.policy);
vi.mock("../config/billingConfig", () => ({ REVENUECAT_API_KEY_ANDROID: "test-key" }));

describe("RevenueCat build isolation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.policy.NEW_PURCHASES_ENABLED = false;
    mocks.constants.expoConfig.android.package = "com.kjeehwan.lastrep.dev";
  });

  it("blocks beta purchases before configuring or calling the store SDK", async () => {
    mocks.constants.expoConfig.android.package = "com.kjeehwan.lastrep";
    const billing = await import("./revenuecat");
    const result = await billing.purchasePackage({} as Parameters<typeof billing.purchasePackage>[0]);
    expect(result).toEqual({ status: "ERROR", errorCode: "purchases_disabled_during_beta" });
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.purchase).not.toHaveBeenCalled();
  });

  it("retains the purchase flow when a future reviewed policy enables it", async () => {
    mocks.constants.expoConfig.android.package = "com.kjeehwan.lastrep";
    mocks.policy.NEW_PURCHASES_ENABLED = true;
    mocks.purchase.mockResolvedValue({});
    const billing = await import("./revenuecat");
    const selected = {} as Parameters<typeof billing.purchasePackage>[0];
    expect(await billing.purchasePackage(selected)).toEqual({ status: "PURCHASED" });
    expect(mocks.purchase).toHaveBeenCalledExactlyOnceWith(selected);
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
    expect(mocks.invalidate.mock.invocationCallOrder[0]).toBeLessThan(mocks.restore.mock.invocationCallOrder[0]);
    expect(result.status).toBe("RESTORED");
    if (result.status === "RESTORED") expect(result.customerInfo).toBe(info);
  });
});
