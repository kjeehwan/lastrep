import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { isCurrentSteps, localStepsWindow, parseDailySteps } from "./dailyStepsModel";

const fake = vi.hoisted(() => ({
  auth: { currentUser: { uid: "a" } as { uid: string } | null },
  consent: true, stepsConsent: true, permission: true, available: "available",
  app: { currentState: "active" },
  storage: new Map<string, string>(), aggregate: vi.fn(), records: vi.fn(), save: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, AppState: fake.app }));
vi.mock("../config/firebaseConfig", () => ({ auth: fake.auth, db: {} }));
vi.mock("../sleep/sleep", () => ({ getHealthConnectAvailability: async () => fake.available }));
vi.mock("./healthSyncConsent", () => ({ hasHealthSyncConsent: async () => fake.consent, hasStepsSyncConsent: async () => fake.stepsConsent }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => fake.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { fake.storage.set(key, value); },
  removeItem: async (key: string) => { fake.storage.delete(key); },
} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, uid: string) => ({ collection, uid }),
  getDocFromCache: async () => ({ data: () => ({}) }), setDoc: (...args: unknown[]) => fake.save(...args),
}));
vi.mock("react-native-health-connect", () => ({
  initialize: async () => true,
  getGrantedPermissions: async () => fake.permission ? [{ accessType: "read", recordType: "Steps" }] : [],
  aggregateRecord: (...args: unknown[]) => fake.aggregate(...args),
  readRecords: (...args: unknown[]) => fake.records(...args),
}));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 23, 12));
  fake.auth.currentUser = { uid: "a" }; fake.consent = true; fake.stepsConsent = true;
  fake.permission = true; fake.available = "available"; fake.app.currentState = "active";
  fake.storage.clear(); fake.aggregate.mockResolvedValue({ COUNT_TOTAL: 1234, dataOrigins: ["source"] });
  fake.records.mockResolvedValue({ records: [] }); fake.save.mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const service = () => import("./dailySteps");

it("uses local midnight across daylight-saving changes without a fixed 24-hour offset", () => {
  vi.stubEnv("TZ", "America/New_York");
  expect(localStepsWindow(new Date("2026-03-08T16:00:00Z")).startTime).toBe("2026-03-08T05:00:00.000Z");
  expect(localStepsWindow(new Date("2026-03-08T16:00:00Z")).endTime).toBe("2026-03-09T04:00:00.000Z");
  expect(localStepsWindow(new Date("2026-11-01T17:00:00Z")).startTime).toBe("2026-11-01T04:00:00.000Z");
  expect(localStepsWindow(new Date("2026-11-01T17:00:00Z")).endTime).toBe("2026-11-02T05:00:00.000Z");
});

it("uses the local calendar midnight and rejects malformed snapshots", () => {
  const now = new Date(2026, 9, 23, 12, 15);
  const w = localStepsWindow(now);
  expect(new Date(w.startTime).getHours()).toBe(0);
  expect(new Date(w.startTime).getDate()).toBe(now.getDate());
  expect(new Date(w.endTime)).toEqual(new Date(2026, 9, 24));
  expect(w.dateKey).toBe("2026-10-23");
  const s = { dateKey: w.dateKey, timeZone: w.timeZone, steps: 0, asOfMs: now.getTime() };
  expect(parseDailySteps(s)).toEqual(s);
  expect(parseDailySteps({ ...s, steps: null })?.steps).toBeNull();
  for (const patch of [{ dateKey: "2026-02-31" }, { steps: -1 }, { steps: 1.5 }, { asOfMs: NaN }, { timeZone: "" }]) {
    expect(parseDailySteps({ ...s, ...patch })).toBeNull();
  }
  expect(isCurrentSteps(s, now)).toBe(true);
  expect(isCurrentSteps(s, new Date(2026, 9, 24))).toBe(false);
  expect(isCurrentSteps({ ...s, timeZone: "other" }, now)).toBe(false);
});

it("reads the full daily total when a provider's record extends beyond the current time", async () => {
  // Synthetic provider: its running total is recorded over the whole day.
  // Health Connect proportionally scales counts if the query cuts the interval.
  const start = new Date(2026, 9, 23).getTime();
  const end = new Date(2026, 9, 24).getTime();
  fake.aggregate.mockImplementation(async ({ timeRangeFilter }) => {
    const overlap = Math.max(0, Math.min(Date.parse(timeRangeFilter.endTime), end) - Math.max(Date.parse(timeRangeFilter.startTime), start));
    return { COUNT_TOTAL: Math.round(1440 * overlap / (end - start)), dataOrigins: ["synthetic-daily-source"] };
  });
  const state = await (await service()).refreshDailySteps("a", true, true);
  expect(state.snapshot?.steps).toBe(1440);
  expect(state.snapshot?.asOfMs).toBe(Date.now());
});

