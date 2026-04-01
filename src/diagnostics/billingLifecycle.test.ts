import { describe, expect, it } from "vitest";
import {
  buildBillingLifecyclePayload,
  sanitizeBillingLifecycleParams,
} from "./billingLifecycle";

describe("billing lifecycle diagnostics", () => {
  it("removes unavailable params", () => {
    expect(
      sanitizeBillingLifecycleParams({
        source_screen: "settings",
        reason_code: "",
        error_code: undefined,
        uid_prefix: null,
      })
    ).toEqual({
      source_screen: "settings",
    });
  });

  it("builds a structured payload with sanitized params", () => {
    expect(
      buildBillingLifecyclePayload(
        "purchase_result",
        {
          result_status: "purchased",
          latency_ms: 2450,
          error_code: "",
        },
        "2026-03-30T00:00:00.000Z"
      )
    ).toEqual({
      event: "purchase_result",
      timestamp: "2026-03-30T00:00:00.000Z",
      result_status: "purchased",
      latency_ms: 2450,
    });
  });
});
