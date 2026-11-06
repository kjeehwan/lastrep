import { beforeEach, expect, it, vi } from "vitest";
import { emptySleepEntry } from "./sleepSessionModel";
import { getSleepJournalWindow, sleepDisplayRange } from "./sleepJournalWindow";

const fake = vi.hoisted(() => ({ roots: 0, queries: 0, fullReads: 0, moving: false, indexFailure: false, denied: false }));
vi.mock("../config/firebaseConfig", () => ({ db: {} }));
vi.mock("firebase/firestore", async original => ({
  ...await original<typeof import("firebase/firestore")>(),
  doc: () => ({}), collection: () => ({}), documentId: () => "id",
  query: (_ref: unknown, ...constraints: unknown[]) => constraints,
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  orderBy: () => ({}), limit: () => ({}), startAfter: () => ({}),
  getDocFromServer: async () => {
    fake.roots++;
    const revision = fake.moving ? fake.roots : fake.roots === 1 ? 1 : 2;
    return { data: () => ({ sleepProfile: { journalRevision: revision, journalSummary: { recentNightlyHours: [] } } }) };
  },
  getDocsFromServer: async (constraints: { field?: string; value?: unknown }[]) => {
    fake.queries++;
    if (fake.denied) throw Object.assign(Error("denied"), { code: "permission-denied" });
    if (fake.indexFailure && constraints.some(c => c.field === "endMs")) throw Object.assign(Error("missing index"), { code: "failed-precondition" });
    const fields = constraints.filter(c => c.field);
    if (!fields.length) fake.fullReads++;
    const rows = !fields.length || fields.some(c => c.field === "endMs" || c.field === "dateKey" && c.value !== "undated")
      ? [{ ...emptySleepEntry("one", "2026-10-17", 1, new Date(0)), kind: "session", startMs: 0, endMs: 3_600_000 }] : [];
    return { size: rows.length, docs: rows.map(row => ({ id: row.id, data: () => row })) };
  },
}));
const range = { start: "2026-10-17", end: "2026-10-17" };
beforeEach(() => { Object.assign(fake, { roots: 0, queries: 0, fullReads: 0, moving: false, indexFailure: false, denied: false }); });
it("retries a multi-query scope when the root revision changes", async () => {
  const result = await getSleepJournalWindow("alice", range);
  expect(fake.roots).toBe(4);
  expect(result.profileKey).toContain("[2,");
  expect(result.entries).toHaveLength(1);
});
it("uses the complete fallback if an interval index is unavailable", async () => {
  fake.indexFailure = true;
  const result = await getSleepJournalWindow("alice", range);
  expect(result.fallback).toBe("index-unavailable");
  expect(result.entries).toHaveLength(1);
  expect(fake.fullReads).toBe(2); // First scope is discarded after its revision changes.
});
it("does not turn permissions or connection failures into missing data", async () => {
  fake.denied = true;
  await expect(getSleepJournalWindow("alice", range)).rejects.toMatchObject({ code: "permission-denied" });
  expect(fake.fullReads).toBe(0);
});
it("reports repeated concurrent changes instead of publishing an incoherent scope", async () => {
  fake.moving = true;
  await expect(getSleepJournalWindow("alice", range)).rejects.toThrow("changed on another device");
  expect(fake.roots).toBe(8);
});
it("covers the selected date, chart and chart-selected week together", () => {
  expect(sleepDisplayRange("2026-10-30", "2026-10-10", "2026-10-20"))
    .toEqual({ start: "2026-10-04", end: "2026-10-30" });
});
