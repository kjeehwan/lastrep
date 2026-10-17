import { describe, expect, it } from "vitest";
import { draftWorkoutSummary, mondayCalendarMatrix, recentWorkoutPeriods, recentDailyPeriods } from "./notebookPresentation";
import { computeWeeklyWorkoutMetrics, type WorkoutSummary } from "../workouts/homeInsights";

describe("notebook Home presentation", () => {
  it("compares two calendar windows across month/year boundaries without filling missing data with zero", () => {
    const periods = recentDailyPeriods([
      { key: "2027-01-02", value: 7.5 }, { key: "2027-01-01", value: 6.5 },
      { key: "2026-12-26", value: 8 }, { key: "2026-12-25", value: 0 },
      { key: "2026-12-24", value: NaN }, { key: "2027-01-03", value: 9 },
    ], new Date(2027, 0, 2, 20));
    expect(periods[0].days.map(({ key }) => key)).toEqual(["2027-01-02", "2027-01-01", "2026-12-31", "2026-12-30", "2026-12-29", "2026-12-28", "2026-12-27"]);
    expect(periods[0].average).toBe(7);
    expect(periods[0].recordedDays).toBe(2);
    expect(periods[1].days[0].key).toBe("2026-12-26");
    expect(periods[1].average).toBe(8);
    expect(periods[1].recordedDays).toBe(1);
    expect(periods[1].days[1].value).toBeNull();
    expect(recentDailyPeriods([], new Date())[0].average).toBeNull();
  });
  it("lays out Monday-first weeks without dropping or duplicating month dates", () => {
    for (const month of [new Date(2026, 9, 1), new Date(2027, 0, 1), new Date(2028, 1, 1)]) {
      const weeks = mondayCalendarMatrix(month);
      expect(weeks.every((week) => week.length === 7 && week[0].getDay() === 1 && week[6].getDay() === 0)).toBe(true);
      const days = weeks.flat().filter((date) => date.getMonth() === month.getMonth()).map((date) => date.getDate());
      const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      expect(days).toEqual(Array.from({ length: count }, (_, index) => index + 1));
    }
  });
  it("keeps dates from adjacent months available for the calendar display", () => {
    const weeks = mondayCalendarMatrix(new Date(2026, 9, 1));
    expect(weeks[0][0].getMonth()).toBe(8);
    expect(weeks[0][0].getDate()).toBe(28);
    expect(weeks.at(-1)?.at(-1)?.getMonth()).toBe(10);
  });
  it("describes only actual draft exercises and sets, without inventing completion", () => {
    expect(draftWorkoutSummary(null)).toBe("Choose a routine or build today's workout.");
    expect(draftWorkoutSummary({ exerciseNames: ["Bench Press"], exercises: [{ sets: [{}, {}, {}] }] })).toBe("1 exercise / 3 planned sets");
    expect(draftWorkoutSummary({ exerciseNames: ["Bench Press", "Treadmill"] })).toBe("2 exercises");
  });
  it("compares the same rolling windows as the existing metrics, newest first", () => {
    const now = new Date(2026, 9, 17, 12);
    const workouts: WorkoutSummary[] = [3, 0, 6, 7, 13, 14, -1].map((daysAgo) => ({
      id: String(daysAgo), title: `Session ${daysAgo}`, date: new Date(2026, 9, 17 - daysAgo, 12), trainingPhase: null, exercises: [],
    }));
    const periods = recentWorkoutPeriods(workouts, now);
    expect(periods[0].workouts.map(({ id }) => id)).toEqual(["0", "3", "6"]);
    expect(periods[1].workouts.map(({ id }) => id)).toEqual(["7", "13"]);
    const metrics = computeWeeklyWorkoutMetrics(workouts, now);
    expect(periods.map(({ workouts }) => workouts.length)).toEqual([metrics.workoutsThisWeek, metrics.workoutsLastWeek]);
    expect(workouts[0].id).toBe("3");
    expect(recentWorkoutPeriods([], now).every(({ workouts }) => workouts.length === 0)).toBe(true);
  });
});
