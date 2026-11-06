import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteBodyCompositionEntry, editBodyCompositionEntry, getBodyCompositionProfile,
  saveManualBodyCompositionEntry, syncBodyCompositionFromSamsungHealth,
} from "./bodyComposition";

const harness = vi.hoisted(() => ({ db: null as any }));
vi.mock("../config/firebaseConfig", () => ({ get db() { return harness.db; } }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { setItem: async () => {} } }));
vi.mock("../sleep/sleep", () => ({
  getHealthConnectAvailability: vi.fn(), openHealthConnectAppPermissionsScreen: vi.fn(),
  openHealthConnectDataManagementScreen: vi.fn(),
}));
vi.mock("./samsungHealth", () => ({
  isSamsungHealthBodyCompositionAvailable: async () => true,
  hasSamsungHealthBodyCompositionPermission: async () => true,
  requestSamsungHealthBodyCompositionPermission: vi.fn(),
  readLatestSamsungHealthBodyComposition: async () => ({
    recordedAtMs: Date.parse("2026-11-05T10:00Z"), weightKg: 80, bodyFatPercent: 20,
  }),
}));

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("atomic body-composition persistence", () => {
  let environment: RulesTestEnvironment;
  const uid = "body-owner";
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    environment = await initializeTestEnvironment({
      projectId: "demo-lastrep-body-tests",
      firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") },
    });
  });
  beforeEach(async () => {
    await environment.clearFirestore();
    harness.db = environment.authenticatedContext(uid).firestore();
    await setDoc(doc(harness.db, "users", uid), { nickname: "Synthetic body test" });
  });
  afterAll(async () => environment?.cleanup());

  it("retains concurrent partial manual entries and their latest snapshot fields", async () => {
    await Promise.all([
      saveManualBodyCompositionEntry(uid, { weightKg: 81 }, new Date("2026-11-06T10:00Z")),
      saveManualBodyCompositionEntry(uid, { bodyFatPercent: 19 }, new Date("2026-11-06T10:01Z")),
    ]);
    const profile = await getBodyCompositionProfile(uid);
    expect(profile.history).toHaveLength(2);
    expect(profile.manual).toMatchObject({ weightKg: 81, bodyFatPercent: 19 });
    expect(profile.history.some(row => row.weightKg === 81 && row.bodyFatPercent === null)).toBe(true);
    expect(profile.history.some(row => row.weightKg === null && row.bodyFatPercent === 19)).toBe(true);
  });

  it("preserves a simultaneous edit while adding a measurement", async () => {
    await saveManualBodyCompositionEntry(uid, { weightKg: 80 }, new Date("2026-11-04T10:00Z"));
    const original = (await getBodyCompositionProfile(uid)).history[0];
    await Promise.all([
      editBodyCompositionEntry(uid, original, { weightKg: 79 }),
      saveManualBodyCompositionEntry(uid, { bodyFatPercent: 18 }, new Date("2026-11-06T10:00Z")),
    ]);
    const profile = await getBodyCompositionProfile(uid);
    expect(profile.history).toHaveLength(2);
    expect(profile.history.find(row => row.recordedAt?.isEqual(original.recordedAt!))?.weightKg).toBe(79);
  });

  it("does not restore a deleted entry when an import overlaps deletion", async () => {
    await saveManualBodyCompositionEntry(uid, { weightKg: 79 }, new Date("2026-11-04T10:00Z"));
    const original = (await getBodyCompositionProfile(uid)).history[0];
    await Promise.all([
      deleteBodyCompositionEntry(uid, original),
      syncBodyCompositionFromSamsungHealth(uid, new Date("2026-11-06T10:00Z")),
    ]);
    const profile = await getBodyCompositionProfile(uid);
    expect(profile.history).toHaveLength(1);
    expect(profile.history[0]).toMatchObject({ source: "health", weightKg: 80 });
  });

  it("imports one provider snapshot once under concurrent retries and retains a manual entry", async () => {
    const results = await Promise.all([
      syncBodyCompositionFromSamsungHealth(uid, new Date("2026-11-06T10:00Z")),
      syncBodyCompositionFromSamsungHealth(uid, new Date("2026-11-06T10:01Z")),
      saveManualBodyCompositionEntry(uid, { weightKg: 82 }, new Date("2026-11-06T10:02Z")),
    ]);
    expect(results.slice(0, 2).map(result => result!.status).sort()).toEqual(["success", "unchanged"]);
    const profile = await getBodyCompositionProfile(uid);
    expect(profile.history).toHaveLength(2);
    expect(profile.manual.weightKg).toBe(82);
    expect(profile.synced.weightKg).toBe(80);
    expect(profile.lastSyncedAt).toBeInstanceOf(Timestamp);
    expect((await getDoc(doc(harness.db, "users", uid))).data()?.nickname).toBe("Synthetic body test");
  });
});
