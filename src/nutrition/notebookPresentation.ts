import type { NutritionMeal } from "../contracts";
import { mealSectionId } from "./mealOrganization";

export function macroPercentages(values: number[]): number[] {
  const safe = values.map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (!total) return safe.map(() => 0);
  const exact = safe.map((value) => value / total * 100);
  const result = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, fraction: value - result[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  // Allocate the remainder once, rather than independently rounding each segment.
  const remaining = 100 - result.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < remaining; i++) result[order[i].index]++;
  return result;
}

export function adjacentDiaryDate(key: string, offset: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day + offset, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function macroLabelCenters(fractions: number[], width: number, labelWidth: number): number[] {
  if (width <= 0) return fractions.map(() => 0);
  const half = Math.min(labelWidth / 2, width / (2 * fractions.length));
  let start = 0;
  const centers = fractions.map((fraction) => {
    const center = (start + fraction / 2) * width;
    start += fraction;
    return Math.max(half, Math.min(width - half, center));
  });
  for (let i = 1; i < centers.length; i++) centers[i] = Math.max(centers[i], centers[i - 1] + half * 2);
  centers[centers.length - 1] = Math.min(width - half, centers[centers.length - 1]);
  for (let i = centers.length - 2; i >= 0; i--) centers[i] = Math.min(centers[i], centers[i + 1] - half * 2);
  return centers;
}

export function foodNamesBySection(meals: Pick<NutritionMeal, "name" | "mealSection">[]) {
  const names = new Map<string, string[]>();
  for (const meal of meals) {
    const section = mealSectionId(meal);
    const entries = names.get(section) ?? [];
    entries.push(meal.name);
    names.set(section, entries);
  }
  return names;
}

