import { describe, expect, it } from "vitest";
import type { FoodItem } from "./foodDb";
import { foodQuery, matchesFoodQuery, rankFoodMatches } from "./foodSearchRanking";

function food(id: string, name: string, extra: Partial<FoodItem> = {}): FoodItem {
  return { id, name, aliases: [], servingLabel: "100 g", servingGrams: 100, caloriesPer100g: 100, proteinPer100g: 5, carbsPer100g: 10, fatPer100g: 3, ...extra };
}
describe("food search relevance", () => {
  it("handles punctuation and repeated whitespace without regex injection", () => {
    for (const query of ["Chicken-breast", " chicken   breast ", "chicken (breast)", "chicken [breast]"]) {
      expect(matchesFoodQuery("Chicken breast", "", foodQuery(query))).toBe(true);
    }
    expect(matchesFoodQuery("Milk", "", foodQuery("["))).toBe(false);
  });
  it("matches plural words and regional spellings", () => {
    for (const [query, name] of [["egg whites", "Egg, white, raw"], ["greek yoghurt", "Greek yogurt"], ["chickpeas", "Garbanzo beans"], ["aubergine", "Eggplant"], ["cookies", "Cookie"]]) {
      expect(matchesFoodQuery(name, "", foodQuery(query)), query).toBe(true);
    }
  });
  it("requires all food terms, without arbitrary fallback foods", () => {
    expect(matchesFoodQuery("Jasmine rice", "en:rices en:cooked-rices", foodQuery("brown rice cooked"))).toBe(false);
    expect(matchesFoodQuery("Brown rice", "en:cooked-rices", foodQuery("brown rice cooked"))).toBe(false);
    expect(matchesFoodQuery("Brown rice, cooked", "", foodQuery("brown rice cooked"))).toBe(true);
  });
  it("distinguishes 2% from 1/2%, 1.5% and 12%", () => {
    const query = foodQuery("milk 2%");
    expect(matchesFoodQuery("Milk, 2% milkfat", "", query)).toBe(true);
    for (const name of ["Milk, 1/2% milkfat", "Milk 1.5%", "Milk 12%"])
      expect(matchesFoodQuery(name, "", query), name).toBe(false);
  });
  it("respects explicit preparation qualifiers", () => {
    const query = foodQuery("chicken breast cooked");
    expect(matchesFoodQuery("Chicken breast, raw", "", query)).toBe(false);
    expect(matchesFoodQuery("Chicken breast, roasted", "", query)).toBe(true);
  });
  it("only enables partial final words explicitly", () => {
    const query = foodQuery("chicken brea");
    expect(matchesFoodQuery("Chicken breast", "", query)).toBe(false);
    expect(matchesFoodQuery("Chicken breast", "", query, true)).toBe(true);
    expect(matchesFoodQuery("Bread", "", query, true)).toBe(false);
  });
  it("prioritizes verified generic food over ambiguous exact-name packaged food", () => {
    const rows = rankFoodMatches([
      food("off-1", "Cherries", { caloriesPer100g: 250 }),
      food("usda-1", "Cherries, sweet, raw", { sourceType: "usda-generic", caloriesPer100g: 63 }),
    ], foodQuery("cherries"), 20);
    expect(rows[0].id).toBe("usda-1");
  });
  it("does not promote reference-food derivatives over ordinary oats", () => {
    const rows = rankFoodMatches([
      food("usda-1", "Bread, oatmeal", { sourceType: "usda-generic" }),
      food("off-1", "Rolled oats"),
    ], foodQuery("oatmeal"), 20);
    expect(rows[0].id).toBe("off-1");
  });
  it("retains requested processed foods and brands", () => {
    expect(rankFoodMatches([food("off-1", "Chocolate chip cookie")], foodQuery("chocolate cookie"), 20)).toHaveLength(1);
    expect(rankFoodMatches([food("off-2", "Hazelnut spread", { aliases: ["Nutella"] })], foodQuery("Nutella"), 20)).toHaveLength(1);
  });
  it("collapses redundant punctuation/case variants, but keeps different nutrition and preparations", () => {
    const rows = rankFoodMatches([
      food("1", "Greek yogurt"), food("2", "Greek, yogurt"),
      food("3", "Greek yogurt", { caloriesPer100g: 90 }),
      food("4", "Greek yogurt, nonfat"),
    ], foodQuery("greek yogurt"), 20);
    expect(rows).toHaveLength(3);
  });
  it("filters impossible values but permits zero-calorie products", () => {
    const rows = rankFoodMatches([food("1", "Cola", { caloriesPer100g: 0 }), food("2", "Cola", { proteinPer100g: 200 }), food("3", "Cola", { caloriesPer100g: -1 })], foodQuery("cola"), 20);
    expect(rows.map((row) => row.id)).toEqual(["1"]);
  });
});
