export type ManualFood = { name: string; calories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
export function parseManualFood(name: string, values: string[]): ManualFood | null {
  const clean = name.trim();
  if (!clean || clean.length > 80 || values.length !== 4 || values.some((value) => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0)) return null;
  const [calories, proteinGrams, carbGrams, fatGrams] = values.map(Number);
  return { name: clean, calories, proteinGrams, carbGrams, fatGrams };
}
