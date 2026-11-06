import { expect, it } from "vitest";
import { deriveSleepDays, emptySleepEntry, type SleepEntry } from "./sleepSessionModel";
import { readSleepWindowScope, SleepScopeFallback, type SleepScopeReader } from "./sleepWindowScope";
import { applySleepCommand } from "./sleepCommands";

const row = (id: string, dateKey: string, start?: number, end?: number): SleepEntry => ({
  ...emptySleepEntry(id, dateKey, start == null ? 7 : (end! - start) / 3_600_000, new Date(0)),
  ...(start == null ? {} : { kind: "session", startMs: start, endMs: end! }),
});
function reader(rows: SleepEntry[]): SleepScopeReader {
  return {
    range: async range => rows.filter(r => r.dateKey >= range.start && r.dateKey <= range.end),
    undated: async () => rows.filter(r => r.dateKey === "undated"),
    dates: async dates => rows.filter(r => dates.includes(r.dateKey)),
    overlaps: async (start, end) => rows.filter(r => r.startMs != null && r.endMs! > start && r.startMs < end),
    ids: async ids => rows.filter(r => ids.includes(r.id)),
    corrections: async ids => rows.filter(r => r.corrects && ids.includes(r.corrects)),
  };
}
const range = { start: "2026-10-17", end: "2026-10-17" };
it("closes cross-date overlap chains and complete outside date groups", async () => {
  const hour = 3_600_000;
  const rows = [row("a", range.start, 0, 8 * hour), row("b", "2026-10-16", 7 * hour, 12 * hour),
    row("c", "2026-10-15", 11 * hour, 16 * hour), row("unknown", "2026-10-15"), row("unrelated", "2025-01-01")];
  const scoped = await readSleepWindowScope(reader(rows), range);
  expect(scoped.entries.map(r => r.id)).toEqual(expect.arrayContaining(["a", "b", "c", "unknown"]));
  expect(scoped.entries.some(r => r.id === "unrelated")).toBe(false);
  expect(deriveSleepDays(scoped.entries).days.filter(r => r.dateKey === range.start))
    .toEqual(deriveSleepDays(rows).days.filter(r => r.dateKey === range.start));
});
it("includes both directions of corrections, exclusion markers and undated history", async () => {
  const original = { ...row("original", range.start), source: "health" as const, excluded: true };
  const correction = { ...row("correction", "2026-10-16"), corrects: original.id };
  const undated = { ...row("old", "undated"), kind: "legacy" as const };
  const result = await readSleepWindowScope(reader([original, correction, undated]), range);
  expect(new Set(result.entries.map(r => r.id))).toEqual(new Set([original.id, correction.id, undated.id]));
  const reverse = await readSleepWindowScope(reader([original, correction]), { start: correction.dateKey, end: correction.dateKey });
  expect(reverse.entries).toContainEqual(original);
});
it("falls back instead of publishing a capped or unprovable result", async () => {
  await expect(readSleepWindowScope(reader([row("a", range.start)]), range, { records: 0, rounds: 8 })).rejects.toBeInstanceOf(SleepScopeFallback);
  await expect(readSleepWindowScope(reader([row("a", range.start, 1, 0)]), range)).rejects.toThrow("unprovable");
  const broken = reader([]); broken.range = async () => { throw Error("offline"); };
  await expect(readSleepWindowScope(broken, range)).rejects.toThrow("offline");
});
it("matches the full-ledger oracle for varied priorities, same-date totals and interval chains", async () => {
  for (let seed = 0; seed < 40; seed++) {
    const rows = Array.from({ length: 12 }, (_, n) => ({
      ...row(`r${n}`, `2026-10-${15 + n % 4}`, (n * 2 + seed % 3) * 3_600_000, (n * 2 + 4) * 3_600_000),
      source: n % 3 ? "health" as const : "manual" as const, origin: n % 2 ? "preferred" : "other",
      excluded: (n + seed) % 11 === 0, providerDeleted: (n + seed) % 13 === 0,
    }));
    if (seed % 2) rows.push({ ...row("total", range.start), source: "health", origin: "preferred", excluded: false, providerDeleted: false });
    const scoped = await readSleepWindowScope(reader(rows), range, { records: 1000, rounds: 20 });
    const select = (entries: SleepEntry[]) => deriveSleepDays(entries, "preferred").days.filter(r => r.dateKey === range.start);
    expect(select(scoped.entries)).toEqual(select(rows));
  }
});
it("commands reject stale edits and preserve unrelated rows", () => {
  const original = row("a", range.start), unrelated = row("b", "2026-10-16");
  expect(() => applySleepCommand([{ ...original, hours: 6 }], { kind: "manual", candidate: original, expected: original })).toThrow("changed");
  const result = applySleepCommand([original, unrelated], { kind: "remove", expected: original });
  expect(result).toEqual([unrelated]);
});
