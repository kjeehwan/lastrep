import { expect, it } from "vitest";
import { USER_NUTRITION_PROFILE_FIELD } from "../contracts";
import { nutritionProfileContext } from "./profileContext";

it("ignores unrelated health, readiness and decision updates", () => {
  expect(nutritionProfileContext({ dietPhase: "Bulk" }))
    .toEqual(nutritionProfileContext({ dietPhase: "Bulk", sleepProfile: { hours: 8 }, usage: { decisions: {} } }));
});

it("reflects targets, phases, sections and units from the live snapshot", () => {
  expect(nutritionProfileContext({ dietPhase: "Cut", energyUnit: "kJ", [USER_NUTRITION_PROFILE_FIELD]: {
    calorieTargetsByDietPhase: { Cut: 2100, Maintain: 2500, Bulk: 2800 }, proteinTargetGrams: 170,
    mealSections: ["Breakfast", "Lunch", "Dinner"],
  } })).toEqual({ calorieTargets: { Cut: 2100, Maintain: 2500, Bulk: 2800 }, proteinTargetGrams: 170,
    mealSections: ["Breakfast", "Lunch", "Dinner"], dietPhase: "Cut", energyUnit: "kJ" });
});
