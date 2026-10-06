import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import type { NutritionMeal } from "../contracts";
import { findPreviousSectionMeals, mealsToSavedItems } from "./quickLogHelpers";

function meal(id: string, date: string, section = "Breakfast"): NutritionMeal {
  const timestamp = Timestamp.fromDate(new Date(`${date}T12:00:00`));
  return {
    id,
    name: `Food ${id}`,
    calories: 100,
    proteinGrams: 10,
    carbGrams: 12,
    fatGrams: 2,
    source: { foodId: id, barcode: "8801234567890" },
    mealSection: section,
    loggedAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("nutrition quick log", () => {
  it("selects every item from the nearest previous matching meal", () => {
    const meals = [
      meal("old", "2026-09-29"),
      meal("recent-a", "2026-10-02"),
      meal("recent-b", "2026-10-02"),
      meal("lunch", "2026-10-03", "Lunch"),
      meal("current", "2026-10-04"),
    ];
    const result = findPreviousSectionMeals(meals, "Breakfast", new Date("2026-10-04T09:00:00"));
    expect(result.map((entry) => entry.id).sort()).toEqual(["recent-a", "recent-b"]);
  });

  it("copies macros and source metadata into a saved meal", () => {
    expect(mealsToSavedItems([meal("one", "2026-10-02")])[0]).toMatchObject({
      name: "Food one",
      calories: 100,
      proteinGrams: 10,
      source: { foodId: "one", barcode: "8801234567890" },
    });
  });
});
