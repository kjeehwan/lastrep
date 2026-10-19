import { describe, expect, it } from "vitest";
import { cancelProfileSection, profileEditorFields, profileMeasurementChanged, validateProfileEditor } from "./profileNotebookDraft";
const saved = { nickname: "Daniel", description: "Training", profilePhotoUri: "cloud:old", trainingPhase: "Strength", dietPhase: "Maintain", availabilityDays: 4, weightUnit: "kg", heightUnit: "cm", energyUnit: "kcal", effortScale: "rpe", bodyWeight: "80.15", muscleMass: "35", leanMass: "65", bodyFatPercent: "15", cutCalories: "2200", maintainCalories: "2600", bulkCalories: "2900", proteinTargetGrams: "170", sleepTargetHours: "8", tdeeAge: "30", tdeeHeightCm: "175", tdeeSex: "male", tdeeActivity: "moderate" };
describe("Profile section drafts", () => {
  it("does not create a measurement for a unit-only display conversion", () => {
    expect(profileMeasurementChanged("176.7", "80.15", "kg", "lbs")).toBe(false);
    expect(profileMeasurementChanged("80.15", "176.7", "lbs", "kg")).toBe(false);
    expect(profileMeasurementChanged("80.16", "80.15", "kg", "kg")).toBe(true);
    expect(profileMeasurementChanged("15", "15", "kg", "lbs", false)).toBe(false);
    expect(profileMeasurementChanged("65", "", "kg", "kg")).toBe(true);
    expect(profileMeasurementChanged("", "65", "kg", "kg")).toBe(false);
  });
  it("cancels identity and staged photo without undoing another section or remote target", () => {
    const draft = { ...saved, nickname: "Changed", description: "Draft", profilePhotoUri: "file:new", sleepTargetHours: "7.5", availabilityDays: 5 };
    expect(JSON.parse(cancelProfileSection(JSON.stringify(draft), JSON.stringify(saved), "identity"))).toEqual({ ...draft, nickname: saved.nickname, description: saved.description, profilePhotoUri: saved.profilePhotoUri });
  });
  it("cancels units and associated converted draft values together", () => {
    const draft = { ...saved, weightUnit: "lbs", bodyWeight: "176.7", muscleMass: "77.2", leanMass: "143.3", energyUnit: "kJ", cutCalories: "9205", maintainCalories: "10878", bulkCalories: "12134", sleepTargetHours: "7" };
    expect(JSON.parse(cancelProfileSection(JSON.stringify(draft), JSON.stringify(saved), "units"))).toEqual({ ...saved, sleepTargetHours: "7" });
  });
  it("cancels TDEE application without undoing the protein target", () => {
    const draft = { ...saved, tdeeAge: "40", maintainCalories: "3000", proteinTargetGrams: "180" };
    expect(JSON.parse(cancelProfileSection(JSON.stringify(draft), JSON.stringify(saved), "tdee"))).toEqual({ ...saved, proteinTargetGrams: "180" });
  });
  it("covers every grouped sheet including independently named body metrics", () => {
    expect(Object.keys(profileEditorFields)).toHaveLength(9);
    expect(profileEditorFields.body).toEqual(["bodyWeight", "bodyFatPercent", "muscleMass", "leanMass"]);
  });
});
describe("Profile editor validation", () => {
  it("rejects invalid sleep targets and accepts decimal hours", () => {
    for (const value of ["", "0", "0.01", "25", "NaN", "-1"]) expect(validateProfileEditor("sleep", JSON.stringify({ ...saved, sleepTargetHours: value }))).not.toBeNull();
    expect(validateProfileEditor("sleep", JSON.stringify({ ...saved, sleepTargetHours: "7.5" }))).toBeNull();
  });
  it("validates body metrics without conflating lean and skeletal muscle", () => {
    for (const [key, value] of [["bodyWeight", "-1"], ["bodyFatPercent", "101"], ["leanMass", "NaN"], ["muscleMass", "0"]]) expect(validateProfileEditor("body", JSON.stringify({ ...saved, [key]: value }))).not.toBeNull();
    expect(validateProfileEditor("body", JSON.stringify({ ...saved, leanMass: "", muscleMass: "" }))).toBeNull();
    expect(validateProfileEditor("body", JSON.stringify({ ...saved, leanMass: "" }), JSON.stringify(saved))).toContain("Progress on Home");
    expect(validateProfileEditor("body", JSON.stringify({ ...saved, weightUnit: "lbs", bodyWeight: "1200" }))).not.toBeNull();
  });
  it("accepts blank nutrition targets but rejects zero and nonnumeric entries", () => {
    expect(validateProfileEditor("nutrition", JSON.stringify({ ...saved, cutCalories: "" }))).toBeNull();
    expect(validateProfileEditor("nutrition", JSON.stringify({ ...saved, proteinTargetGrams: "0" }))).not.toBeNull();
    expect(validateProfileEditor("nutrition", JSON.stringify({ ...saved, bulkCalories: "NaN" }))).not.toBeNull();
  });
  it("preserves the existing TDEE age and canonical-height limits", () => {
    expect(validateProfileEditor("tdee", JSON.stringify(saved))).toBeNull();
    for (const patch of [{ tdeeAge: "12" }, { tdeeHeightCm: "99" }, { tdeeAge: "101" }, { tdeeHeightCm: "251" }]) expect(validateProfileEditor("tdee", JSON.stringify({ ...saved, ...patch }))).not.toBeNull();
    expect(validateProfileEditor("tdee", JSON.stringify({ ...saved, tdeeAge: "", tdeeHeightCm: "" }))).toBeNull();
  });
});
