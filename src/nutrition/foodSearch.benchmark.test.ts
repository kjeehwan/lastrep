import fs from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-asset", () => ({
  Asset: {
    fromModule: (moduleId: string) => ({
      downloaded: true,
      localUri: moduleId,
      uri: moduleId,
      downloadAsync: async () => undefined,
    }),
  },
}));

vi.mock("expo-file-system/legacy", () => ({
  default: {
    readAsStringAsync: async (filePath: string) => fs.readFile(filePath, "utf8"),
    EncodingType: { UTF8: "utf8" },
  },
  readAsStringAsync: async (filePath: string) => fs.readFile(filePath, "utf8"),
  EncodingType: { UTF8: "utf8" },
}));

vi.mock("./data/foodsAssetManifest", () => {
  const assetPath = (...parts: string[]) => path.join(process.cwd(), ...parts);
  const restAssets: Record<number, string> = {};
  for (let index = 1; index <= 33; index += 1) {
    restAssets[index] = assetPath("assets", "nutrition-data", `foods-rest-${index}.blob`);
  }
  return {
    FOOD_CORE_ASSET: assetPath("assets", "nutrition-data", "foods-core.blob"),
    FOOD_GENERIC_ASSET: assetPath("assets", "nutrition-data", "foods-generic.blob"),
    FOOD_SEARCH_INDEX_ASSET: assetPath("assets", "nutrition-data", "foods-search-index.blob"),
    FOOD_SEARCH_CATALOG_ASSET: assetPath("assets", "nutrition-data", "foods-search-catalog.blob"),
    FOOD_REST_ASSETS: restAssets,
  };
});
const { clearFoodSearchCache, searchFoodsAsync, getFoodsByIdsAsync, computeFromFood } = await import("./foodDb");

type QueryCase = {
  q: string;
  anyOf: string[];
  banTop?: string[];
  mustTopAny?: string[];
};

const CASES: QueryCase[] = [
  { q: "cherry", anyOf: ["cherries", "cherry"], banTop: ["babyfood", "juice", "drink", "dessert"] },
  { q: "melon", anyOf: ["melon", "cantaloupe", "honeydew"], banTop: ["babyfood", "drink", "candy"] },
  { q: "sweet potato", anyOf: ["sweet potato"], banTop: ["babyfood", "stage", "toddler"] },
  { q: "bread", anyOf: ["bread"], banTop: ["babyfood", "drink", "dessert"], mustTopAny: ["whole wheat", "wheat", "white", "rye", "sourdough", "italian", "french", "bread"] },
  { q: "rice", anyOf: ["rice"], banTop: ["babyfood", "stage", "toddler"], mustTopAny: ["rice, white", "rice, brown", "white rice", "brown rice", "rice"] },
  { q: "brown rice", anyOf: ["brown", "rice"], banTop: ["babyfood", "stage", "toddler"], mustTopAny: ["brown rice", "rice, brown"] },
  { q: "potato", anyOf: ["potato"], banTop: ["babyfood", "stage", "toddler"], mustTopAny: ["potato, raw", "potatoes, raw", "potato"] },
  { q: "chicken breast", anyOf: ["chicken", "breast"], banTop: ["babyfood", "drink"] },
  { q: "banana", anyOf: ["banana"], banTop: ["babyfood", "drink"] },
  { q: "oatmeal", anyOf: ["oat", "oatmeal"], banTop: ["babyfood", "dessert"] },
  { q: "apple", anyOf: ["apple"], banTop: ["babyfood", "drink"] },
  { q: "potato", anyOf: ["potato"], banTop: ["babyfood", "stage"] },
  { q: "beef", anyOf: ["beef"], banTop: ["babyfood", "drink"] },
  { q: "salmon", anyOf: ["salmon"], banTop: ["babyfood", "drink"] },
  { q: "egg", anyOf: ["egg"], banTop: ["babyfood", "drink"] },
  { q: "milk", anyOf: ["milk"], banTop: ["babyfood", "dessert"] },
  { q: "yogurt", anyOf: ["yogurt"], banTop: ["babyfood", "drink"] },
  { q: "broccoli", anyOf: ["broccoli"], banTop: ["babyfood", "drink"] },
  { q: "carrot", anyOf: ["carrot"], banTop: ["babyfood", "drink"] },
  { q: "onion", anyOf: ["onion"], banTop: ["babyfood", "drink"] },
  { q: "pasta", anyOf: ["pasta"], banTop: ["babyfood", "drink"] },
  { q: "tofu", anyOf: ["tofu"], banTop: ["babyfood", "drink"] },
];

