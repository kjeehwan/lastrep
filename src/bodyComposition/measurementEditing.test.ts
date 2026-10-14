import { expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import type { BodyCompositionHistoryEntry } from "../contracts/bodyComposition";
import { deleteMeasurementHistory, editMeasurementHistory, latestMeasurementExamples, measurementDeletionMessage, measurementText, measurementValues, snapshotAfterMeasurementDeletion } from "./measurementEditing";
import { getBodyCompositionHistoryPoints } from "./bodyCompositionHistory";

function row(time: number, weight: number, source: "manual" | "health" = "manual"): BodyCompositionHistoryEntry {
  return { recordedAt: Timestamp.fromMillis(time), weightKg: weight, bodyFatPercent: null, leanBodyMassKg: null, skeletalMuscleMassKg: null, legacyMuscleMassKg: null, originLabel: null, source };
}
it("edits an older point without changing its date, newer points or unrelated metrics", () => {
  const old = { ...row(1000, 80.15), bodyFatPercent: 18 };
  const recent = row(2000, 79.65);
  const updated = editMeasurementHistory([recent, old], old, { weightKg: 80.25 });
  expect(updated).toHaveLength(2);
  expect(updated[0]).toEqual(recent);
  expect(updated[1]).toMatchObject({ recordedAt: old.recordedAt, weightKg: 80.25, bodyFatPercent: 18 });
  expect(old.weightKg).toBe(80.15);
});
it("keeps imported originals while preferring a manual correction at the original timestamp", () => {
  const imported = row(1000, 80.15, "health");
  const updated = editMeasurementHistory([imported], imported, { weightKg: 80.25 });
  expect(updated[0]).toMatchObject({ source: "manual", weightKg: 80.25, recordedAt: imported.recordedAt });
  expect(updated[1]).toEqual(imported);
});
it("rejects removed or concurrently edited records", () => {
  const original = row(1000, 80.15);
  expect(() => editMeasurementHistory([], original, { weightKg: 81 })).toThrow();
  expect(() => editMeasurementHistory([row(1000, 82)], original, { weightKg: 81 })).toThrow();
});
it("prefills edits and uses latest per-metric placeholders without fabricating missing values", () => {
  const old = { ...row(1000, 80.15), bodyFatPercent: 18 };
  const recent = row(2000, 79.65);
  expect(measurementValues(old, "kg").weightKg).toBe("80.15");
  expect(latestMeasurementExamples([old, recent], "kg")).toMatchObject({ weightKg: "79.65", bodyFatPercent: "18", leanBodyMassKg: "" });
  expect(measurementText(80.15, "weightKg", "kg")).toBe("80.15");
  expect(measurementText(80.1, "weightKg", "kg")).toBe("80.1");
  expect(measurementText(80, "weightKg", "kg")).toBe("80");
  expect(measurementText(80.15, "weightKg", "lbs")).toBe("176.7");
});
it("deletes only the chosen record, protects concurrent edits and prevents snapshot resurrection", () => {
  const old = row(1000, 80.15);
  const recent = row(2000, 79.65);
  expect(deleteMeasurementHistory([recent, old], old)).toEqual([recent]);
  expect(() => deleteMeasurementHistory([row(1000, 81)], old)).toThrow();
  expect(snapshotAfterMeasurementDeletion({ weightKg: 80.15, bodyFatPercent: 18 }, [], old)).toEqual({ weightKg: null, bodyFatPercent: 18 });
  expect(snapshotAfterMeasurementDeletion({ weightKg: 79.65 }, [old], recent).weightKg).toBe(80.15);
});
it("restores the imported original when deleting its correction and explains the outcome", () => {
  const imported = row(1000, 80.15, "health");
  const corrected = editMeasurementHistory([imported], imported, { weightKg: 80.25 });
  const remaining = deleteMeasurementHistory(corrected, corrected[0]);
  expect(getBodyCompositionHistoryPoints(remaining, "weight")[0].value).toBe(80.15);
  expect(measurementDeletionMessage(corrected[0], corrected)).toContain("original imported measurement");
  expect(measurementDeletionMessage(imported, [imported])).toContain("may return after syncing");
  expect(measurementDeletionMessage(row(2000, 81), [imported])).toContain("cannot be undone");
});
it("explains that earlier same-day data may appear after deleting the latest entry", () => {
  const morning = row(new Date(2026, 9, 14, 8).getTime(), 80.15);
  const evening = row(new Date(2026, 9, 14, 18).getTime(), 80.25);
  expect(measurementDeletionMessage(evening, [evening, morning])).toContain("Earlier measurements from this day");
  const remaining = deleteMeasurementHistory([evening, morning], evening);
  expect(getBodyCompositionHistoryPoints(remaining, "weight")[0].value).toBe(80.15);
});
