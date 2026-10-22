import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import { autoSyncBodyCompositionFromHealthConnectIfEligible, autoSyncBodyCompositionFromSamsungHealthIfEligible, syncBodyCompositionFromHealthConnect, syncBodyCompositionFromSamsungHealth } from "./bodyComposition";

const fake = vi.hoisted(() => ({
  body: {} as Record<string, unknown>, storage: new Map<string, string>(),
  records: {} as Record<string, Record<string, unknown>[]>,
  samsung: null as Record<string, unknown> | null,
  read: vi.fn(), write: vi.fn(), samsungRead: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "android", Version: 34 } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => fake.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { fake.storage.set(key, value); },
} }));
vi.mock("../config/firebaseConfig", () => ({ db: {} }));
vi.mock("../health/healthSyncConsent", () => ({ hasHealthSyncConsent: async () => true }));
vi.mock("../sleep/sleep", () => ({ getHealthConnectAvailability: async () => "available", openHealthConnectAppPermissionsScreen: vi.fn(), openHealthConnectDataManagementScreen: vi.fn() }));
vi.mock("firebase/firestore", async (original) => ({
  ...await original<typeof import("firebase/firestore")>(),
  doc: () => ({}), getDoc: async () => ({ data: () => ({ bodyCompositionProfile: fake.body }) }),
  setDoc: (...args: unknown[]) => fake.write(...args),
}));
vi.mock("react-native-health-connect", () => ({ initialize: async () => true,
  getGrantedPermissions: async () => ["Weight", "BodyFat", "LeanBodyMass"].map(recordType => ({ accessType: "read", recordType })),
  readRecords: (type: string) => fake.read(type),
}));
vi.mock("./samsungHealth", () => ({ isSamsungHealthBodyCompositionAvailable: async () => true,
  hasSamsungHealthBodyCompositionPermission: async () => true,
  requestSamsungHealthBodyCompositionPermission: vi.fn(),
  readLatestSamsungHealthBodyComposition: () => fake.samsungRead(),
}));
const recorded = "2026-10-21T10:00:00.000Z";
const first = new Date("2026-10-22T10:00:00Z");
const second = new Date("2026-10-22T10:01:00Z");
beforeEach(() => {
  vi.clearAllMocks(); fake.body = {}; fake.storage.clear();
  const metadata = { dataOrigin: "com.sec.android.app.shealth" };
  fake.records = {
    Weight: [{ time: recorded, weight: { inKilograms: 80 }, metadata }],
    BodyFat: [{ time: recorded, percentage: 20, metadata }],
    LeanBodyMass: [{ time: recorded, mass: { inKilograms: 64 }, metadata }],
  };
  fake.samsung = { recordedAtMs: Date.parse(recorded), weightKg: 80, bodyFatPercent: 20, fatFreeMassKg: 64 };
  fake.read.mockImplementation(async (type: string) => ({ records: fake.records[type] }));
  fake.samsungRead.mockImplementation(async () => fake.samsung);
  fake.write.mockImplementation(async (_ref: unknown, data: { bodyCompositionProfile: Record<string, unknown> }) => {
    fake.body = { ...fake.body, ...data.bodyCompositionProfile };
  });
});
afterEach(() => vi.restoreAllMocks());

it.each(["health-connect", "samsung-health"])("does not reimport unchanged %s measurements or advance the timestamp", async provider => {
  const sync = provider === "health-connect" ? syncBodyCompositionFromHealthConnect : syncBodyCompositionFromSamsungHealth;
  expect((await sync("user", first)).status).toBe("success");
  const before = { ...fake.body };
  expect((await sync("user", second)).status).toBe("no_data");
  expect(fake.write).toHaveBeenCalledTimes(1);
  expect(fake.body.lastSyncedAt).toBe(before.lastSyncedAt);
  expect(fake.body.history).toBe(before.history);
  expect(fake.storage.get(`body-last-check:${provider}:user`)).toBe(second.toISOString());
});

it.each(["health-connect", "samsung-health"])("imports a newer %s measurement even when its values match", async provider => {
  const sync = provider === "health-connect" ? syncBodyCompositionFromHealthConnect : syncBodyCompositionFromSamsungHealth;
  await sync("user", first);
  if (provider === "health-connect") fake.records.Weight[0].time = "2026-10-21T11:00:00Z";
  else fake.samsung!.recordedAtMs = Date.parse("2026-10-21T11:00:00Z");
  expect((await sync("user", second)).status).toBe("success");
  expect((fake.body.lastSyncedAt as Timestamp).toMillis()).toBe(second.getTime());
});

