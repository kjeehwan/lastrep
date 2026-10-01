import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      android: {
        package: "com.kjeehwan.lastrep.dev",
      },
    },
  },
}));

vi.mock("@react-native-firebase/app", () => ({
  getApp: () => ({
    options: {
      projectId: "lastrep-test",
      appId: "1:123:android:test",
      measurementId: "G-TEST",
    },
    automaticDataCollectionEnabled: true,
  }),
}));

vi.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: () => ({ appName: "lastrep-test" }),
  getAppInstanceId: vi.fn(async () => "instance-id"),
  logEvent: vi.fn(async () => undefined),
  setAnalyticsCollectionEnabled: vi.fn(async () => undefined),
}));

vi.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}));
const { getUidPrefix, sanitizeAnalyticsParams } = await import("./analytics");

describe("analytics helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes unavailable params", () => {
    expect(
      sanitizeAnalyticsParams({
        source_screen: "settings",
        reason_code: "",
        latency_ms: undefined,
        uid_prefix: null,
      })
    ).toEqual({
      source_screen: "settings",
    });
  });

  it("preserves valid primitive params", () => {
    expect(
      sanitizeAnalyticsParams({
        purchase_started: true,
        latency_ms: 1234,
        package_id: "$rc_annual",
      })
    ).toEqual({
      purchase_started: true,
      latency_ms: 1234,
      package_id: "$rc_annual",
    });
  });

  it("returns an 8 character uid prefix", () => {
    expect(getUidPrefix("abcdefgh123456")).toBe("abcdefgh");
    expect(getUidPrefix("short")).toBe("short");
    expect(getUidPrefix(null)).toBeUndefined();
  });
});
