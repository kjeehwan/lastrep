import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {
  FOOD_CORE_ASSET,
  FOOD_REST_ASSETS,
  FOOD_SEARCH_CATALOG_ASSET,
  FOOD_GENERIC_ASSET,
} from "./data/foodsAssetManifest";
import { foodQuery, matchesFoodQuery, normalizeFoodSearch, rankFoodMatches } from "./foodSearchRanking";
import { reviewedFoods, reviewedSearchAliases } from "./reviewedFoodCatalog";

export type FoodItem = {
  id: string;
  barcode?: string;
  name: string;
  aliases: string[];
  brandNames?: string[];
  searchIdentity?: string;
  servingLabel: string;
  servingGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  foodFamilies?: string[];
  foodForms?: string[];
  isBaseFood?: boolean;
  isPrepared?: boolean;
  isComboMeal?: boolean;
  isBranded?: boolean;
  isDerivative?: boolean;
  isStaple?: boolean;
  sourceType?: "usda-generic" | "manufacturer";
};

export type FoodEntryMode = "grams" | "servings" | "calories";

function extractLegacyExportJsonBlock(content: string, exportName: string): string {
  const startToken = `export const ${exportName}`;
  const startIndex = content.indexOf(startToken);
  if (startIndex === -1) {
    throw new Error(`Missing legacy export ${exportName}`);
  }
  const equalsIndex = content.indexOf("=", startIndex);
  if (equalsIndex === -1) {
    throw new Error(`Missing assignment for legacy export ${exportName}`);
  }
  const valueStart = equalsIndex + 1;
  const firstBraceIndex = content.indexOf("{", valueStart);
  const firstBracketIndex = content.indexOf("[", valueStart);
  const hasBrace =
    firstBraceIndex !== -1 && (firstBracketIndex === -1 || firstBraceIndex < firstBracketIndex);
  const openChar = hasBrace ? "{" : "[";
  const closeChar = hasBrace ? "}" : "]";
  const openIndex = hasBrace ? firstBraceIndex : firstBracketIndex;
  if (openIndex === -1) {
    throw new Error(`Missing JSON start for legacy export ${exportName}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openIndex; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return content.slice(openIndex, index + 1).trim();
      }
    }
  }

  throw new Error(`Unterminated JSON block for legacy export ${exportName}`);
}

function tryParseLegacySearchIndexModule(content: string): SearchIndexData | null {
  if (!content.includes("export const FOOD_TOKEN_INDEX")) return null;
  const tokenIndex = JSON.parse(
    extractLegacyExportJsonBlock(content, "FOOD_TOKEN_INDEX")
  ) as Record<string, string[]>;
  const prefixIndex = JSON.parse(
    extractLegacyExportJsonBlock(content, "FOOD_PREFIX_INDEX")
  ) as Record<string, string[]>;
  const idToChunk = JSON.parse(
    extractLegacyExportJsonBlock(content, "FOOD_ID_TO_CHUNK")
  ) as Record<string, number>;
  return {
    FOOD_TOKEN_INDEX: tokenIndex,
    FOOD_PREFIX_INDEX: prefixIndex,
    FOOD_ID_TO_CHUNK: idToChunk,
  };
}

async function readBlobModuleJson<T>(moduleId: number): Promise<T> {
  const asset = Asset.fromModule(moduleId);
  if (!asset.downloaded) {
    await asset.downloadAsync();
  }
  const uri = asset.localUri ?? asset.uri;
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const normalized = content.trim().replace(/^\uFEFF/, "");
  try {
    return JSON.parse(normalized) as T;
  } catch (initialError) {
    let parseError: unknown = initialError;
    try {
      const legacySearchIndex = tryParseLegacySearchIndexModule(normalized);
      if (legacySearchIndex) {
        return legacySearchIndex as T;
      }
    } catch (legacyError) {
      parseError = legacyError;
    }
    const sanitized = normalized
      .replace(/;\s*$/, "")
      .replace(/^export const [^=]+=\s*/, "")
      .trim();
    try {
      return JSON.parse(sanitized) as T;
    } catch (sanitizedError) {
      const previewStart = normalized.slice(0, 180);
      const previewEnd = normalized.slice(-180);
      console.log("Food asset parse failed", {
        moduleId,
        uri,
        previewStart,
        previewEnd,
        initialError:
          parseError instanceof Error ? parseError.message : String(parseError),
        sanitizedError:
          sanitizedError instanceof Error ? sanitizedError.message : String(sanitizedError),
      });
      throw sanitizedError;
    }
  }
}

const SEARCH_LIMIT_DEFAULT = 20;
type SearchIndexData = {
  FOOD_TOKEN_INDEX: Record<string, string[]>;
  FOOD_PREFIX_INDEX: Record<string, string[]>;
  FOOD_ID_TO_CHUNK: Record<string, number>;
};
type CatalogRow = [string, string, string, number];
const queryCache = new Map<string, FoodItem[]>();
const chunkPromises = new Map<number, Promise<FoodItem[]>>();
let corePromise: Promise<FoodItem[]> | null = null;
let catalogPromise: Promise<CatalogRow[]> | null = null;
let locationsPromise: Promise<Map<string, number>> | null = null;
let genericPromise: Promise<FoodItem[]> | null = null;
function loadCoreFoods() {
  return corePromise ??= readBlobModuleJson<FoodItem[]>(FOOD_CORE_ASSET).catch((error) => { corePromise = null; throw error; });
}
function loadCatalog() {
  return catalogPromise ??= readBlobModuleJson<CatalogRow[]>(FOOD_SEARCH_CATALOG_ASSET).catch((error) => { catalogPromise = null; throw error; });
}
function loadLocations() {
  return locationsPromise ??= loadCatalog().then((catalog) => new Map(catalog.map(([id, , , chunk]) => [id, chunk])))
    .catch((error) => { locationsPromise = null; throw error; });
}
function loadGenericFoods() {
  return genericPromise ??= (async () => {
    const [rows, locations] = await Promise.all([readBlobModuleJson<FoodItem[]>(FOOD_GENERIC_ASSET), loadLocations()]);
    // Existing IDs retain their original nutrition and serving definitions.
    const generic = rows.filter((food) => !locations.has(food.id));
    const existing = new Set([...locations.keys(), ...generic.map(food => food.id)]);
    return [...generic, ...reviewedFoods.filter(food => !existing.has(food.id))];
  })().catch((error) => { genericPromise = null; throw error; });
}
function loadChunk(chunk: number): Promise<FoodItem[]> {
  if (chunk === 0) return loadCoreFoods();
  let promise = chunkPromises.get(chunk);
  if (!promise) {
    const asset = FOOD_REST_ASSETS[chunk];
    promise = asset ? readBlobModuleJson<FoodItem[]>(asset) : Promise.resolve([]);
    chunkPromises.set(chunk, promise);
    // A transient asset error must be retryable, rather than poisoning the cache.
    promise.catch(() => chunkPromises.delete(chunk));
  }
  return promise;
}
export function clearFoodSearchCache() { queryCache.clear(); }
export async function prewarmFoodSearch(): Promise<void> { await loadCoreFoods(); }

export async function getFoodsByIdsAsync(ids: string[]): Promise<FoodItem[]> {
  const wanted = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (!wanted.length) return [];
  const [locations, generic] = await Promise.all([loadLocations(), loadGenericFoods()]);
  const found = new Map(generic.map((food) => [food.id, food]));
  const chunks = new Set(wanted.map((id) => locations.get(id)).filter((chunk): chunk is number => chunk != null));
  const wantedSet = new Set(wanted);
  for (const rows of await Promise.all([...chunks].map(loadChunk))) {
    for (const food of rows) if (wantedSet.has(food.id)) found.set(food.id, food);
  }
  return wanted.flatMap((id) => found.has(id) ? [found.get(id)!] : []);
}

async function matchingFoods(ctx: ReturnType<typeof foodQuery>, prefix = false): Promise<FoodItem[]> {
  const [catalog, generic] = await Promise.all([loadCatalog(), loadGenericFoods()]);
  const byChunk = new Map<number, Set<string>>();
  let sliceStarted = Date.now();
  for (let index = 0; index < catalog.length; index++) {
    const [id, name, aliases, chunk] = catalog[index];
    if (matchesFoodQuery(name, `${aliases} ${reviewedSearchAliases(id)}`, ctx, prefix)) {
      if (!byChunk.has(chunk)) byChunk.set(chunk, new Set());
      byChunk.get(chunk)!.add(id);
    }
    if (index > 0 && index % 500 === 0 && Date.now() - sliceStarted >= 8) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      sliceStarted = Date.now();
    }
  }
  const rows = await Promise.all([...byChunk].map(async ([chunk, ids]) =>
    (await loadChunk(chunk)).filter((food) => ids.has(food.id))));
  return [...generic.filter((food) => matchesFoodQuery(food.name, food.aliases.join(" "), ctx, prefix)), ...rows.flat()];
}
function resultLimit(limit: number) { return Number.isFinite(limit) ? Math.max(0, Math.min(100, Math.floor(limit))) : 0; }
async function search(query: string, limit: number, brandedOnly: boolean) {
  limit = resultLimit(limit);
  if (!limit) return [];
  const ctx = foodQuery(query);
  const key = JSON.stringify([normalizeFoodSearch(query), limit, brandedOnly]);
  const cached = queryCache.get(key);
  if (cached) return cached;
  let result: FoodItem[];
  if (!ctx.tokens.length) {
    result = query.trim() || brandedOnly ? [] : (await loadGenericFoods()).slice(0, limit);
  } else {
    const filter = (rows: FoodItem[]) => brandedOnly ? rows.filter((food) => food.sourceType !== "usda-generic") : rows;
    result = rankFoodMatches(filter(await matchingFoods(ctx)), ctx, limit);
    // Partial final words are supported only if no exact-token matches exist.
    // Never fill a short result list with unrelated foods.
    if (!result.length && ctx.tokens.at(-1)!.length >= 3) {
      result = rankFoodMatches(filter(await matchingFoods(ctx, true)), ctx, limit, true);
    }
  }
  queryCache.set(key, result);
  if (queryCache.size > 180) queryCache.delete(queryCache.keys().next().value!);
  return result;
}
export async function searchFoodsAsync(query: string, limit = SEARCH_LIMIT_DEFAULT): Promise<FoodItem[]> {
  return search(query, limit, false);
}
export async function searchFoodsBrandedAsync(query: string, limit = SEARCH_LIMIT_DEFAULT): Promise<FoodItem[]> {
  return search(query, limit, true);
}
export { formatServingLabel } from "./servingLabel";

export function computeFromFood(item: FoodItem, mode: FoodEntryMode, rawValue: string) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) return null;

  if (mode === "grams") {
    const factor = value / 100;
    return {
      grams: value,
      servings: value / item.servingGrams,
      calories: item.caloriesPer100g * factor,
      proteinGrams: item.proteinPer100g * factor,
      carbGrams:
        typeof item.carbsPer100g === "number" && Number.isFinite(item.carbsPer100g)
          ? item.carbsPer100g * factor
          : null,
      fatGrams:
        typeof item.fatPer100g === "number" && Number.isFinite(item.fatPer100g)
          ? item.fatPer100g * factor
          : null,
    };
  }

  if (mode === "servings") {
    const grams = value * item.servingGrams;
    const factor = grams / 100;
    return {
      grams,
      servings: value,
      calories: item.caloriesPer100g * factor,
      proteinGrams: item.proteinPer100g * factor,
      carbGrams:
        typeof item.carbsPer100g === "number" && Number.isFinite(item.carbsPer100g)
          ? item.carbsPer100g * factor
          : null,
      fatGrams:
        typeof item.fatPer100g === "number" && Number.isFinite(item.fatPer100g)
          ? item.fatPer100g * factor
          : null,
    };
  }

  if (!Number.isFinite(item.caloriesPer100g) || item.caloriesPer100g <= 0) return null;
  const grams = (value / item.caloriesPer100g) * 100;
  const factor = grams / 100;
  return {
    grams,
    servings: grams / item.servingGrams,
    calories: value,
    proteinGrams: item.proteinPer100g * factor,
    carbGrams:
      typeof item.carbsPer100g === "number" && Number.isFinite(item.carbsPer100g)
        ? item.carbsPer100g * factor
        : null,
    fatGrams:
      typeof item.fatPer100g === "number" && Number.isFinite(item.fatPer100g)
        ? item.fatPer100g * factor
        : null,
  };
}