it("detects a new per-metric timestamp even below another metric's latest timestamp", async () => {
  fake.records.BodyFat[0].time = "2026-10-21T08:00:00Z";
  await syncBodyCompositionFromHealthConnect("user", first);
  fake.records.BodyFat[0].time = "2026-10-21T09:00:00Z";
  expect((await syncBodyCompositionFromHealthConnect("user", second)).status).toBe("success");
});

it.each(["health-connect", "samsung-health"])("imports corrections to %s values at the existing measurement time", async provider => {
  const sync = provider === "health-connect" ? syncBodyCompositionFromHealthConnect : syncBodyCompositionFromSamsungHealth;
  await sync("user", first);
  if (provider === "health-connect") fake.records.BodyFat[0].percentage = 21;
  else fake.samsung!.bodyFatPercent = 21;
  expect((await sync("user", second)).status).toBe("success");
  expect((fake.body.synced as { bodyFatPercent: number }).bodyFatPercent).toBe(21);
});

it.each(["health-connect", "samsung-health"])("does not invent new %s measurements when the provider omits timestamps", async provider => {
  const sync = provider === "health-connect" ? syncBodyCompositionFromHealthConnect : syncBodyCompositionFromSamsungHealth;
  if (provider === "health-connect") Object.values(fake.records).forEach(rows => { delete rows[0].time; });
  else delete fake.samsung!.recordedAtMs;
  await sync("user", first);
  expect((await sync("user", second)).status).toBe("no_data");
  expect(fake.write).toHaveBeenCalledTimes(1);
});

it("baselines an existing profile without rewriting history or last-sync time", async () => {
  await syncBodyCompositionFromHealthConnect("user", first);
  delete fake.body.importFingerprint; fake.write.mockClear();
  const previous = { ...fake.body };
  expect((await syncBodyCompositionFromHealthConnect("user", second)).status).toBe("no_data");
  expect(Object.keys(fake.write.mock.calls[0][1].bodyCompositionProfile)).toEqual(["importFingerprint"]);
  expect(fake.body.lastSyncedAt).toBe(previous.lastSyncedAt);
  expect(fake.body.history).toBe(previous.history);
});

it("throttles successful empty checks separately while allowing an explicit retry", async () => {
  Object.keys(fake.records).forEach(type => { fake.records[type] = []; });
  expect((await syncBodyCompositionFromHealthConnect("user", first)).status).toBe("no_data");
  expect(fake.write).not.toHaveBeenCalled(); fake.read.mockClear();
  vi.spyOn(Date, "now").mockReturnValue(second.getTime());
  expect(await autoSyncBodyCompositionFromHealthConnectIfEligible("user")).toBe("skipped");
  expect(fake.read).not.toHaveBeenCalled();
  await syncBodyCompositionFromHealthConnect("user", second);
  expect(fake.read).toHaveBeenCalledTimes(3);
});

it("also throttles unchanged Samsung checks without advancing the import timestamp", async () => {
  await syncBodyCompositionFromSamsungHealth("user", first);
  await syncBodyCompositionFromSamsungHealth("user", second);
  fake.samsungRead.mockClear();
  vi.spyOn(Date, "now").mockReturnValue(second.getTime());
  expect(await autoSyncBodyCompositionFromSamsungHealthIfEligible("user")).toBe("skipped");
  expect(fake.samsungRead).not.toHaveBeenCalled();
  expect((fake.body.lastSyncedAt as Timestamp).toMillis()).toBe(first.getTime());
});

it("does not mark a failed import as a successful check", async () => {
  fake.write.mockRejectedValueOnce(new Error("Write failed"));
  expect((await syncBodyCompositionFromHealthConnect("user", first)).status).toBe("error");
  expect(fake.storage.has("body-last-check:health-connect:user")).toBe(false);
  expect(fake.body.lastSyncedAt).toBeUndefined();
});

it("does not treat a changed invalid metric as a new imported measurement", async () => {
  fake.records.BodyFat[0].percentage = 200;
  await syncBodyCompositionFromHealthConnect("user", first);
  fake.records.BodyFat[0].time = "2026-10-21T11:00:00Z";
  expect((await syncBodyCompositionFromHealthConnect("user", second)).status).toBe("no_data");
  expect(fake.write).toHaveBeenCalledTimes(1);
});
