import { describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import { currentPhaseWeek, phaseForDate, phaseName, phasePatch, phaseWeek, type PhaseEdit } from "./phaseState";
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
    expect(phasePatch({ trainingPhase: "Strength", trainingPhaseStartedAt: old, dietPhase: "Bulk" }, { trainingPhase: "Power" }, now)).toEqual({ trainingPhase: "Power", trainingPhaseName: "", trainingPhaseWeekAnchorAt: now, trainingPhaseWeekBase: 1, trainingPhaseStartedAt: now, trainingPhaseHistory: [{ phase: "Strength", startedAt: old }, { phase: "Power", startedAt: now }] });
  });
  const start = Timestamp.fromMillis(1000);
  const now = Timestamp.fromMillis(604801000);
  const current = { trainingPhase: "Strength", trainingPhaseStartedAt: start, trainingPhaseHistory: [{ phase: "Strength", startedAt: start }], dietPhase: "Bulk" };
  const edit: PhaseEdit = { mode: "edit", phase: "Strength", name: "Winter strength", week: null, expectedPhase: "Strength", expectedStartMs: 1000, requestId: "test-edit" };
  it("renames without restarting or changing the type used by recommendations", () => {
    const patch = phasePatch(current, { trainingPhase: edit }, now);
    expect(patch).toEqual({ trainingPhaseName: "Winter strength", trainingPhaseLastEditId: "test-edit" });
    expect(phaseName({ ...current, ...patch }, "trainingPhase")).toBe("Winter strength");
    expect(phaseName({ ...current, trainingPhaseName: " " }, "trainingPhase")).toBe("Strength");
    expect(currentPhaseWeek({ ...current, ...patch }, "trainingPhase", now.toMillis())).toBe(2);
  });
  it("corrects a week independently of the true start and advances it", () => {
    const patch = phasePatch(current, { trainingPhase: { ...edit, week: 8 } }, now);
    const updated = { ...current, ...patch };
    expect(updated.trainingPhaseStartedAt).toBe(start);
    expect(updated.trainingPhaseHistory).toBe(current.trainingPhaseHistory);
    expect(currentPhaseWeek(updated, "trainingPhase", now.toMillis())).toBe(8);
    expect(currentPhaseWeek(updated, "trainingPhase", now.toMillis() + 604800000)).toBe(9);
  });
  it("starts another phase of the same type with a separate history entry", () => {
    const patch = phasePatch(current, { trainingPhase: { ...edit, mode: "new", week: 3 } }, now);
    expect(patch.trainingPhaseStartedAt).toBe(now);
    expect(patch.trainingPhaseHistory).toHaveLength(2);
    expect(currentPhaseWeek({ ...current, ...patch }, "trainingPhase", now.toMillis())).toBe(3);
    expect(patch).not.toHaveProperty("dietPhase");
  });
  it("clears the preceding phase's custom name and week on a legacy type change", () => {
    const patch = phasePatch({ ...current, trainingPhaseName: "Winter", trainingPhaseWeekBase: 8 }, { trainingPhase: "Power" }, now);
    expect(patch.trainingPhaseName).toBe("");
    expect(patch.trainingPhaseWeekBase).toBe(1);
  });
  it("rejects stale edits and invalid weeks without writing a patch", () => {
    expect(() => phasePatch({ ...current, trainingPhaseStartedAt: now }, { trainingPhase: edit }, now)).toThrow("changed elsewhere");
    for (const week of [0, 1.5, 1000, NaN]) expect(() => phasePatch(current, { trainingPhase: { ...edit, week } }, now)).toThrow("whole week");
    expect(() => phasePatch(current, { trainingPhase: { ...edit, mode: "new" } }, now)).toThrow("whole week");
    expect(() => phasePatch(current, { trainingPhase: { ...edit, phase: "Power" } }, now)).toThrow("Start new phase");
  });
  it("does not restart a phase twice when a Profile save is retried", () => {
    const change: PhaseEdit = { ...edit, mode: "new", week: 1 };
    const patch = phasePatch(current, { trainingPhase: change }, now);
    expect(phasePatch({ ...current, ...patch }, { trainingPhase: change }, Timestamp.fromMillis(now.toMillis() + 1000))).toEqual({});
  });
  it("does not invent a legacy start when only a name is edited", () => {
    const patch = phasePatch({ trainingPhase: "Strength" }, { trainingPhase: { ...edit, expectedStartMs: null } }, now);
    expect(currentPhaseWeek(patch, "trainingPhase", now.toMillis())).toBeNull();
    expect(patch).not.toHaveProperty("trainingPhaseStartedAt");
  });
  it("handles a legacy account whose phase type was never stored", () => {
    const patch = phasePatch({}, { dietPhase: { ...edit, phase: "Maintain", expectedPhase: "Maintain", expectedStartMs: null, name: "Steady" } }, now);
    expect(patch.dietPhase).toBe("Maintain");
    expect(phaseName(patch, "dietPhase")).toBe("Steady");
    expect(currentPhaseWeek(patch, "dietPhase", now.toMillis())).toBeNull();
  });
  it("ignores an old week correction if an older app starts a later phase", () => {
    expect(currentPhaseWeek({ trainingPhaseStartedAt: now, trainingPhaseWeekAnchorAt: start, trainingPhaseWeekBase: 7 }, "trainingPhase", now.toMillis())).toBe(1);
  });
  it("does not reset unchanged phases or fabricate legacy history", () => {
    const now = Timestamp.now();
    expect(phasePatch({ dietPhase: "Bulk" }, { dietPhase: "Bulk" }, now)).toEqual({});
    expect(phasePatch({ dietPhase: "Bulk" }, { dietPhase: "Cut" }, now).dietPhaseHistory).toEqual([{ phase: "Cut", startedAt: now }]);
  });
});
