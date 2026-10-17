import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import type { NutritionMeal } from "../contracts";
import { dateMealLabels, DEFAULT_MEAL_IDS, formatMealTime, initialMealTime, mealLabel, mealSectionId, normalizeMealLabels, parseMealTime, reconcileMealLabelDraft, sectionMealTime } from "./mealOrganization";

function entry(minutes?: number | null, hour = 8): NutritionMeal {
  const timestamp = Timestamp.fromDate(new Date(2026, 9, 15, hour));
  return { id: String(hour), name: "Oats", calories: 100, proteinGrams: 5, loggedAt: timestamp, updatedAt: timestamp,
    mealSection: "Breakfast", ...(minutes === undefined ? {} : { mealTimeMinutes: minutes }) };
}

describe("meal labels and stable identities", () => {
  it("defaults to existing named IDs without migrating or changing entries", () => {
    const labels = normalizeMealLabels(null);
    expect(DEFAULT_MEAL_IDS.map((id) => mealLabel(id, labels))).toEqual(DEFAULT_MEAL_IDS);
    expect(mealSectionId({ mealSection: null })).toBe("Breakfast");
  });
  it("numbers all six default slots and retains additional custom sections", () => {
    const labels = normalizeMealLabels({ mode: "numbered" });
    expect(DEFAULT_MEAL_IDS.map((id) => mealLabel(id, labels))).toEqual(["Meal 1", "Meal 2", "Meal 3", "Meal 4", "Meal 5", "Meal 6"]);
    expect(mealLabel("Post-workout", labels)).toBe("Post-workout");
  });
  it("renames a label without changing its ID, food, or time", () => {
    const original = entry(480);
    const labels = normalizeMealLabels({ mode: "numbered", names: { Breakfast: "Early meal" } });
    expect(mealLabel(mealSectionId(original), labels)).toBe("Early meal");
    expect(original).toEqual(entry(480));
    expect(mealLabel("Breakfast", { ...labels, names: {} })).toBe("Meal 1");
  });
  it("normalizes invalid preferences and trims/limits names", () => {
    expect(normalizeMealLabels({ mode: "bad", names: { a: " ", b: 3, c: " C " } })).toEqual({ mode: "named", names: { c: "C" } });
    expect(mealLabel("Breakfast", normalizeMealLabels({ names: { Breakfast: "x".repeat(40) } }))).toHaveLength(24);
  });
});

describe("Profile meal-label draft synchronization", () => {
  it("rebases a clean form when Nutrition renames a meal", () => {
    const baseline = normalizeMealLabels(null);
    const remote = normalizeMealLabels({ mode: "numbered", names: { Breakfast: "Before work" } });
    expect(reconcileMealLabelDraft(baseline, baseline, remote)).toEqual({ baseline: remote, draft: remote });
  });
  it("preserves unsaved mode changes when another profile update arrives", () => {
    const baseline = normalizeMealLabels(null);
    const draft = normalizeMealLabels({ mode: "numbered" });
    const remote = normalizeMealLabels({ names: { Lunch: "Midday" } });
    expect(reconcileMealLabelDraft(baseline, draft, remote)).toEqual({ baseline, draft });
    expect(JSON.stringify(draft)).not.toBe(JSON.stringify(baseline));
  });
  it("detects a reset of custom names even if the mode remains unchanged", () => {
    const baseline = normalizeMealLabels({ names: { Breakfast: "Early" } });
    const draft = normalizeMealLabels(null);
    expect(reconcileMealLabelDraft(baseline, draft, baseline)).toEqual({ baseline, draft });
    expect(JSON.stringify(draft)).not.toBe(JSON.stringify(baseline));
  });
  it("ignores map-key ordering when deciding whether a draft is clean", () => {
    const baseline = { mode: "named" as const, names: { Lunch: "Midday", Breakfast: "Early" } };
    const draft = { mode: "named" as const, names: { Breakfast: "Early", Lunch: "Midday" } };
    const remote = normalizeMealLabels({ mode: "numbered" });
    expect(reconcileMealLabelDraft(baseline, draft, remote)).toEqual({ baseline: remote, draft: remote });
  });
});

describe("meal time", () => {
  it("does not invent meal times for historical entries", () => {
    expect(sectionMealTime([entry()])).toBeNull();
    expect(initialMealTime([entry()], new Date(2026, 9, 15, 17, 30))).toBeNull();
    expect(formatMealTime(null)).toBe("Set time");
  });
  it("defaults first entry and copies into empty meals to the current clock time", () => {
    expect(initialMealTime([], new Date(2026, 9, 15, 17, 32))).toBe(1052);
  });
  it("preserves the first meal time when adding food, regardless of result order", () => {
    expect(initialMealTime([entry(1000, 17), entry(480, 8)])).toBe(480);
    expect(initialMealTime([entry(0)])).toBe(0);
  });
  it("formats midnight and end of day and parses only valid clock values", () => {
    expect(formatMealTime(0)).toBe("00:00");
    expect(formatMealTime(1439)).toBe("23:59");
    expect(parseMealTime(" 8:05 ")).toBe(485);
    expect(parseMealTime("00:00")).toBe(0);
    for (const value of ["24:00", "12:60", "-1:00", "3:4", "", "1230"]) expect(parseMealTime(value)).toBeNull();
  });
});


describe("date-specific meal names", () => {
  it("overrides only the selected date and preserves defaults and stable IDs", () => {
    const defaults = normalizeMealLabels({ names: { Breakfast: "Morning meal", Lunch: "Lunch" } });
    const monday = dateMealLabels(defaults, { Breakfast: "First breakfast" });
    const tuesday = dateMealLabels(defaults, {});
    expect(mealLabel("Breakfast", monday)).toBe("First breakfast");
    expect(mealLabel("Breakfast", tuesday)).toBe("Morning meal");
    expect(mealLabel("Lunch", monday)).toBe("Lunch");
    expect(defaults.names.Breakfast).toBe("Morning meal");
    expect(dateMealLabels(defaults, { Breakfast: " " })).toEqual(defaults);
  });
});
