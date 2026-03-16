import { describe, expect, it } from "vitest";
import { getUidPrefix, sanitizeAnalyticsParams } from "./analytics";

describe("analytics helper", () => {
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
