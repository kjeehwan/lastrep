import fs from "node:fs/promises";
import path from "node:path";
import { expect, it, vi } from "vitest";

const reads = vi.hoisted(() => [] as string[]);
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
    readAsStringAsync: async (filePath: string) => { reads.push(filePath); return fs.readFile(filePath, "utf8"); },
    EncodingType: { UTF8: "utf8" },
  },
  readAsStringAsync: async (filePath: string) => { reads.push(filePath); return fs.readFile(filePath, "utf8"); },
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

const { prewarmFoodSearch, getFoodsByIdsAsync } = await import("./foodDb");
it("prewarms only the small core, not the full index or food chunks", async () => {
  await prewarmFoodSearch();
  expect(reads.map((file) => path.basename(file))).toEqual(["foods-core.blob"]);
});
it("preserves existing food IDs, nutrition and servings after intentional ranking changes", async () => {
  const expected = JSON.parse(await fs.readFile("src/nutrition/fixtures/search-results-before.json", "utf8"));
  const originals = new Map<string, Record<string, unknown>>();
  for (const entry of expected) for (const food of entry.rows) {
    const clean = Object.fromEntries(Object.entries(food).filter(([key]) => !key.startsWith("_")));
    originals.set(food.id, clean);
  }
  const loaded = await getFoodsByIdsAsync([...originals.keys()]);
  expect(loaded).toHaveLength(originals.size);
  for (const food of loaded) expect(food, food.id).toEqual(originals.get(food.id));
}, 60000);

it("catalog candidates match every packaged food and its actual chunk", async () => {
  const directory = path.join(process.cwd(), "assets", "nutrition-data");
  const expected: [string, string, string, number][] = [];
  const seen = new Set<string>();
  for (let chunk = 0; chunk <= 33; chunk++) {
    const file = chunk === 0 ? "foods-core.blob" : `foods-rest-${chunk}.blob`;
    const foods = JSON.parse(await fs.readFile(path.join(directory, file), "utf8"));
    for (const food of foods) {
      const name = food.name.toLowerCase().trim();
      if (seen.has(name)) continue;
      seen.add(name);
      expected.push([food.id, name, [...(food.aliases ?? []), ...(food.brandNames ?? []), food.searchIdentity ?? ""].join(" ").toLowerCase().trim(), chunk]);
    }
  }
  expect(JSON.parse(await fs.readFile(path.join(directory, "foods-search-catalog.blob"), "utf8"))).toEqual(expected);
});

it("resolves records from the first and last positions of every packaged chunk", async () => {
  const expected = [];
  for (let chunk = 0; chunk <= 33; chunk++) {
    const file = chunk === 0 ? "foods-core.blob" : `foods-rest-${chunk}.blob`;
    const rows = JSON.parse(await fs.readFile(path.join("assets", "nutrition-data", file), "utf8"));
    expected.push(rows[0], rows.at(-1));
  }
  expect(await getFoodsByIdsAsync(expected.map((food) => food.id))).toEqual(expected);
});
