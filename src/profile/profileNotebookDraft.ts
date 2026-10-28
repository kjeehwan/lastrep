export const profileEditorFields = {
  identity: ["nickname", "description", "profilePhotoUri"],
  training: ["trainingPhase", "trainingPhaseEdit"], diet: ["dietPhase", "dietPhaseEdit"], availability: ["availabilityDays"],
  units: ["weightUnit", "heightUnit", "energyUnit", "effortScale", "bodyWeight", "muscleMass", "leanMass", "cutCalories", "maintainCalories", "bulkCalories"],
  body: ["bodyWeight", "bodyFatPercent", "muscleMass", "leanMass"],
  tdee: ["tdeeAge", "tdeeHeightCm", "tdeeSex", "tdeeActivity", "cutCalories", "maintainCalories", "bulkCalories"],
  nutrition: ["cutCalories", "maintainCalories", "bulkCalories", "proteinTargetGrams"],
  sleep: ["sleepTargetHours"],
} as const;
export type ProfileEditor = keyof typeof profileEditorFields;

export function profileMeasurementChanged(raw: string, saved: string | undefined, previousUnit: string, nextUnit: string, mass = true): boolean {
  if (!raw.trim() || !Number.isFinite(Number(raw))) return false;
  if (!saved?.trim()) return true;
  let expected = Number(saved);
  if (mass && previousUnit !== nextUnit) {
    const kg = previousUnit === "lbs" ? expected * 0.453592 : expected;
    expected = Math.round((nextUnit === "lbs" ? kg * 2.20462 : kg) * 100) / 100;
  }
  return Math.abs(Number(raw) - expected) > 0.000001;
}

/** Cancelling one sheet must not revert remote updates or drafts in other sections. */
export function cancelProfileSection(current: string, before: string, section: ProfileEditor): string {
  const result = JSON.parse(current), original = JSON.parse(before);
  for (const key of profileEditorFields[section]) result[key] = original[key];
  return JSON.stringify(result);
}

export function validateProfileEditor(section: ProfileEditor, snapshot: string, beforeSnapshot?: string): string | null {
  const value = JSON.parse(snapshot);
  if (section === "sleep") {
    const hours = Number(value.sleepTargetHours);
    if (!value.sleepTargetHours.trim() || !Number.isFinite(hours) || Math.round(hours * 10) <= 0 || hours > 24) return "Enter a sleep target from 0.1 to 24 hours.";
  }
  if (section === "body") {
    const before = beforeSnapshot ? JSON.parse(beforeSnapshot) : null;
    for (const key of profileEditorFields.body) {
      const raw = value[key]?.trim() ?? "", number = Number(raw);
      if (raw && (!Number.isFinite(number) || number <= 0 || (key === "bodyFatPercent" && number > 100))) return "Enter positive measurements; body fat cannot exceed 100%. Leave unknown values blank.";
      if (key !== "bodyFatPercent" && raw && number * (value.weightUnit === "lbs" ? 0.453592 : 1) > 500) return "Body measurements must not exceed 500 kg (1,102 lb).";
      if (!raw && before?.[key]?.trim()) return "To remove saved measurements, use Progress on Home. Enter a replacement value here, or Cancel to keep it.";
    }
  }
  if (section === "nutrition") {
    for (const key of profileEditorFields.nutrition) {
      const raw = value[key].trim();
      if (raw && (!Number.isFinite(Number(raw)) || Number(raw) <= 0)) return "Enter positive nutrition targets or leave them blank.";
    }
  }
  if (section === "tdee" && (value.tdeeAge.trim() || value.tdeeHeightCm.trim())) {
    const age = Number(value.tdeeAge), height = Number(value.tdeeHeightCm);
    if (!Number.isFinite(age) || age < 13 || age > 100 || !Number.isFinite(height) || height < 100 || height > 250) return "Enter an age from 13 to 100 and height from 100 to 250 cm.";
  }
  return null;
}
