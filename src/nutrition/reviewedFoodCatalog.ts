import review from "./data/reviewedFoodCatalog.json";
import type { FoodItem } from "./foodDb";

// A sidecar preserves every existing food object's identity/nutrition and keeps
// reviewed search labels separate from unstructured ingredient/category aliases.
const metadata = new Map<string, { identity: string; brands: string[]; searchable?: boolean }>([
  ...review.metadata.map(row => [row.id, row] as const),
  ...review.additions.map(row => [row.id, row] as const),
]);
export const reviewedFoodMetadata = (id: string) => metadata.get(id);
export const reviewedSearchAliases = (id: string) => {
  const row = metadata.get(id);
  return row ? [row.identity, ...row.brands].join(" ") : "";
};
export const reviewedFoods: FoodItem[] = review.additions.map(row => ({
  id: row.id, name: row.name, aliases: [...row.aliases, ...row.brands, row.identity],
  sourceType: row.sourceType as FoodItem["sourceType"],
  servingLabel: row.label.servingLabel, servingGrams: row.label.servingGrams,
  caloriesPer100g: row.label.calories * 100 / row.label.servingGrams,
  proteinPer100g: row.label.proteinGrams * 100 / row.label.servingGrams,
  carbsPer100g: row.label.carbsGrams * 100 / row.label.servingGrams,
  fatPer100g: row.label.fatGrams * 100 / row.label.servingGrams,
}));
