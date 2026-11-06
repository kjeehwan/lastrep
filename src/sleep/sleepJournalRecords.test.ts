import { expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { sleepJournalProfileKey } from "./sleepJournalRecords";

it("compares Firestore maps by content rather than insertion order", () => {
  const row = { dateKey: "2026-11-06", sleepHours: 8, recordedAt: new Timestamp(123, 1) };
  const profile = { journalRevision: 3, journalSummary: { latestSleepHours: 8, recentNightlyHours: [row] } };
  const reordered = { journalRevision: 3, journalSummary: {
    recentNightlyHours: [{ recordedAt: new Timestamp(123, 1), sleepHours: 8, dateKey: "2026-11-06" }], latestSleepHours: 8,
  } };
  expect(sleepJournalProfileKey({ sleepProfile: profile })).toBe(sleepJournalProfileKey({ sleepProfile: reordered }));
});

it("still detects real changes, array order and sub-millisecond timestamp changes", () => {
  const key = (hours: number[], timestamp = new Timestamp(123, 1), revision = 3) => sleepJournalProfileKey({
    sleepProfile: { journalRevision: revision, recentNightlyHours: hours, sampleRecordedAt: timestamp },
  });
  expect(key([7, 8])).not.toBe(key([8, 7]));
  expect(key([7, 8])).not.toBe(key([7, 9]));
  expect(key([7, 8])).not.toBe(key([7, 8], new Timestamp(123, 2)));
  expect(key([7, 8])).not.toBe(key([7, 8], undefined, 4));
});
