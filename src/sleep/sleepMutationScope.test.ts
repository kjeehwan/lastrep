import { beforeEach, expect, it, vi } from "vitest";
import { emptySleepEntry, type SleepEntry } from "./sleepSessionModel";
import { prepareSleepCommand } from "./sleepMutationScope";

const fake = vi.hoisted(() => ({ rows: [] as SleepEntry[], failure: "", full: vi.fn() }));
vi.mock("./sleepJournalQueries", () => ({ createSleepJournalReader: () => ({
  readCounts: { documents: 0, queries: 0 },
  all: async () => { fake.full(); return fake.rows; },
  ids: async (ids: string[]) => fake.rows.filter(row => ids.includes(row.id)),
  undated: async () => fake.rows.filter(row => row.dateKey === "undated"),
  dates: async (dates: string[]) => fake.rows.filter(row => dates.includes(row.dateKey)),
  overlaps: async () => { if (fake.failure) throw Object.assign(Error(fake.failure), { code: fake.failure }); return fake.rows; },
  corrections: async () => [], providerIds: async () => [], legacy: async () => [], contained: async () => [],
  older: async () => ({ entries: [], done: true }),
}) }));
const original = { ...emptySleepEntry("old", "2026-10-17", 2, new Date(0)), kind: "session" as const, startMs: 0, endMs: 7_200_000 };
const candidate = { ...original, hours: 1, endMs: 3_600_000 };
const root = { sleepProfile: { journalRevision: 1, journalSummary: { recentNightlyHours: [{ dateKey: original.dateKey, sleepHours: 2, source: "manual", recordedAt: null }] } } };
beforeEach(() => { fake.rows = [original]; fake.failure = ""; fake.full.mockClear(); });
it("falls back to the full oracle when a mutation dependency index is missing", async () => {
  fake.failure = "failed-precondition";
  const result = await prepareSleepCommand("alice", { kind: "manual", candidate, expected: original }, root, null, {} as never);
  expect(result.diagnostics).toMatchObject({ mode: "full", fallback: "index-unavailable" });
  expect(result.next).toEqual([candidate]);
  expect(result.summary.latestSleepHours).toBe(1);
  expect(fake.full).toHaveBeenCalledOnce();
});
it.each(["permission-denied", "unavailable"])("does not hide %s behind fallback or a partial result", async code => {
  fake.failure = code;
  await expect(prepareSleepCommand("alice", { kind: "manual", candidate, expected: original }, root, null, {} as never)).rejects.toMatchObject({ code });
  expect(fake.full).not.toHaveBeenCalled();
});
it("keeps undated root-only records when the first command bootstraps a legacy journal", async () => {
  fake.rows = [];
  const result = await prepareSleepCommand("alice", { kind: "manual", candidate }, { sleepProfile: { latestSleepHours: 7 } }, null, {} as never);
  expect(result.diagnostics.fallback).toBe("legacy-summary");
  expect(result.next).toHaveLength(2);
  expect(result.next.some(row => row.dateKey === "undated" && row.hours === 7)).toBe(true);
});
it("refuses to incrementally trust a malformed compatibility summary", async () => {
  const result = await prepareSleepCommand("alice", { kind: "manual", candidate, expected: original }, {
    sleepProfile: { journalRevision: 1, journalSummary: { recentNightlyHours: [{ dateKey: "2026-10-17", sleepHours: 99 }] } },
  }, null, {} as never);
  expect(result.diagnostics.fallback).toBe("legacy-summary");
  expect(result.summary.latestSleepHours).toBe(1);
});
