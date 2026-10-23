import { beforeEach, expect, it, vi } from "vitest";
import { acceptHealthSyncConsent, acceptStepsSyncConsent, clearHealthSyncConsent, hasHealthSyncConsent, hasStepsSyncConsent } from "./healthSyncConsent";
const stored = vi.hoisted(() => new Map<string, string>());
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => stored.get(key) ?? null,
  setItem: async (key: string, value: string) => { stored.set(key, value); },
  removeItem: async (key: string) => { stored.delete(key); },
} }));
beforeEach(() => stored.clear());
it("does not silently extend existing health consent to steps", async () => {
  await acceptHealthSyncConsent("a");
  expect(await hasHealthSyncConsent("a")).toBe(true);
  expect(await hasStepsSyncConsent("a")).toBe(false);
});
it("keeps steps consent account-specific and clears it on disconnect", async () => {
  await acceptHealthSyncConsent("a"); await acceptStepsSyncConsent("a");
  expect(await hasStepsSyncConsent("a")).toBe(true);
  expect(await hasStepsSyncConsent("b")).toBe(false);
  await clearHealthSyncConsent("a");
  expect(await hasHealthSyncConsent("a")).toBe(false);
  expect(await hasStepsSyncConsent("a")).toBe(false);
});
