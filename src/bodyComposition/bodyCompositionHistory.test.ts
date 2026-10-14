import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import type { BodyCompositionHistoryEntry } from "../contracts";
import {
  getBodyCompositionHistoryPoints,
  hasLegacyMuscleMassHistory,
} from "./bodyCompositionHistory";

const entry = (
  date: string,
  values: Partial<BodyCompositionHistoryEntry> = {}
): BodyCompositionHistoryEntry => ({
  recordedAt: Timestamp.fromDate(new Date(date)),
  source: "health",
  originLabel: "Health Connect",
  weightKg: null,
  bodyFatPercent: null,
  leanBodyMassKg: null,
  skeletalMuscleMassKg: null,
  legacyMuscleMassKg: null,
  ...values,
});

describe("body composition history", () => {
  it("keeps sparse measurements on their actual timestamps", () => {
    const points = getBodyCompositionHistoryPoints(
      [
        entry("2026-01-01T00:00:00Z", { bodyFatPercent: 18 }),
        entry("2026-06-01T00:00:00Z", { bodyFatPercent: 16 }),
        entry("2026-06-02T00:00:00Z", { weightKg: 80 }),
      ],
      "bodyFat"
    );

    expect(points.map((point) => point.value)).toEqual([18, 16]);
    expect(points[1].recordedAtMs - points[0].recordedAtMs).toBeGreaterThan(100 * 24 * 60 * 60 * 1000);
  });

  it("keeps lean body mass separate from skeletal muscle", () => {
    const history = [
      entry("2026-06-01T00:00:00Z", { leanBodyMassKg: 65 }),
      entry("2026-06-02T00:00:00Z", { skeletalMuscleMassKg: 38, source: "manual" }),
    ];

    expect(getBodyCompositionHistoryPoints(history, "leanBodyMass").map((point) => point.value)).toEqual([65]);
    expect(getBodyCompositionHistoryPoints(history, "skeletalMuscleMass").map((point) => point.value)).toEqual([38]);
  });

  it("keeps recorded days visible even when their values are unchanged", () => {
    const points = getBodyCompositionHistoryPoints(
      [
        entry("2026-01-01T00:00:00Z", { bodyFatPercent: 18, source: "manual" }),
        entry("2026-02-01T00:00:00Z", { bodyFatPercent: 18, weightKg: 80, source: "manual" }),
        entry("2026-03-01T00:00:00Z", { bodyFatPercent: 17, source: "manual" }),
      ],
      "bodyFat"
    );

    expect(points.map((point) => point.value)).toEqual([18, 18, 17]);
  });

  it("keeps only the latest local-day measurement for each metric without changing history", () => {
    const history = [
      entry("2026-10-14T08:00:00", { weightKg: 80.15, bodyFatPercent: 18, source: "manual" }),
      entry("2026-10-14T18:00:00", { weightKg: 80.25 }),
      entry("2026-10-15T08:00:00", { weightKg: 80.25 }),
    ];
    const points = getBodyCompositionHistoryPoints(history, "weight");
    expect(points.map((point) => point.value)).toEqual([80.25, 80.25]);
    expect(points[0].recordedAtMs).toBe(history[1].recordedAt!.toMillis());
    expect(getBodyCompositionHistoryPoints(history, "bodyFat")[0].recordedAtMs).toBe(history[0].recordedAt!.toMillis());
    expect(history).toHaveLength(3);
  });
  it("prefers corrections only at equal timestamps and separates local midnight", () => {
    const history = [
      entry("2026-10-14T23:59:00", { weightKg: 80.15 }),
      entry("2026-10-14T23:59:00", { weightKg: 80.25, source: "manual" }),
      entry("2026-10-15T00:01:00", { weightKg: 79.95 }),
    ];
    const points = getBodyCompositionHistoryPoints(history.reverse(), "weight");
    expect(points.map((point) => point.value)).toEqual([80.25, 79.95]);
    expect(points[0].source).toBe("manual");
  });

  it("detects unclassified legacy muscle values", () => {
    expect(hasLegacyMuscleMassHistory([entry("2026-06-01T00:00:00Z", { legacyMuscleMassKg: 42 })])).toBe(true);
  });
});
