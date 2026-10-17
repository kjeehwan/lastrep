import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSleepJournal, legacySleepEntries, mutateSleepJournal } from "./sleepJournal";
import { commitManualSleep, emptySleepEntry, HOUR_MS, removeSleepEntry, type SleepEntry } from "./sleepSessionModel";
import { providerSleepEntry, reconcileHealthSleep } from "./healthSleepImport";
vi.mock("../config/firebaseConfig", () => ({ db: null }));

it("migrates known legacy daily dates without inventing session times", () => {
  const recordedAt = Timestamp.fromMillis(100);
  const rows = legacySleepEntries({ sleepProfile: { recentNightlyHours: [{ dateKey: "2026-10-17", sleepHours: 7.5, source: "health", recordedAt }] } });
  expect(rows[0]).toMatchObject({ kind: "legacy", startMs: null, endMs: null, hours: 7.5, recordedAtMs: 100 });
  expect(legacySleepEntries({ sleepProfile: { latestSleepHours: 7.5, source: "manual" } })[0]).toMatchObject({ dateKey: "undated", kind: "legacy", hours: 7.5 });
  expect(legacySleepEntries({ sleepProfile: { journalRevision: 1, recentNightlyHours: [{ dateKey: "2026-10-17", sleepHours: 7.5 }] } })).toEqual([]);
});

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!emulator)("sleep journal persistence", () => {
  let env: RulesTestEnvironment;
  let database: Firestore;
  const now = new Date("2026-10-17T10:00Z");
  const manual = (id: string, from: string, to: string): SleepEntry => ({ ...emptySleepEntry(id, "2026-10-17", (Date.parse(to) - Date.parse(from)) / HOUR_MS, now), kind: "session", startMs: Date.parse(from), endMs: Date.parse(to) });
  beforeAll(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({ projectId: "lastrep-sleep-journal-tests", firestore: { host, port: Number(port), rules: readFileSync(join(process.cwd(), "firestore.rules"), "utf8") } });
    database = env.authenticatedContext("alice").firestore() as unknown as Firestore;
  });
  beforeEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });
  it("saves split sessions, reloads and updates the compatibility total atomically", async () => {
    const a = manual("one", "2026-10-16T23:00Z", "2026-10-17T03:00Z"), b = manual("two", "2026-10-17T04:00Z", "2026-10-17T07:00Z");
    const syncTime = Timestamp.fromMillis(100);
    await setDoc(doc(database, "users", "alice"), { sleepProfile: { lastSyncedAt: syncTime } });
    await mutateSleepJournal("alice", (rows) => commitManualSleep(rows, a, null), {}, database);
    await mutateSleepJournal("alice", (rows) => commitManualSleep(rows, b, null), {}, database);
    expect((await getSleepJournal("alice", database)).entries).toHaveLength(2);
    const profile = (await getDoc(doc(database, "users", "alice"))).data()!.sleepProfile;
    expect(profile.latestSleepHours).toBe(7); expect(profile.recentNightlyHours[0].sleepHours).toBe(7);
    expect(profile.journalSummary.latestSleepHours).toBe(7);
    expect(profile.lastSyncedAt.toMillis()).toBe(100);
  });
  it("serializes concurrent additions without losing either entry", async () => {
    const a = manual("one", "2026-10-16T23:00Z", "2026-10-17T03:00Z"), b = manual("two", "2026-10-17T04:00Z", "2026-10-17T07:00Z");
    await Promise.all([mutateSleepJournal("alice", (rows) => commitManualSleep(rows, a, null), {}, database), mutateSleepJournal("alice", (rows) => commitManualSleep(rows, b, null), {}, database)]);
    expect((await getSleepJournal("alice", database)).entries).toHaveLength(2);
    expect((await getDoc(doc(database, "users", "alice"))).data()!.sleepProfile.latestSleepHours).toBe(7);
  });
  it("physically deletes manual entries and updates totals without reviving legacy history", async () => {
    const a = manual("one", "2026-10-16T23:00Z", "2026-10-17T03:00Z"), b = manual("two", "2026-10-17T04:00Z", "2026-10-17T07:00Z");
    await mutateSleepJournal("alice", () => [a, b], {}, database);
    await mutateSleepJournal("alice", (rows) => removeSleepEntry(rows, a), {}, database);
    expect((await getDoc(doc(database, "users", "alice", "sleepSessions", a.id))).exists()).toBe(false);
    expect((await getSleepJournal("alice", database)).entries).toEqual([b]);
    expect((await getDoc(doc(database, "users", "alice"))).data()!.sleepProfile.latestSleepHours).toBe(3);
    await mutateSleepJournal("alice", (rows) => removeSleepEntry(rows, b), {}, database);
    expect((await getSleepJournal("alice", database)).entries).toEqual([]);
    expect((await getDoc(doc(database, "users", "alice"))).data()!.sleepProfile.latestSleepHours).toBeNull();
  });
  it("keeps excluded imports persisted and cannot accidentally hard-delete them", async () => {
    const health = providerSleepEntry({ startTime: "2026-10-16T23:00Z", endTime: "2026-10-17T07:00Z", metadata: { id: "excluded", dataOrigin: "tracker" } }, "device");
    await mutateSleepJournal("alice", () => [health], {}, database);
    await expect(mutateSleepJournal("alice", () => [], {}, database)).rejects.toThrow("must be excluded");
    await mutateSleepJournal("alice", (rows) => removeSleepEntry(rows, health), {}, database);
    await mutateSleepJournal("alice", (rows) => reconcileHealthSleep(rows, [health], [], "device"), {}, database);
    expect((await getSleepJournal("alice", database)).entries[0].excluded).toBe(true);
    expect((await getDoc(doc(database, "users", "alice"))).data()!.sleepProfile.latestSleepHours).toBeNull();
  });
  it("persists manual corrections and exclusions through repeated imports", async () => {
    const health = providerSleepEntry({ startTime: "2026-10-16T23:00Z", endTime: "2026-10-17T07:00Z", metadata: { id: "provider-1", dataOrigin: "tracker" } }, "device");
    const sync = () => mutateSleepJournal("alice", (rows) => reconcileHealthSleep(rows, [health], [], "device"), { syncedAt: now }, database);
    await sync();
    await mutateSleepJournal("alice", (rows) => commitManualSleep(rows, emptySleepEntry("fix", "2026-10-17", 7, now), health.id), {}, database);
    await sync(); await sync();
    const journal = await getSleepJournal("alice", database);
    expect(journal.entries).toHaveLength(2);
    expect(journal.entries.find((entry) => entry.id === health.id)?.excluded).toBe(true);
    expect(journal.profile.latestSleepHours).toBe(7);
  });
  it("leaves records untouched when authorization is revoked", async () => {
    await expect(mutateSleepJournal("alice", () => [], { authorize: async () => { throw Error("revoked"); } }, database)).rejects.toThrow("revoked");
    expect((await getDoc(doc(database, "users", "alice"))).exists()).toBe(false);
  });
});
