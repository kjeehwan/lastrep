import { afterEach, describe, expect, it } from "vitest";
import { commitManualSleep, deriveSleepDays, emptySleepEntry, HOUR_MS, localSleepInstant, parseSleepDate, removeSleepEntry, shiftSleepDate, SleepOverlapError, sleepDateKey, sleepDurationText, sleepEntryAsleepHours, timedSleepEntry, validateSleepHours, weeklySleepSummary, type SleepEntry } from "./sleepSessionModel";
import { providerSleepEntry, readAllSleepPages, reconcileHealthSleep } from "./healthSleepImport";
const now = new Date("2026-10-17T12:00:00Z");
const session = (id: string, start: string, end: string): SleepEntry => {
  const startMs = Date.parse(start), endMs = Date.parse(end);
  return { ...emptySleepEntry(id, end.slice(0, 10), (endMs - startMs) / HOUR_MS, now), kind: "session", startMs, endMs };
};
const first = session("one", "2026-10-15T23:00Z", "2026-10-16T03:00Z");
const second = session("two", "2026-10-16T04:00Z", "2026-10-16T07:00Z");
const provider = (id = "record-1", start = "2026-10-15T23:00Z", end = "2026-10-16T07:00Z") => providerSleepEntry({ startTime: start, endTime: end, metadata: { id, dataOrigin: "tracker", lastModifiedTime: "2026-10-16T09:00Z", clientRecordVersion: 2 } }, "device-a");

