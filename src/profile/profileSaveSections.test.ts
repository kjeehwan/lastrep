import { expect, it } from "vitest";
import { profileSaveSections } from "./profileSaveSections";

const saved = { nickname: "Example", profilePhotoUri: "lastrep-photo:old", sleepTargetHours: "8", weightUnit: "kg", cutCalories: "2200", maintainCalories: "2600", bulkCalories: "2900", proteinTargetGrams: "170", trainingPhase: "Strength", dietPhase: "Maintain" };
const plan = (patch: Record<string, unknown>) => profileSaveSections(JSON.stringify({ ...saved, ...patch }), JSON.stringify(saved));

it("includes phase name/week-only drafts in the Profile save", () => {
  expect(plan({ trainingPhaseEdit: '{"name":"Winter","week":7}' }).profile).toBe(true);
  expect(plan({ dietPhaseEdit: '{"mode":"new","phase":"Maintain","week":1}' }).profile).toBe(true);
});

it("skips all unrelated writes for photo replacement or removal", () => {
  expect(plan({ profilePhotoUri: "file:new" })).toEqual({ photoOnly: true, profile: false, sleep: false, nutrition: false });
  expect(plan({ profilePhotoUri: "" })).toEqual({ photoOnly: true, profile: false, sleep: false, nutrition: false });
});

it("saves only sections with staged changes", () => {
  expect(plan({ nickname: "Changed" })).toEqual({ photoOnly: false, profile: true, sleep: false, nutrition: false });
  expect(plan({ sleepTargetHours: "7.5" })).toEqual({ photoOnly: false, profile: false, sleep: true, nutrition: false });
  expect(plan({ proteinTargetGrams: "180" })).toEqual({ photoOnly: false, profile: false, sleep: false, nutrition: true });
  expect(plan({ trainingPhase: "Power", maintainCalories: "2700" })).toEqual({ photoOnly: false, profile: true, sleep: false, nutrition: true });
});

it("retains all identity, phase, unit, availability and TDEE persistence", () => {
  for (const field of ["goal", "description", "trainingPhase", "dietPhase", "weightUnit", "heightUnit", "energyUnit", "effortScale", "availabilityDays", "tdeeAge", "tdeeHeightCm", "tdeeSex", "tdeeActivity"]) {
    expect(plan({ [field]: "changed" }).profile, field).toBe(true);
  }
  for (const field of ["cutCalories", "maintainCalories", "bulkCalories", "proteinTargetGrams"]) {
    expect(plan({ [field]: "changed" }).nutrition, field).toBe(true);
  }
});

it("does not skip initial saves without a baseline", () => {
  expect(profileSaveSections(JSON.stringify(saved), null)).toEqual({ photoOnly: false, profile: true, sleep: true, nutrition: true });
});

it("never commits a photo early when body, labels or other drafts also changed", () => {
  for (const patch of [{ bodyWeight: "81" }, { mealLabels: { meal1: "Breakfast" } }, { sleepTargetHours: "7" }, { nickname: "Changed" }]) {
    expect(plan({ profilePhotoUri: "file:new", ...patch }).photoOnly).toBe(false);
  }
  expect(plan({}).photoOnly).toBe(false);
});
