import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPackagedFoods } from "./read-packaged-foods.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function auditFoodCatalog(directory = path.join(root, "assets/nutrition-data")) {
  const review = JSON.parse(fs.readFileSync(path.join(root, "src/nutrition/data/reviewedFoodCatalog.json"), "utf8"));
  const cases = JSON.parse(fs.readFileSync(path.join(root, "scripts/food-catalog-audit-cases.json"), "utf8"));
  const original = [...readPackagedFoods(directory), ...JSON.parse(fs.readFileSync(path.join(directory, "foods-generic.blob"), "utf8"))];
  const ids = new Set(original.map(food => food.id));
  const errors = [];
  const reviewed = new Map(review.metadata.map(row => [row.id, row]));
  if (reviewed.size !== review.metadata.length) errors.push("Duplicate reviewed metadata ID");
  for (const row of review.metadata) {
    if (!ids.has(row.id)) errors.push(`Metadata references missing ID: ${row.id}`);
    if (!row.identity || !Array.isArray(row.brands) || !row.basis) errors.push(`Incomplete metadata: ${row.id}`);
  }
  for (const row of review.additions) {
    if (ids.has(row.id)) errors.push(`Addition would overwrite an existing ID: ${row.id}`);
    ids.add(row.id);
    const { label, source } = row;
    if (!label || !Number.isFinite(label.servingGrams) || label.servingGrams <= 0 ||
      ![label.calories, label.proteinGrams, label.carbsGrams, label.fatGrams].every(value => Number.isFinite(value) && value >= 0) ||
      label.calories * 100 / label.servingGrams > 900 ||
      [label.proteinGrams, label.carbsGrams, label.fatGrams].some(value => value > label.servingGrams)) errors.push(`Invalid source label: ${row.id}`);
    if (!source?.urls?.length || source.urls.some(url => !url.startsWith("https://")) || !/^\d{4}-\d{2}-\d{2}$/.test(source.reviewedAt) || !source.basis || !source.market) errors.push(`Missing source provenance: ${row.id}`);
  }
  const searchable = [...original.filter(food => reviewed.get(food.id)?.searchable !== false), ...review.additions];
  const nutritionIssues = original.filter(food => !Number.isFinite(food.servingGrams) || food.servingGrams <= 0 || !Number.isFinite(food.caloriesPer100g) || food.caloriesPer100g < 0 || food.caloriesPer100g > 900 ||
    [food.proteinPer100g, food.carbsPer100g, food.fatPer100g].some(value => value != null && (!Number.isFinite(value) || value < 0 || value > 100)));
  const coverage = cases.map(entry => {
    const rx = new RegExp(entry.pattern, "i");
    const names = searchable.filter(food => {
      const metadata = reviewed.get(food.id);
      // No ingredient/category aliases: presence must be grounded in a food
      // name, an explicit brand field, or reviewed metadata.
      return [food.name, ...(food.brandNames ?? []), ...(food.brands ?? []), metadata?.identity ?? "", ...(metadata?.brands ?? [])].some(label => rx.test(label));
    });
    if (entry.required && !names.length) errors.push(`Required coverage missing: ${entry.query}`);
    const legacyAliasMatches = searchable.filter(food => (food.aliases ?? []).some(alias => rx.test(alias))).length;
    return { query: entry.query, status: names.length ? "present" : legacyAliasMatches ? "needs-metadata-review" : "needs-source-review", count: names.length, legacyAliasMatches, examples: names.slice(0, 2).map(food => food.name) };
  });
  return {
    reviewedAt: review.reviewedAt, originalRecords: original.length, addedRecords: review.additions.length,
    reviewedMetadataRecords: review.metadata.length,
    unstructuredBrandRecords: original.filter(food => food.id.startsWith("off-") && !food.brandNames && !reviewed.has(food.id)).length,
    nutritionIssueCount: nutritionIssues.length,
    nutritionIssueExamples: nutritionIssues.slice(0, 10).map(food => ({ id: food.id, name: food.name })),
    excludedFromNewSearch: review.metadata.filter(row => row.searchable === false).map(row => ({ id: row.id, reason: row.basis })),
    coverage, errors,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditFoodCatalog();
  const output = process.argv.indexOf("--output");
  if (output >= 0) fs.writeFileSync(process.argv[output + 1], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}
