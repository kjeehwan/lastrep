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
    FOOD_SEARCH_INDEX_ASSET: assetPath("assets", "nutrition-data", "foods-search-index.blob"),
    FOOD_SEARCH_CATALOG_ASSET: assetPath("assets", "nutrition-data", "foods-search-catalog.blob"),
    FOOD_REST_ASSETS: restAssets,
  };
});

const { prewarmFoodSearch, searchFoodsAsync } = await import("./foodDb");
it("prewarms only the small core, not the full index or food chunks", async () => {
  await prewarmFoodSearch();
  expect(reads.map((file) => path.basename(file))).toEqual(["foods-core.blob"]);
});
it("preserves ordering and nutrition values across 81 captured searches", async () => {
  const expected = JSON.parse(await fs.readFile("src/nutrition/fixtures/search-results-before.json", "utf8"));
  for (const entry of expected) {
    expect(await searchFoodsAsync(entry.query, entry.limit), `${entry.query} limit ${entry.limit}`).toEqual(entry.rows);
  }
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
      expected.push([food.id, name, (food.aliases ?? []).join(" ").toLowerCase().trim(), chunk]);
    }
  }
  expect(JSON.parse(await fs.readFile(path.join(directory, "foods-search-catalog.blob"), "utf8"))).toEqual(expected);
});
