import { USER_NUTRITION_PROFILE_FIELD } from "../contracts";
import { normalizeCalorieTargets } from "./mealHelpers";

/** Only fields that can change the Nutrition screen's profile context. */
export function nutritionProfileContext(data: Record<string, any> | undefined) {
  const profile = data?.[USER_NUTRITION_PROFILE_FIELD];
  return {
    calorieTargets: normalizeCalorieTargets(profile?.calorieTargetsByDietPhase),
    proteinTargetGrams: typeof profile?.proteinTargetGrams === "number" && Number.isFinite(profile.proteinTargetGrams) && profile.proteinTargetGrams > 0
      ? Math.round(profile.proteinTargetGrams) : null,
    mealSections: Array.isArray(profile?.mealSections)
      ? profile.mealSections.filter((section: unknown): section is string => typeof section === "string" && section.trim().length > 0) : null,
    dietPhase: data?.dietPhase === "Cut" || data?.dietPhase === "Bulk" ? data.dietPhase as "Cut" | "Bulk" : "Maintain" as const,
    energyUnit: data?.energyUnit === "kJ" ? "kJ" as const : "kcal" as const,
  };
}
