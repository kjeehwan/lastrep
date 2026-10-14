import { expect, it } from "vitest";
import { shouldRefreshSleep } from "./sleepRefreshGate";

it("waits for authentication without suppressing the first authenticated load", () => {
  expect(shouldRefreshSleep(null, null, 100_000)).toBe(false);
  expect(shouldRefreshSleep("user", null, 100_001)).toBe(true);
});

it("throttles only the same account and allows refresh after thirty seconds", () => {
  const previous = { uid: "user", atMs: 100_000 };
  expect(shouldRefreshSleep("user", previous, 100_001)).toBe(false);
  expect(shouldRefreshSleep("user", previous, 130_000)).toBe(true);
  expect(shouldRefreshSleep("other", previous, 100_001)).toBe(true);
});
