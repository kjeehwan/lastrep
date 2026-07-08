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
    FOOD_SEARCH_INDEX_ASSET: assetPath("assets", "nutrition-data", "foods-search-index.blob"),
    FOOD_REST_ASSETS: restAssets,
  };
});
const { clearFoodSearchCache, searchFoodsAsync } = await import("./foodDb");

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
});
