import { describe, expect, it } from "vitest";
import { detailsChanged, detailsDraft, parseWorkoutDetails, workoutDurationLabel } from "./workoutDetails";

const original = { date: new Date(2026, 9, 12, 8, 45), durationMin: 62 };
const now = new Date(2026, 9, 23);
describe("saved workout corrections", () => {
  it("keeps an unchanged record's time and duration", () => {
    const next = parseWorkoutDetails(detailsDraft(original), original, now);
    expect(next).toEqual(original); expect(detailsChanged(next, original)).toBe(false);
  });
  it("moves the local calendar date across a month boundary", () => {
    const next = parseWorkoutDetails({ ...detailsDraft(original), date: "2026-09-30" }, original, now);
    expect([next.date.getFullYear(), next.date.getMonth(), next.date.getDate()]).toEqual([2026, 8, 30]);
    expect(next.durationMin).toBe(62);
  });
  it("rejects normalized impossible dates, future dates and invalid minutes", () => {
    for (const date of ["2026-02-30", "2026-10-24", "bad"]) expect(() => parseWorkoutDetails({ ...detailsDraft(original), date }, original, now)).toThrow();
    for (const minutes of ["60", "-1", "1.5", "a"]) expect(() => parseWorkoutDetails({ ...detailsDraft(original), minutes }, original, now)).toThrow();
  });
  it("distinguishes missing duration from a recorded zero", () => {
    const missing = { ...original, durationMin: null };
    expect(detailsDraft(missing)).toMatchObject({ hours: "", minutes: "" });
    expect(parseWorkoutDetails({ ...detailsDraft(missing), date: "2026-09-30" }, missing, now).durationMin).toBeNull();
    expect(parseWorkoutDetails({ ...detailsDraft(missing), hours: "00", minutes: "00" }, missing, now).durationMin).toBe(0);
    expect(workoutDurationLabel(null)).toBe("Duration not recorded"); expect(workoutDurationLabel(0)).toBe("0 min");
  });
  it("does not round legacy durations when only the date changes", () => {
    const legacy = { ...original, durationMin: 62.5 };
    expect(parseWorkoutDetails({ ...detailsDraft(legacy), date: "2026-09-30" }, legacy, now).durationMin).toBe(62.5);
  });
});
