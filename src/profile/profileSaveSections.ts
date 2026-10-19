const profileFields = ["goal", "nickname", "description", "trainingPhase", "dietPhase", "weightUnit", "heightUnit", "energyUnit", "effortScale", "availabilityDays", "tdeeAge", "tdeeHeightCm", "tdeeSex", "tdeeActivity"];
const nutritionFields = ["cutCalories", "maintainCalories", "bulkCalories", "proteinTargetGrams"];

/** A photo-only save must not rewrite unrelated account preferences. */
export function profileSaveSections(currentSnapshot: string, savedSnapshot: string | null) {
  const current = JSON.parse(currentSnapshot);
  const saved = savedSnapshot ? JSON.parse(savedSnapshot) : null;
  const changed = (fields: string[]) => !saved || fields.some((field) => current[field] !== saved[field]);
  return {
    photoOnly: !!saved && current.profilePhotoUri !== saved.profilePhotoUri &&
      [...new Set([...Object.keys(current), ...Object.keys(saved)])]
        .filter((key) => key !== "profilePhotoUri")
        .every((key) => JSON.stringify(current[key]) === JSON.stringify(saved[key])),
    profile: changed(profileFields),
    sleep: changed(["sleepTargetHours"]),
    nutrition: changed(nutritionFields),
  };
}
