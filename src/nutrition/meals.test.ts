import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  buildDecisionNutritionSummary,
  buildTrendReport,
  classifyCalorieTargetAdherence,
  computeDailyCalorieProgress,
  computeNutritionTotals,
  getDefaultMealTime,
  normalizeCalorieTargets,
  parseMealForm,
} from "./mealHelpers";

describe("nutrition meal helpers", () => {
  it("computes daily totals", () => {
    expect(
      computeNutritionTotals([
        {
          id: "a",
          name: "Lunch",
          calories: 650,
          proteinGrams: 40,
          loggedAt: Timestamp.fromMillis(1_700_000_000_000),
          updatedAt: Timestamp.fromMillis(1_700_000_000_500),
        },
        {
          id: "b",
          name: "Snack",
          calories: 220,
          proteinGrams: null,
          loggedAt: Timestamp.fromMillis(1_700_000_100_000),
          updatedAt: Timestamp.fromMillis(1_700_000_100_500),
        },
      ])
    ).toEqual({
      calories: 870,
      proteinGrams: 40,
      carbGrams: 0,
      fatGrams: 0,
    });
  });

  it("classifies calorie target adherence with completed-day bands", () => {
    expect(classifyCalorieTargetAdherence(1700, 2000)).toBe("below_target");
    expect(classifyCalorieTargetAdherence(1950, 2000)).toBe("on_target");
    expect(classifyCalorieTargetAdherence(2250, 2000)).toBe("above_target");
    expect(classifyCalorieTargetAdherence(null, 2000)).toBeNull();
    expect(classifyCalorieTargetAdherence(1950, null)).toBeNull();
  });

  it("computes daily calorie progress against a target", () => {
    expect(computeDailyCalorieProgress(1800, 2200)).toEqual({
      remainingCalories: 400,
      overTargetCalories: 0,
    });
    expect(computeDailyCalorieProgress(2450, 2200)).toEqual({
      remainingCalories: 0,
      overTargetCalories: 250,
    });
    expect(computeDailyCalorieProgress(1200, null)).toEqual({
      remainingCalories: null,
      overTargetCalories: null,
    });
  });

  it("builds decision nutrition summary from completed-day windows", () => {
    const summary = buildDecisionNutritionSummary(
      [
        {
          id: "today-breakfast",
          name: "Breakfast",
          calories: 500,
          proteinGrams: 35,
          loggedAt: Timestamp.fromDate(new Date("2026-04-02T08:00:00.000+09:00")),
          updatedAt: Timestamp.fromDate(new Date("2026-04-02T08:00:00.000+09:00")),
        },
      ],
      [
        {
          id: "yesterday",
          name: "Dinner",
          calories: 1800,
          proteinGrams: 90,
          loggedAt: Timestamp.fromDate(new Date("2026-04-01T20:00:00.000+09:00")),
          updatedAt: Timestamp.fromDate(new Date("2026-04-01T20:00:00.000+09:00")),
        },
        {
          id: "day-2",
          name: "Lunch",
          calories: 1950,
          proteinGrams: 110,
          loggedAt: Timestamp.fromDate(new Date("2026-03-31T12:00:00.000+09:00")),
          updatedAt: Timestamp.fromDate(new Date("2026-03-31T12:00:00.000+09:00")),
        },
        {
          id: "day-3",
          name: "Lunch",
          calories: 2050,
          proteinGrams: 100,
          loggedAt: Timestamp.fromDate(new Date("2026-03-30T12:00:00.000+09:00")),
          updatedAt: Timestamp.fromDate(new Date("2026-03-30T12:00:00.000+09:00")),
        },
      ],
      2000,
      new Date("2026-04-02T10:00:00.000+09:00")
    );

    expect(summary).toEqual({
      caloriesConsumedToday: 500,
      proteinGramsToday: 35,
      calorieTarget: 2000,
      yesterdayCalories: 1800,
      yesterdayAdherence: "on_target",
      recentAdherence: "on_target",
      recentCompletedDaysTracked: 3,
    });
  });

  it("requires enough completed days before reporting recent adherence", () => {
    const summary = buildDecisionNutritionSummary(
      [],
      [
        {
          id: "yesterday",
          name: "Lunch",
          calories: 1400,
          proteinGrams: null,
          loggedAt: Timestamp.fromDate(new Date("2026-04-01T12:00:00.000+09:00")),
          updatedAt: Timestamp.fromDate(new Date("2026-04-01T12:00:00.000+09:00")),
        },
      ],
      2000,
      new Date("2026-04-02T10:00:00.000+09:00")
    );

    expect(summary.yesterdayAdherence).toBe("below_target");
    expect(summary.recentAdherence).toBeNull();
    expect(summary.recentCompletedDaysTracked).toBe(1);
  });

  it("normalizes calorie targets from partial user data", () => {
    expect(normalizeCalorieTargets({ Cut: 2100, Bulk: 2900 })).toEqual({
      Cut: 2100,
      Maintain: null,
      Bulk: 2900,
    });
  });

  it("parses valid meal form values", () => {
    const result = parseMealForm(
      {
        name: "Breakfast",
        calories: "520",
        proteinGrams: "30",
        time: "08:15",
      },
      new Date("2026-04-01T00:00:00.000Z")
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.name).toBe("Breakfast");
      expect(result.payload.calories).toBe(520);
      expect(result.payload.proteinGrams).toBe(30);
      expect(result.payload.loggedAt.toDate().getHours()).toBe(8);
      expect(result.payload.loggedAt.toDate().getMinutes()).toBe(15);
    }
  });

  it("rejects invalid meal values", () => {
    expect(
      parseMealForm(
        {
          name: "",
          calories: "0",
          proteinGrams: "-1",
          time: "25:99",
        },
        new Date("2026-04-01T00:00:00.000Z")
      )
    ).toEqual({
      ok: false,
      message: "Enter a meal name.",
    });
  });

  it("builds a trend report from a list of meals", () => {
    const meals = [
      {
        id: "1",
        name: "Meal 1",
        calories: 1000,
        proteinGrams: 50,
        loggedAt: Timestamp.fromDate(new Date("2026-04-01T12:00:00")), // Local
        updatedAt: Timestamp.now(),
      },
      {
        id: "2",
        name: "Meal 2",
        calories: 1000,
        proteinGrams: 50,
        loggedAt: Timestamp.fromDate(new Date("2026-04-01T18:00:00")), // Local, same day
        updatedAt: Timestamp.now(),
      },
      {
        id: "3",
        name: "Meal 3",
        calories: 1500,
        proteinGrams: 80,
        loggedAt: Timestamp.fromDate(new Date("2026-03-31T12:00:00")), // Local, prev day
        updatedAt: Timestamp.now(),
      },
    ];

    const report = buildTrendReport(meals, 2000);

    expect(report.daysTracked).toBe(2);
    expect(report.averageCalories).toBe(1750); // (2000 + 1500) / 2
    expect(report.consistencyScore).toBe(50); // 1 out of 2 days on target
    expect(report.dailyHistory).toHaveLength(2);
    expect(report.dailyHistory[0].calories).toBe(2000);
    expect(report.dailyHistory[0].adherence).toBe("on_target");
    expect(report.dailyHistory[1].calories).toBe(1500);
    expect(report.dailyHistory[1].adherence).toBe("below_target");
  });

  it("builds a default current-time string", () => {
    expect(getDefaultMealTime(new Date(2026, 3, 1, 3, 4, 0, 0))).toBe("03:04");
  });
});
