import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, writeBatch, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSleepCommand, getSleepJournal, legacySleepEntries, mutateSleepJournal } from "./sleepJournal";
import { getSleepJournalWindow } from "./sleepJournalWindow";
import { commitManualSleep, deriveSleepDays, emptySleepEntry, HOUR_MS, removeSleepEntry, shiftSleepDate, type SleepEntry } from "./sleepSessionModel";
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
describe.skipIf(!emulator)("sleep journal persistence", { timeout: 30_000 }, () => {
  let env: RulesTestEnvironment;
  let database: Firestore;
  const now = new Date("2026-10-17T10:00Z");
  const manual = (id: string, from: string, to: string): SleepEntry => ({ ...emptySleepEntry(id, "2026-10-17", (Date.parse(to) - Date.parse(from)) / HOUR_MS, now), kind: "session", startMs: Date.parse(from), endMs: Date.parse(to) });
  beforeAll(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({ projectId: "demo-lastrep-sleep-journal-tests", firestore: { host, port: Number(port), rules: readFileSync(join(process.cwd(), "firestore.rules"), "utf8") } });
    database = env.authenticatedContext("alice").firestore() as unknown as Firestore;
  });
  beforeEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });
  it.each([30, 365, 1825])("keeps initial display reads independent of %i unrelated historical dates", async count => {
    const rows = Array.from({ length: count }, (_, n) => emptySleepEntry(`dated-${n}`, shiftSleepDate("2020-01-01", n), 7, now));
    // Fixture setup bypasses rules; measured reads still use the authenticated client.
    await env.withSecurityRulesDisabled(async context => {
      const fixture = context.firestore() as unknown as Firestore;
      for (let offset = 0; offset < rows.length; offset += 400) {
        const batch = writeBatch(fixture);
        for (const entry of rows.slice(offset, offset + 400)) batch.set(doc(fixture, "users", "alice", "sleepSessions", entry.id), entry);
        await batch.commit();
      }
      await setDoc(doc(fixture, "users", "alice"), { sleepProfile: { journalRevision: 1, journalSummary: {
        recentNightlyHours: rows.slice(-30).reverse().map(row => ({ dateKey: row.dateKey, sleepHours: row.hours })),
      } } });
    });
    const start = performance.now();
    const result = await getSleepJournalWindow("alice", null, database);
    const elapsedMs = Math.round(performance.now() - start);
    expect(result.fallback).toBeNull();
    expect(result.readCounts.documents).toBe(14);
    expect(result.entries).toHaveLength(14);
    expect(result.readCounts.queries).toBe(4);
    console.info("sleep display benchmark", JSON.stringify({ history: count, ...result.readCounts, derivedEntries: result.entries.length, elapsedMs }));
  });
  it("reads a sparse old window without loading unrelated history and keeps the latest recorded initial date", async () => {
    const rows = Array.from({ length: 40 }, (_, n) => emptySleepEntry(`old-${n}`, shiftSleepDate("2020-01-01", n), 7, now));
    await mutateSleepJournal("alice", () => rows, {}, database);
    const result = await getSleepJournalWindow("alice", null, database);
    expect(result.initialDate).toBe(rows.at(-1)!.dateKey);
    expect(result.fallback).toBeNull();
    expect(result.entries).toHaveLength(14);
    expect(result.readCounts.documents).toBeLessThan(30);
    expect(deriveSleepDays(result.entries).days).toEqual(deriveSleepDays(rows).days.slice(0, 14));
  });
  it("paginates complete date groups beyond 100 documents", async () => {
    const rows = Array.from({ length: 125 }, (_, n) => ({ ...emptySleepEntry(`tiny-${n}`, "2026-10-17", 0.01, now), source: "health" as const }));
    await mutateSleepJournal("alice", () => rows, {}, database);
    const result = await getSleepJournalWindow("alice", { start: "2026-10-17", end: "2026-10-17" }, database);
    expect(result.fallback).toBeNull();
    expect(result.entries).toHaveLength(125);
    expect(deriveSleepDays(result.entries).days).toEqual(deriveSleepDays(rows).days);
  });
  it("falls back to the complete ledger when interval dependency reads exceed the budget", async () => {
    const rows = Array.from({ length: 260 }, (_, n) => ({ ...manual(`overlap-${n}`, "2026-10-17T01:00Z", "2026-10-17T02:00Z"), source: "health" as const }));
    await mutateSleepJournal("alice", () => rows, {}, database);
    const result = await getSleepJournalWindow("alice", { start: "2026-10-17", end: "2026-10-17" }, database);
    expect(result.fallback).toBe("scope-budget");
    expect(result.entries).toHaveLength(260);
    expect(deriveSleepDays(result.entries).days).toEqual(deriveSleepDays(rows).days);
  });
  it("includes differently allocated overlaps and linked corrections with full-ledger totals", async () => {
    const a = manual("a", "2026-10-16T23:00Z", "2026-10-17T07:00Z");
    const b = { ...manual("b", "2026-10-17T06:00Z", "2026-10-17T09:00Z"), dateKey: "2026-10-18", source: "health" as const };
    const correction = { ...emptySleepEntry("fix", "2026-10-19", 2, now), corrects: b.id };
    await mutateSleepJournal("alice", () => [a, b, correction], {}, database);
    const result = await getSleepJournalWindow("alice", { start: a.dateKey, end: a.dateKey }, database);
    expect(result.entries.map(row => row.id).sort()).toEqual(["a", "b", "fix"]);
    expect(deriveSleepDays(result.entries).days).toEqual(deriveSleepDays([a, b, correction]).days);
  });
  it("commands commit concurrently and return summary plus affected dates without the full ledger", async () => {
    const a = manual("a", "2026-10-17T00:00Z", "2026-10-17T03:00Z");
    const b = manual("b", "2026-10-17T04:00Z", "2026-10-17T07:00Z");
    const results = await Promise.all([a, b].map(candidate => executeSleepCommand("alice", { kind: "manual", candidate }, {}, database)));
    expect(results.every(result => !Object.hasOwn(result, "entries"))).toBe(true);
    expect((await getSleepJournal("alice", database)).entries).toHaveLength(2);
    const result = await executeSleepCommand("alice", { kind: "remove", expected: a }, {}, database);
    expect(result.summary.latestSleepHours).toBe(3);
    expect(result.affectedDates).toEqual([a.dateKey]);
    await expect(executeSleepCommand("alice", { kind: "manual", candidate: a, expected: a }, {}, database)).rejects.toThrow("changed");
  });
  it("retains legacy root-only history through window fallback and the first command", async () => {
    await setDoc(doc(database, "users", "alice"), { sleepProfile: { recentNightlyHours: [{ dateKey: "2020-01-01", sleepHours: 6 }] } });
    const result = await getSleepJournalWindow("alice", null, database);
    expect(result.fallback).toBe("legacy-profile");
    expect(result.initialDate).toBe("2020-01-01");
    await executeSleepCommand("alice", { kind: "manual", candidate: emptySleepEntry("new", "2026-10-17", 7, now) }, {}, database);
    expect((await getSleepJournal("alice", database)).entries).toHaveLength(2);
  });
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
