import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { disableNetwork, enableNetwork, doc, getDoc, setDoc, writeBatch, Timestamp, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSleepCommand, getSleepJournal, mutateSleepJournal } from "./sleepJournal";
import { applySleepCommand, type SleepCommand } from "./sleepCommands";
import { deriveSleepDays, emptySleepEntry, HOUR_MS, shiftSleepDate, sleepEntrySignature, type SleepEntry } from "./sleepSessionModel";
import { providerSleepEntry } from "./healthSleepImport";
vi.mock("../config/firebaseConfig", () => ({ db: null }));

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const now = new Date("2026-11-06T12:00Z");
const duration = (id: string, dateKey: string, hours = 7) => emptySleepEntry(id, dateKey, hours, now);
const timed = (id: string, dateKey: string, start: number, end: number): SleepEntry => ({ ...duration(id, dateKey, (end - start) / HOUR_MS), kind: "session", startMs: start, endMs: end });
const canonical = (rows: SleepEntry[]) => rows.map(sleepEntrySignature).sort();
describe.skipIf(!emulator)("scoped sleep command equivalence", { timeout: 30_000 }, () => {
  let env: RulesTestEnvironment, db: Firestore, oracle: Firestore;
  beforeAll(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({ projectId: "demo-lastrep-sleep-mutation-tests", firestore: { host, port: Number(port), rules: readFileSync("firestore.rules", "utf8") } });
    db = env.authenticatedContext("alice").firestore() as unknown as Firestore;
    oracle = env.authenticatedContext("bob").firestore() as unknown as Firestore;
  });
  beforeEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });
  async function seed(uid: string, entries: SleepEntry[], origin: string | null = null) {
    await env.withSecurityRulesDisabled(async context => {
      const fixture = context.firestore() as unknown as Firestore;
      for (let offset = 0; offset < entries.length; offset += 400) {
        const batch = writeBatch(fixture);
        for (const entry of entries.slice(offset, offset + 400)) batch.set(doc(fixture, "users", uid, "sleepSessions", entry.id), entry);
        await batch.commit();
      }
      // Independent oracle serialization of the pre-existing full-ledger summary contract.
      const recentNightlyHours = deriveSleepDays(entries, origin).days.slice(0, 30).map(day => ({ dateKey: day.dateKey,
        sleepHours: Math.round(day.hours * 1000) / 1000, source: day.source, recordedAt: day.recordedAtMs == null ? null : Timestamp.fromMillis(day.recordedAtMs) }));
      const latest = recentNightlyHours[0];
      const summary = { latestSleepHours: latest?.sleepHours ?? null, source: latest?.source ?? "manual", sampleRecordedAt: latest?.recordedAt ?? null, recentNightlyHours };
      await setDoc(doc(fixture, "users", uid), { sleepProfile: { journalRevision: 1, originAppPackage: origin, ...summary, journalSummary: summary } });
    });
  }
  async function compare(entries: SleepEntry[], command: SleepCommand, options: { origin?: string | null } = {}, origin: string | null = null) {
    await Promise.all([seed("alice", entries, origin), seed("bob", entries, origin)]);
    const result = await executeSleepCommand("alice", command, options, db);
    await mutateSleepJournal("bob", rows => applySleepCommand(rows, command), options, oracle);
    const actual = await getSleepJournal("alice", db), expected = await getSleepJournal("bob", oracle);
    expect(canonical(actual.entries)).toEqual(canonical(expected.entries));
    expect(deriveSleepDays(actual.entries, options.origin ?? origin)).toEqual(deriveSleepDays(expected.entries, options.origin ?? origin));
    expect(actual.profile).toEqual(expected.profile);
    expect(result.summary).toEqual(expected.profile.journalSummary);
    return result;
  }
  it("moves an entry across dates without losing unrelated history or overlaps", async () => {
    const a = timed("a", "2026-10-17", 0, 8 * HOUR_MS);
    const b = { ...timed("b", "2026-10-18", 7 * HOUR_MS, 12 * HOUR_MS), source: "health" as const };
    const c = { ...timed("c", "2026-10-19", 11 * HOUR_MS, 16 * HOUR_MS), source: "health" as const };
    const result = await compare([a, b, c, duration("unrelated", "2025-01-01")], {
      kind: "manual", candidate: { ...a, dateKey: "2026-10-20", endMs: 6 * HOUR_MS, hours: 6 }, expected: a,
    });
    expect(result.diagnostics?.mode).toBe("scoped");
    expect(result.affectedDates.sort()).toEqual([a.dateKey, "2026-10-20"].sort());
  });
  it.each([0, 29])("refills the 31st recorded day after deleting saved summary row %i", async index => {
    const rows = Array.from({ length: 60 }, (_, n) => duration(`r${n}`, shiftSleepDate("2020-01-01", n * 7)));
    const result = await compare(rows, { kind: "remove", expected: rows[59 - index] });
    expect(result.diagnostics?.mode).toBe("scoped");
    expect(result.summary.recentNightlyHours).toHaveLength(30);
    expect(result.summary.recentNightlyHours.at(-1)?.dateKey).toBe(rows[29].dateKey);
  });
  it("refills when moving a listed date below the old 30th date", async () => {
    const rows = Array.from({ length: 35 }, (_, n) => duration(`r${n}`, shiftSleepDate("2020-01-01", n * 8)));
    const result = await compare(rows, { kind: "manual", candidate: { ...rows[34], dateKey: "2010-01-01" }, expected: rows[34] });
    expect(result.summary.recentNightlyHours.at(-1)?.dateKey).toBe(rows[4].dateKey);
  });
  it("corrects staged imports and preserves markers during later replay", async () => {
    const health = { ...timed("health", "2026-10-17", 0, 8 * HOUR_MS), source: "health" as const, providerId: "p", origin: "tracker", importDevice: "device",
      stages: [{ startMs: 0, endMs: HOUR_MS, stage: 1 }, { startMs: HOUR_MS, endMs: 8 * HOUR_MS, stage: 2 }] };
    await compare([health, duration("unrelated", "2020-01-01")], { kind: "manual", candidate: duration("fix", health.dateKey, 6), expected: health });
    const corrected = (await getSleepJournal("alice", db)).entries;
    const replay = await compare(corrected, { kind: "health", incoming: [health], deletedIds: [], device: "device" }, {}, "tracker");
    expect(replay.diagnostics?.mode).toBe("scoped");
  });
  it("finds old provider deletion IDs and limits full-window missing records to the matching device", async () => {
    const make = (id: string, date: string, device = "device") => ({ ...timed(id, date, Date.parse(date + "T00:00Z"), Date.parse(date + "T07:00Z")), source: "health" as const, providerId: id, origin: "tracker", importDevice: device });
    const old = make("old", "2020-01-01"), missing = make("missing", "2026-10-20"), other = make("other", "2026-10-21", "other-device");
    const incoming = make("new", "2026-10-22");
    const result = await compare([old, missing, other], { kind: "health", incoming: [incoming], deletedIds: ["old"], device: "device", fullWindow: { start: Date.parse("2026-10-01"), end: now.getTime() } }, {}, "tracker");
    expect(result.diagnostics?.mode).toBe("scoped");
  });
  it("resolves allocation timezone before fetching a moved provider record's new date", async () => {
    const original = { ...providerSleepEntry({ startTime: "2026-10-16T10:00Z", endTime: "2026-10-16T18:00Z", metadata: { id: "p", dataOrigin: "tracker" } }, "device"), allocationTimeZone: "Asia/Seoul", dateKey: "2026-10-17" };
    const incoming = { ...original, startMs: Date.parse("2026-10-17T10:00Z"), endMs: Date.parse("2026-10-17T18:00Z"), dateKey: "2026-10-17", allocationTimeZone: "America/New_York" };
    await compare([original, duration("new-date-total", "2026-10-18", 2)], { kind: "health", incoming: [incoming], deletedIds: [], device: "device" }, {}, "tracker");
    expect((await getSleepJournal("alice", db)).entries.find(row => row.id === original.id)?.dateKey).toBe("2026-10-18");
  });
  it("retains global legacy supersession behavior during an unrelated import", async () => {
    const session = { ...timed("old-session", "2020-01-01", 0, 8 * HOUR_MS), source: "health" as const };
    const legacy = { ...duration("old-total", session.dateKey, 8), kind: "legacy" as const, source: "health" as const };
    await compare([session, legacy], { kind: "health", incoming: [], deletedIds: [], device: "device" });
    expect((await getSleepJournal("alice", db)).entries.find(row => row.id === legacy.id)?.excluded).toBe(true);
  });
  it("refills multiple recorded days after a completed provider window removes its missing sessions", async () => {
    const rows = Array.from({ length: 60 }, (_, n) => {
      const date = shiftSleepDate("2020-01-01", n * 7), start = Date.parse(date + "T00:00Z");
      return { ...timed(`r${n}`, date, start, start + 7 * HOUR_MS), source: "health" as const, providerId: `p${n}`, importDevice: "device", origin: "tracker" };
    });
    const result = await compare(rows, { kind: "health", incoming: [], deletedIds: [], device: "device", fullWindow: { start: rows[40].startMs!, end: now.getTime() } }, {}, "tracker");
    expect(result.diagnostics?.mode).toBe("scoped");
    expect(result.summary.recentNightlyHours.at(-1)?.dateKey).toBe(rows[10].dateKey);
  });
  it("completes a date group with more than one page before replacement", async () => {
    const rows = Array.from({ length: 120 }, (_, n) => ({ ...duration(`r${n}`, "2026-10-17", 0.01), source: "health" as const }));
    const result = await compare(rows, { kind: "manual", candidate: duration("replacement", "2026-10-17", 7), replacements: rows });
    expect(result.diagnostics?.mode).toBe("scoped");
    expect(result.summary.latestSleepHours).toBe(7);
  });
  it("uses full fallback when the provider preference changes", async () => {
    const a = { ...timed("a", "2020-01-01", 0, HOUR_MS), source: "health" as const, origin: "a" };
    const b = { ...a, id: "b", dateKey: "2020-01-02", origin: "b" };
    const result = await compare([a, b], { kind: "health", incoming: [], deletedIds: [], device: "device" }, { origin: "b" }, "a");
    expect(result.diagnostics?.fallback).toBe("origin-change");
  });
  it("falls back without deleting unseen records when a scope exceeds its budget", async () => {
    const rows = Array.from({ length: 550 }, (_, n) => ({ ...duration(`r${n}`, "2026-10-17", 0), source: "health" as const, excluded: true }));
    const result = await compare(rows, { kind: "manual", candidate: duration("new", "2026-10-17", 7) });
    expect(result.diagnostics?.fallback).toBe("scope-budget");
  });
  it("retries alongside an older full-ledger writer and preserves both additions", async () => {
    await seed("alice", []);
    const a = timed("a", "2026-10-17", 0, HOUR_MS), b = timed("b", "2026-10-17", 2 * HOUR_MS, 3 * HOUR_MS);
    await Promise.all([executeSleepCommand("alice", { kind: "manual", candidate: a }, {}, db),
      mutateSleepJournal("alice", rows => applySleepCommand(rows, { kind: "manual", candidate: b }), {}, db)]);
    expect((await getSleepJournal("alice", db)).profile.latestSleepHours).toBe(2);
    expect((await getSleepJournal("alice", db)).entries).toHaveLength(2);
  });
  it("rereads dependencies after a deterministic revision change before commit", async () => {
    await seed("alice", []);
    let checks = 0;
    const a = timed("a", "2026-10-17", 0, HOUR_MS), b = timed("b", "2026-10-17", 2 * HOUR_MS, 3 * HOUR_MS);
    const result = await executeSleepCommand("alice", { kind: "manual", candidate: a }, {
      authorize: async () => {
        if (++checks === 2) await mutateSleepJournal("alice", rows => applySleepCommand(rows, { kind: "manual", candidate: b }), {}, db);
      },
    }, db);
    expect(result.revision).toBe(3);
    expect(checks).toBe(4);
    expect((await getSleepJournal("alice", db)).profile.latestSleepHours).toBe(2);
  });
  it("does not save a partial command when a conflict needs confirmation", async () => {
    const existing = duration("existing", "2026-10-17");
    await seed("alice", [existing]);
    await expect(executeSleepCommand("alice", { kind: "manual", candidate: duration("new", existing.dateKey) }, {}, db)).rejects.toThrow("Review them before saving");
    expect((await getSleepJournal("alice", db)).entries).toEqual([existing]);
    expect((await getDoc(doc(db, "users", "alice"))).data()?.sleepProfile.journalRevision).toBe(1);
  });
  it("completes a refill boundary containing more than one page of excluded records", async () => {
    const rows = Array.from({ length: 35 }, (_, n) => duration(`active-${n}`, shiftSleepDate("2020-01-01", n * 10)));
    const excluded = Array.from({ length: 110 }, (_, n) => ({ ...duration(`excluded-${n}`, shiftSleepDate(rows[5].dateKey, -1)), excluded: true }));
    const result = await compare([...rows, ...excluded], { kind: "remove", expected: rows[34] });
    expect(result.summary.recentNightlyHours.at(-1)?.dateKey).toBe(rows[4].dateKey);
  });
  it("does not commit when authorization is revoked after dependency reads", async () => {
    await seed("alice", []);
    let checks = 0;
    await expect(executeSleepCommand("alice", { kind: "manual", candidate: duration("new", "2026-10-17") }, { authorize: async () => { if (++checks === 2) throw Error("revoked"); } }, db)).rejects.toThrow("revoked");
    expect((await getSleepJournal("alice", db)).entries).toEqual([]);
    expect((await getDoc(doc(db, "users", "alice"))).data()?.sleepProfile.journalRevision).toBe(1);
  });
  it("reports an actionable offline save error without Firebase implementation instructions", async () => {
    await seed("alice", []);
    await getDoc(doc(db, "users", "alice"));
    await disableNetwork(db);
    try {
      await expect(executeSleepCommand("alice", { kind: "manual", candidate: duration("new", "2026-10-17") }, {}, db))
        .rejects.toMatchObject({ message: "Could not save sleep. Reconnect and try again.", code: "unavailable" });
    } finally { await enableNetwork(db); }
    expect((await getSleepJournal("alice", db)).entries).toEqual([]);
  });
  it.each([30, 365, 1825])("bounds a normal edit independently of %i recorded dates", async count => {
    const rows = Array.from({ length: count }, (_, n) => duration(`r${n}`, shiftSleepDate("2020-01-01", n)));
    await seed("alice", rows);
    const expected = rows.at(-1)!;
    const started = performance.now();
    const result = await executeSleepCommand("alice", { kind: "manual", expected, candidate: { ...expected, hours: 6 } }, {}, db);
    expect(result.diagnostics).toMatchObject({ mode: "scoped", documents: 2, derivedEntries: 1 });
    console.info("sleep edit benchmark", JSON.stringify({ history: count, ...result.diagnostics, elapsedMs: Math.round(performance.now() - started) }));
  });
  it.each([30, 365, 1825])("bounds provider reconciliation independently of %i recorded dates", async count => {
    const rows = Array.from({ length: count }, (_, n) => {
      const date = shiftSleepDate("2020-01-01", n), start = Date.parse(date + "T00:00Z");
      return { ...timed(`r${n}`, date, start, start + 8 * HOUR_MS), source: "health" as const, providerId: `p${n}`, importDevice: "device", origin: "tracker" };
    });
    await seed("alice", rows, "tracker");
    const latest = rows.at(-1)!;
    const started = performance.now();
    const result = await executeSleepCommand("alice", { kind: "health", incoming: [{ ...latest, hours: 7, startMs: latest.startMs! + HOUR_MS }], deletedIds: [], device: "device" }, {}, db);
    expect(result.diagnostics).toMatchObject({ mode: "scoped", documents: 4, derivedEntries: 1 });
    expect(result.summary.latestSleepHours).toBe(7);
    console.info("sleep import benchmark", JSON.stringify({ history: count, ...result.diagnostics, elapsedMs: Math.round(performance.now() - started) }));
  });
  it.each([30, 365, 1825])("measures the explicit full fallback for %i recorded dates", async count => {
    const rows = Array.from({ length: count }, (_, n) => duration(`r${n}`, shiftSleepDate("2020-01-01", n)));
    await seed("alice", rows);
    const started = performance.now();
    const result = await executeSleepCommand("alice", { kind: "health", incoming: [], deletedIds: [], device: "device" }, { origin: "new-provider" }, db);
    expect(result.diagnostics).toMatchObject({ mode: "full", fallback: "origin-change", documents: count, derivedEntries: count });
    console.info("sleep fallback benchmark", JSON.stringify({ history: count, ...result.diagnostics, elapsedMs: Math.round(performance.now() - started) }));
  });
});
