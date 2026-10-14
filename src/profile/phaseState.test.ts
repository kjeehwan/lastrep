import { describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import { phaseForDate, phasePatch, phaseWeek } from "./phaseState";
vi.mock("../config/firebaseConfig", () => ({ db: {} }));

describe("phase state", () => {
  it("shows only phases with known dates in day details", () => {
    const history = [{ phase: "Strength", startedAt: Timestamp.fromMillis(500) }, { phase: "Power", startedAt: Timestamp.fromMillis(1000) }];
    expect(phaseForDate(history, "Power", 1000, 499)).toBeNull();
    expect(phaseForDate(history, "Power", 1000, 750)).toBe("Strength");
    expect(phaseForDate(history, "Power", 1000, 1200)).toBe("Power");
    expect(phaseForDate([], "Power", null, 1200)).toBeNull();
  });
  it("does not invent a week for an unknown start", () => {
    expect(phaseWeek(null, Date.now())).toBeNull();
    expect(phaseWeek(100, 100)).toBe(1);
    expect(phaseWeek(100, 604800100)).toBe(2);
  });
  it("resets only the changed phase and preserves known history", () => {
    const old = Timestamp.fromMillis(100);
    const now = Timestamp.fromMillis(1000);
    expect(phasePatch({ trainingPhase: "Strength", trainingPhaseStartedAt: old, dietPhase: "Bulk" }, { trainingPhase: "Power" }, now)).toEqual({ trainingPhase: "Power", trainingPhaseStartedAt: now, trainingPhaseHistory: [{ phase: "Strength", startedAt: old }, { phase: "Power", startedAt: now }] });
  });
  it("does not reset unchanged phases or fabricate legacy history", () => {
    const now = Timestamp.now();
    expect(phasePatch({ dietPhase: "Bulk" }, { dietPhase: "Bulk" }, now)).toEqual({});
    expect(phasePatch({ dietPhase: "Bulk" }, { dietPhase: "Cut" }, now).dietPhaseHistory).toEqual([{ phase: "Cut", startedAt: now }]);
  });
});