it("uses the aggregate instead of summing overlapping raw records and replaces corrected totals", async () => {
  const { refreshDailySteps } = await service();
  expect((await refreshDailySteps("a", true)).snapshot?.steps).toBe(1234);
  expect(fake.aggregate).toHaveBeenCalledWith({ recordType: "Steps", timeRangeFilter: { operator: "between", ...Object.fromEntries(Object.entries(localStepsWindow()).filter(([k]) => k.endsWith("Time"))) } });
  expect(fake.records).not.toHaveBeenCalled();
  fake.aggregate.mockResolvedValue({ COUNT_TOTAL: 900, dataOrigins: ["source"] });
  expect((await refreshDailySteps("a", true, true)).snapshot?.steps).toBe(900);
  expect(fake.save).toHaveBeenLastCalledWith({ collection: "users", uid: "a" }, { dailySteps: expect.objectContaining({ steps: 900 }) }, { merge: true });
});

it.each([false, true])("distinguishes missing records from an explicit zero (record exists=%s)", async exists => {
  fake.aggregate.mockResolvedValue({ COUNT_TOTAL: 0, dataOrigins: [] });
  fake.records.mockResolvedValue({ records: exists ? [{ count: 0 }] : [] });
  const result = await (await service()).refreshDailySteps("a", true);
  expect(result.snapshot?.steps).toBe(exists ? 0 : null);
  expect(fake.records.mock.calls[0][1].pageSize).toBe(1);
});

it.each(["consent", "stepsConsent", "permission", "available", "offline", "background"])("does not read steps without %s eligibility", async condition => {
  if (condition === "consent") fake.consent = false;
  if (condition === "stepsConsent") fake.stepsConsent = false;
  if (condition === "permission") fake.permission = false;
  if (condition === "available") fake.available = "unsupported";
  if (condition === "background") fake.app.currentState = "background";
  await (await service()).refreshDailySteps("a", condition !== "offline");
  expect(fake.aggregate).not.toHaveBeenCalled(); expect(fake.save).not.toHaveBeenCalled();
});

it("retains dated cached values offline and never borrows another account's snapshot", async () => {
  const { refreshDailySteps } = await service();
  const original = (await refreshDailySteps("a", true)).snapshot;
  vi.setSystemTime(new Date(2026, 9, 24, 12));
  expect(await refreshDailySteps("a", false)).toMatchObject({ status: "offline", snapshot: original });
  fake.auth.currentUser = { uid: "b" };
  expect((await refreshDailySteps("b", false)).snapshot).toBeNull();
});

it.each(["disconnect", "revoke", "switch", "midnight", "background"])("discards an in-flight read after %s", async change => {
  let resolve!: (value: unknown) => void;
  fake.aggregate.mockImplementation(() => new Promise(r => { resolve = r; }));
  const { refreshDailySteps, getDailyStepsState } = await service();
  const pending = refreshDailySteps("a", true);
  for (let i = 0; i < 50 && !resolve; i++) await Promise.resolve();
  expect(resolve).toBeDefined();
  if (change === "disconnect") fake.consent = false;
  if (change === "revoke") fake.permission = false;
  if (change === "switch") fake.auth.currentUser = { uid: "b" };
  if (change === "midnight") vi.setSystemTime(new Date(2026, 9, 24, 0, 1));
  if (change === "background") fake.app.currentState = "background";
  resolve({ COUNT_TOTAL: 321, dataOrigins: ["source"] }); await pending;
  expect(fake.save).not.toHaveBeenCalled(); expect(getDailyStepsState("a").snapshot).toBeNull();
});

it("keeps the local read if account persistence fails and retries later", async () => {
  fake.save.mockRejectedValueOnce(new Error("connection lost"));
  const { refreshDailySteps, getDailyStepsState } = await service();
  await refreshDailySteps("a", true); await Promise.resolve();
  expect(getDailyStepsState("a")).toMatchObject({ snapshot: { steps: 1234 }, saveError: true });
  expect(fake.storage.size).toBe(1);
  await refreshDailySteps("a", true);
  expect(getDailyStepsState("a").saveError).toBe(false);
});

it("throttles foreground refreshes but allows an explicit sync and a new day", async () => {
  const { refreshDailySteps } = await service();
  await refreshDailySteps("a", true); await refreshDailySteps("a", true);
  expect(fake.aggregate).toHaveBeenCalledTimes(1);
  await refreshDailySteps("a", true, true); expect(fake.aggregate).toHaveBeenCalledTimes(2);
  vi.setSystemTime(new Date(2026, 9, 24, 0, 1));
  expect((await refreshDailySteps("a", true)).snapshot?.dateKey).toBe("2026-10-24");
  expect(fake.aggregate).toHaveBeenCalledTimes(3);
});

it("refreshes a cached snapshot whose timestamp is ahead of this device's clock", async () => {
  const window = localStepsWindow();
  fake.storage.set("dailyStepsSnapshot:v1:a", JSON.stringify({
    dateKey: window.dateKey, timeZone: window.timeZone, steps: 9999, asOfMs: Date.now() + 300_000,
  }));
  expect((await (await service()).refreshDailySteps("a", true)).snapshot?.steps).toBe(1234);
  expect(fake.aggregate).toHaveBeenCalledTimes(1);
});

it("removes the local snapshot after account deletion and prevents later reads", async () => {
  const { refreshDailySteps, clearDailySteps, getDailyStepsState } = await service();
  await refreshDailySteps("a", true);
  await clearDailySteps("a");
  expect(fake.storage.size).toBe(0);
  expect(getDailyStepsState("a").snapshot).toBeNull();
  await refreshDailySteps("a", true, true);
  expect(fake.aggregate).toHaveBeenCalledTimes(1);
});
