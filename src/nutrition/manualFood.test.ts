import { expect, it } from "vitest";
import { parseManualFood } from "./manualFood";

it("requires explicit, finite, non-negative whole-portion facts, including zero-calorie foods", () => {
  expect(parseManualFood(" Drink ", ["0", "0", "0", "0"])).toEqual({ name: "Drink", calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 });
  expect(parseManualFood("Meal", ["420.5", "20.2", "30", "10"])).toMatchObject({ calories: 420.5, proteinGrams: 20.2 });
  for (const values of [["", "0", "0", "0"], ["NaN", "0", "0", "0"], ["10", "-1", "0", "0"], ["Infinity", "0", "0", "0"]]) expect(parseManualFood("Meal", values)).toBeNull();
  expect(parseManualFood(" ", ["0", "0", "0", "0"])).toBeNull();
});
