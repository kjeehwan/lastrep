import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  buildDecisionNutritionSummary,
  computeNutritionTotals,
  getDefaultMealTime,
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
    });
  });

  it("builds a decision nutrition summary", () => {
    expect(
      buildDecisionNutritionSummary([
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
      caloriesConsumedToday: 870,
      proteinGramsToday: 40,
      calorieTargetAdherence: null,
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

  it("builds a default current-time string", () => {
    expect(getDefaultMealTime(new Date(2026, 3, 1, 3, 4, 0, 0))).toBe("03:04");
  });
});