describe("sleep session diary", () => {
  it("deletes manual entries, preserves other sessions and rejects stale deletion", () => {
    const next = removeSleepEntry([first, second], first);
    expect(next).toEqual([second]);
    expect(deriveSleepDays(next).days[0].hours).toBe(3);
    expect(() => removeSleepEntry([{ ...first, hours: 2 }], first)).toThrow("changed");
  });
  it("retains imported exclusion markers even after deleting a manual correction", () => {
    const health = provider();
    const excluded = removeSleepEntry([health], health);
    expect(excluded[0].excluded).toBe(true);
    expect(reconcileHealthSleep(excluded, [health], [], "device-a")[0].excluded).toBe(true);
    const correction = emptySleepEntry("correction", health.dateKey, 7, now);
    const corrected = commitManualSleep([health], correction, health.id);
    const removed = removeSleepEntry(corrected, corrected.find((entry) => entry.id === correction.id)!);
    expect(removed).toHaveLength(1);
    expect(deriveSleepDays(reconcileHealthSleep(removed, [health], [], "device-a")).days).toEqual([]);
  });
  it("adds split sessions without counting the awake gap and keeps naps", () => {
    const entries = commitManualSleep([first], second, null);
    expect(deriveSleepDays(entries).days[0].hours).toBe(7);
    expect(deriveSleepDays(entries).days[0].sessionCount).toBe(2);
    const nap = session("nap", "2026-10-16T13:00Z", "2026-10-16T14:30Z");
    expect(deriveSleepDays(commitManualSleep(entries, nap, null)).days[0].hours).toBe(8.5);
  });
  it("rejects overlap until reviewed and excludes only the listed conflicts", () => {
    const overlap = session("overlap", "2026-10-16T02:00Z", "2026-10-16T04:00Z");
    expect(() => commitManualSleep([first, second], overlap, null)).toThrow(SleepOverlapError);
    const next = commitManualSleep([first, second], overlap, null, [first.id]);
    expect(next.find((entry) => entry.id === first.id)?.excluded).toBe(true);
    expect(next.find((entry) => entry.id === second.id)?.excluded).toBe(false);
    expect(deriveSleepDays(next).days[0].hours).toBe(5);
  });
  it("treats touching endpoints as separate entries", () => {
    const touching = session("touch", "2026-10-16T03:00Z", "2026-10-16T04:00Z");
    expect(commitManualSleep([first], touching, null)).toHaveLength(2);
  });
  it("edits one stable manual ID without replacing all entries", () => {
    const edited = { ...first, hours: 3, startMs: first.startMs! + HOUR_MS };
    const next = commitManualSleep([first, second], edited, first.id);
    expect(next).toHaveLength(2);
    expect(next.find((entry) => entry.id === second.id)).toEqual(second);
    expect(deriveSleepDays(next).days[0].hours).toBe(6);
  });
  it("counts cross-provider overlap and cross-date overlap only once", () => {
    const a = provider("a"), b = { ...provider("b"), origin: "other" };
    const nextDay = { ...provider("c", "2026-10-16T06:00Z", "2026-10-17T01:00Z"), dateKey: "2026-10-17" };
    const result = deriveSleepDays([a, b, nextDay], "tracker");
    expect(result.days.reduce((sum, day) => sum + day.hours, 0)).toBe(26);
    expect(result.entries.find((entry) => entry.id === b.id)?.countedHours).toBe(0);
    expect(result.entries.find((entry) => entry.id === b.id)?.needsReview).toBe(true);
  });
  it("keeps unknown legacy totals and does not silently add timed imports", () => {
    const legacy = { ...emptySleepEntry("legacy", "2026-10-16", 7, now), kind: "legacy" as const };
    expect(() => commitManualSleep([legacy], first, null)).toThrow(SleepOverlapError);
    const result = deriveSleepDays([legacy, provider()]);
    expect(result.days[0].hours).toBe(7);
    expect(result.days[0].needsReview).toBe(true);
  });
  it("uses complete asleep stages, not awake time, but does not trust partial staging", () => {
    const entry = provider();
    const staged = { ...entry, stages: [{ startMs: entry.startMs!, endMs: entry.startMs! + HOUR_MS, stage: 1 }, { startMs: entry.startMs! + HOUR_MS, endMs: entry.endMs!, stage: 4 }] };
    expect(deriveSleepDays([staged]).days[0].hours).toBe(7);
    expect(sleepEntryAsleepHours(staged)).toBe(7);
    expect(sleepEntryAsleepHours({ ...staged, stages: staged.stages.slice(1) })).toBeNull();
    expect(deriveSleepDays([{ ...staged, stages: staged.stages.slice(1) }]).days[0].hours).toBe(8);
    const duplicate = { ...entry, id: "duplicate", origin: "other" };
    expect(deriveSleepDays([staged, duplicate], "tracker").days[0].hours).toBe(7);
  });
  it("keeps undated legacy amounts out of dated totals until the user assigns a date", () => {
    const undated = { ...emptySleepEntry("undated", "undated", 7, now), kind: "legacy" as const };
    expect(deriveSleepDays([undated, first]).days[0].hours).toBe(4);
    expect(deriveSleepDays([undated]).days).toEqual([]);
  });
  it("flags elapsed or mixed totals but not complete asleep-stage totals", () => {
    const entry = provider();
    const staged = { ...entry, stages: [{ startMs: entry.startMs!, endMs: entry.endMs!, stage: 4 }] };
    expect(deriveSleepDays([staged]).days[0].mayIncludeAwakeTime).toBe(false);
    expect(deriveSleepDays([entry]).days[0].mayIncludeAwakeTime).toBe(true);
    expect(deriveSleepDays([{ ...staged, stages: [{ startMs: entry.startMs!, endMs: entry.endMs! - HOUR_MS, stage: 4 }] }]).days[0].mayIncludeAwakeTime).toBe(true);
    const nap = session("nap", "2026-10-16T13:00Z", "2026-10-16T14:00Z");
    expect(deriveSleepDays([staged, nap]).days[0].mayIncludeAwakeTime).toBe(true);
    // A duplicate with no stages must not downgrade a fully staged primary source.
    expect(deriveSleepDays([staged, { ...entry, id: "duplicate", origin: "other" }], "tracker").days[0].mayIncludeAwakeTime).toBe(false);
  });
  it("does not treat missing days as zero sleep in the selected weekly summary", () => {
    const result = deriveSleepDays([first, second]);
    expect(weeklySleepSummary(result.days, "2026-10-17", 7)).toEqual({ count: 1, average: 7, met: 1 });
    expect(weeklySleepSummary(result.days, "2026-10-10", 7).average).toBeNull();
  });
  it("validates duration, dates, future entry and exact local time", () => {
    expect(() => validateSleepHours("")).toThrow();
    for (const value of ["0", "25", "NaN", "0.0001"]) expect(() => validateSleepHours(value)).toThrow();
    expect(validateSleepHours("7.5")).toBe(7.5);
    expect(sleepDurationText(7.5)).toBe("7 h 30 min");
    expect(sleepDurationText(null)).toBe("Not recorded");
    expect(() => parseSleepDate("2026-02-30")).toThrow();
    expect(shiftSleepDate("2028-03-01", -1)).toBe("2028-02-29");
    expect(() => timedSleepEntry("2027-01-01", "23:00", "2027-01-02", "07:00", now)).toThrow();
    const interval = timedSleepEntry("2026-10-15", "23:00", "2026-10-16", "07:00", now);
    expect(interval.hours).toBe(8);
    expect(sleepDateKey(localSleepInstant("2026-10-16", "07:00"))).toBe("2026-10-16");
  });
});

