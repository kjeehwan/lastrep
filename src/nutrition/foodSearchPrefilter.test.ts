import fs from "node:fs/promises";
import { expect, it } from "vitest";
import { foodQuery, foodSearchText, matchesFoodQuery, mayMatchFoodQuery } from "./foodSearchRanking";
import { reviewedSearchAliases } from "./reviewedFoodCatalog";

it("never excludes full-matcher results across the packaged catalog", async () => {
  const rows: [string, string, string, number][] = JSON.parse(await fs.readFile("assets/nutrition-data/foods-search-catalog.blob", "utf8"));
  const prepared = rows.map(([id, name, aliases]) => ({ name, aliases: `${aliases} ${reviewedSearchAliases(id)}`, text: foodSearchText(name, `${aliases} ${reviewedSearchAliases(id)}`) }));
  for (const query of ["chicken breast", "protein", "rice", "Cheerios", "oatmea", "zzzznotfood", "cherry", "berries", "yoghurt", "aubergine", "garbanzo", "soy milk", "milk 2%", "brown rice cooked", "raw salmon", "peanut butter (smooth)", "sugar free", "coffee", "water"]) {
    const ctx = foodQuery(query);
    for (const prefix of [false, true]) for (const row of prepared) {
      if (matchesFoodQuery(row.name, row.aliases, ctx, prefix)) {
        expect(mayMatchFoodQuery(row.text, ctx), `${query}: ${row.name}`).toBe(true);
      }
    }
  }
}, 20000);
it("keeps Unicode case folding and irregular plural/synonym paths on the authoritative matcher", () => {
  for (const [name, query] of [["Cherries", "cherry"], ["Greek yoghurt", "yogurt"], ["ſoy milk", "soy milk"], ["Σ", "ς"], ["Blueberries", "blueberry"]]) {
    const ctx = foodQuery(query);
    expect(matchesFoodQuery(name, "", ctx)).toBe(true);
    expect(mayMatchFoodQuery(foodSearchText(name, ""), ctx)).toBe(true);
  }
});