describe("nutrition food search benchmark", () => {
  beforeEach(() => {
    clearFoodSearchCache();
  });

  it("returns usable top-5 relevance across core queries", async () => {
    for (const c of CASES) {
      const rows = await searchFoodsAsync(c.q, 10);
      expect(rows.length, `query=${c.q} returned=${rows.length}`).toBeGreaterThanOrEqual(3);
      const top5 = rows.slice(0, 5).map((x) => x.name.toLowerCase());
      const relevantCount = top5.filter((name) => c.anyOf.some((k) => name.includes(k))).length;
      expect(relevantCount, `query=${c.q} top5=${top5.join(" | ")}`).toBeGreaterThanOrEqual(3);
      for (const bad of c.banTop ?? []) {
        const badRx = new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
        const hasBad = top5.some((name) => badRx.test(name));
        expect(hasBad, `query=${c.q} unexpected=${bad} top5=${top5.join(" | ")}`).toBe(false);
      }
      if (c.mustTopAny && c.mustTopAny.length > 0) {
        const hasMust = top5.some((name) => c.mustTopAny!.some((needle) => name.includes(needle)));
        expect(hasMust, `query=${c.q} missing-required top5=${top5.join(" | ")}`).toBe(true);
      }
    }
  }, 20000);

  it("returns cooked brown rice instead of unrelated raw/white rice", async () => {
    const rows = await searchFoodsAsync("brown rice cooked", 20);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.slice(0, 3).every((food) => /rice, brown/i.test(food.name) && /cooked/i.test(food.name))).toBe(true);
    expect(rows.some((food) => food.id === "usda-169704" && food.caloriesPer100g === 123)).toBe(true);
  });
  it("returns plain oats before oatmeal bread, pancakes and baked desserts", async () => {
    const rows = await searchFoodsAsync("oatmeal", 20);
    expect(rows.slice(0, 5).every((food) => !/\b(bread|pancakes?|bake|cookies?)\b/i.test(food.name))).toBe(true);
  });
  it("returns cooked chicken preparations, not raw chicken or arbitrary branded fillers", async () => {
    const rows = await searchFoodsAsync("chicken breast cooked", 20);
    expect(rows.slice(0, 3).every((food) => /breast/i.test(food.name) && /cooked|roasted|grilled|boiled/i.test(food.name))).toBe(true);
  });
  it("handles regional spelling, punctuation, plural forms and partial final words", async () => {
    expect((await searchFoodsAsync("greek yoghurt")).map((food) => food.id)).toEqual((await searchFoodsAsync("greek yogurt")).map((food) => food.id));
    expect((await searchFoodsAsync("chicken-breast")).map((food) => food.id)).toEqual((await searchFoodsAsync("chicken breast")).map((food) => food.id));
    expect((await searchFoodsAsync("egg whites"))[0].name).toMatch(/egg, white/i);
    expect((await searchFoodsAsync("oatmea")).length).toBeGreaterThan(0);
    for (const query of ["rice(", "rice [", "peanut butter (smooth)"]) expect((await searchFoodsAsync(query)).length).toBeGreaterThan(0);
    expect(await searchFoodsAsync("[" )).toEqual([]);
  });
  it("hydrates every returned ID in order with identical nutrition and serving values", async () => {
    for (const query of ["oatmeal", "chicken breast", "cherries", "Nutella"]) {
      const rows = await searchFoodsAsync(query);
      expect(await getFoodsByIdsAsync(rows.map((row) => row.id))).toEqual(rows);
    }
  });
  it("returns no unrelated result for an unknown food, and obeys limits", async () => {
    expect(await searchFoodsAsync("zzzznotfood")).toEqual([]);
    expect(await searchFoodsAsync("milk", 0)).toEqual([]);
    expect(await searchFoodsAsync("milk", 3)).toHaveLength(3);
  });
  it("does not divide by zero when a zero-calorie barcode product is entered by calories", () => {
    const food = { id: "zero", name: "Cola Zero", aliases: [], servingLabel: "100 g", servingGrams: 100, caloriesPer100g: 0, proteinPer100g: 0 };
    expect(computeFromFood(food, "calories", "100")).toBeNull();
    expect(computeFromFood(food, "grams", "100")?.calories).toBe(0);
  });
});