describe("health sleep reconciliation", () => {
  it("preserves stable provider identity, version and timestamps", () => {
    const entry = provider();
    expect(entry.providerId).toBe("record-1"); expect(entry.modifiedAt).toBe("2026-10-16T09:00Z"); expect(entry.clientVersion).toBe(2);
    expect(entry.startMs).toBe(Date.parse("2026-10-15T23:00Z"));
    expect(entry.endOffsetMinutes).toBeNull();
    const fixed = providerSleepEntry({ startTime: "2026-10-16T15:00Z", endTime: "2026-10-16T23:00Z", endZoneOffset: { totalSeconds: 32400 }, metadata: { id: "fixed", dataOrigin: "tracker" } }, "a");
    expect(fixed.dateKey).toBe("2026-10-17");
  });
  it("does not duplicate imports or restore excluded/corrected provider entries", () => {
    const health = provider();
    let next = reconcileHealthSleep([], [health], [], "device-a");
    next = reconcileHealthSleep(next, [health], [], "device-a");
    expect(next).toHaveLength(1);
    const correction = { ...emptySleepEntry("fix", health.dateKey, 7, now) };
    next = commitManualSleep(next, correction, health.id);
    next = reconcileHealthSleep(next, [health], [], "device-a");
    expect(next.find((row) => row.id === health.id)?.excluded).toBe(true);
    expect(next.find((row) => row.id === correction.id)?.corrects).toBe(health.id);
    expect(deriveSleepDays(next).days[0].hours).toBe(7);
  });
  it("replaces imported legacy representations, not manual legacy totals", () => {
    const imported = { ...emptySleepEntry("legacy", "2026-10-16", 8, now), source: "health" as const, kind: "legacy" as const };
    const next = reconcileHealthSleep([imported], [provider()], [], "device-a");
    expect(next.find((row) => row.id === "legacy")?.excluded).toBe(true);
    expect(deriveSleepDays(next).days[0].hours).toBe(8);
  });
  it("preserves history when a partial import cannot replace the old daily total", () => {
    const legacy = { ...emptySleepEntry("legacy", "2026-10-16", 8, now), source: "health" as const, kind: "legacy" as const };
    const partial = provider("partial", "2026-10-16T06:00Z", "2026-10-16T07:00Z");
    const next = reconcileHealthSleep([legacy], [partial], [], "device-a");
    expect(next.find((row) => row.id === legacy.id)?.excluded).toBe(false);
    expect(deriveSleepDays(next).days[0].hours).toBe(8);
    expect(deriveSleepDays([legacy]).days[0].hours).toBe(8);
  });
  it("matches rounded elapsed legacy totals while using actual asleep stages", () => {
    const legacy = { ...emptySleepEntry("legacy", "2026-10-16", 6.3, now), source: "health" as const, kind: "legacy" as const };
    const entry = provider("staged", "2026-10-16T00:41Z", "2026-10-16T07:01Z");
    const staged = { ...entry, stages: [{ startMs: entry.startMs!, endMs: entry.startMs! + 49 * 60_000, stage: 1 }, { startMs: entry.startMs! + 49 * 60_000, endMs: entry.endMs!, stage: 4 }] };
    const next = reconcileHealthSleep([legacy], [staged], [], "device-a");
    expect(next.find((row) => row.id === legacy.id)?.excluded).toBe(true);
    const result = deriveSleepDays(next);
    expect(result.days[0].hours).toBeCloseTo(5 + 31 / 60);
    expect(result.days[0].mayIncludeAwakeTime).toBe(false);
  });
  it("checks combined split-session coverage rather than replacing from the first session", () => {
    const legacy = { ...emptySleepEntry("legacy", "2026-10-16", 7, now), source: "health" as const, kind: "legacy" as const };
    const a = provider("a", "2026-10-15T23:00Z", "2026-10-16T03:00Z");
    const b = provider("b", "2026-10-16T04:00Z", "2026-10-16T07:00Z");
    const partial = reconcileHealthSleep([legacy], [a], [], "device-a");
    expect(partial.find((row) => row.id === legacy.id)?.excluded).toBe(false);
    const complete = reconcileHealthSleep(partial, [b], [], "device-a");
    expect(complete.find((row) => row.id === legacy.id)?.excluded).toBe(true);
    expect(deriveSleepDays(complete).days[0].hours).toBe(7);
  });
  it("reconciles provider deletion but never infers deletions from an incremental page", () => {
    const entry = provider();
    expect(reconcileHealthSleep([entry], [], [], "device-a")[0].providerDeleted).toBe(false);
    expect(reconcileHealthSleep([entry], [], [entry.providerId!], "device-a")[0].providerDeleted).toBe(true);
    expect(reconcileHealthSleep([entry], [], [entry.providerId!], "device-b")[0].providerDeleted).toBe(false);
    expect(reconcileHealthSleep([entry], [], [], "device-a", { start: entry.startMs! - 1, end: entry.endMs! + 1 })[0].providerDeleted).toBe(true);
  });
  it("reads every provider page and rejects repeated cursors without a partial import", async () => {
    const seen: (string | undefined)[] = [];
    const records = await readAllSleepPages(async (token) => { seen.push(token); return token ? { records: [{ startTime: "b", endTime: "b" }] } : { records: [{ startTime: "a", endTime: "a" }], pageToken: "second" }; });
    expect(records).toHaveLength(2); expect(seen).toEqual([undefined, "second"]);
    await expect(readAllSleepPages(async () => ({ records: [], pageToken: "same" }))).rejects.toThrow("repeated");
  });
  it("rejects malformed provider identity instead of manufacturing an ID", () => {
    expect(() => providerSleepEntry({ startTime: "2026-10-16T01:00Z", endTime: "2026-10-16T02:00Z" }, "a")).toThrow();
  });
  it("preserves allocation timezone during travel but still accepts corrected end dates", () => {
    const old = { ...provider("travel", "2026-10-16T15:00Z", "2026-10-16T23:00Z"), dateKey: "2026-10-17", allocationTimeZone: "Asia/Seoul" };
    const reimport = { ...old, dateKey: "2026-10-16", allocationTimeZone: "America/New_York" };
    expect(reconcileHealthSleep([old], [reimport], [], "device-a")[0].dateKey).toBe("2026-10-17");
    const corrected = { ...reimport, startMs: old.startMs! + 24 * HOUR_MS, endMs: old.endMs! + 24 * HOUR_MS, dateKey: "2026-10-17" };
    expect(reconcileHealthSleep([old], [corrected], [], "device-a")[0].dateKey).toBe("2026-10-18");
  });
});

const originalTz = process.env.TZ;
afterEach(() => { if (originalTz == null) delete process.env.TZ; else process.env.TZ = originalTz; });
it("uses actual elapsed time across DST and rejects skipped/ambiguous local times", () => {
  process.env.TZ = "America/New_York";
  expect(timedSleepEntry("2026-03-07", "23:00", "2026-03-08", "07:00", new Date("2026-12-01")).hours).toBe(7);
  expect(() => localSleepInstant("2026-03-08", "02:30")).toThrow("does not exist");
  expect(() => timedSleepEntry("2026-10-31", "23:00", "2026-11-01", "01:30", new Date("2026-12-01"))).toThrow("occurs twice");
});
