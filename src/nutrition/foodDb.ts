import { FOODS_CORE } from "./data/foods-core";

export type FoodItem = {
  id: string;
  name: string;
  aliases: string[];
  servingLabel: string;
  servingGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
};

export type FoodEntryMode = "grams" | "servings" | "calories";

const SEARCH_LIMIT_DEFAULT = 20;
const queryCache = new Map<string, FoodItem[]>();
const CACHE_LIMIT = 180;

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function dedupeFoodsByName(foods: FoodItem[]): FoodItem[] {
  const byName = new Map<string, FoodItem>();
  for (const food of foods) {
    const key = normalize(food.name);
    if (!byName.has(key)) {
      byName.set(key, food);
    }
  }
  return [...byName.values()];
}

let allFoodsPromise: Promise<FoodItem[]> | null = null;

async function loadAllFoods(): Promise<FoodItem[]> {
  if (allFoodsPromise) return allFoodsPromise;
  allFoodsPromise = (async () => {
    const rest1 = await import("./data/foods-rest-1");
    return dedupeFoodsByName([...FOODS_CORE, ...rest1.FOODS_REST_1]);
  })();
  return allFoodsPromise;
}

type IndexedFood = FoodItem & {
  _name: string;
  _aliases: string;
  _blob: string;
  _acronym: string;
};

let indexedFoodsPromise: Promise<IndexedFood[]> | null = null;
async function loadIndexedFoods(): Promise<IndexedFood[]> {
  if (indexedFoodsPromise) return indexedFoodsPromise;
  indexedFoodsPromise = (async () => {
    const allFoods = await loadAllFoods();
    return allFoods.map((food) => {
      const _name = normalize(food.name);
      const _aliases = normalize((food.aliases ?? []).join(" "));
      const _blob = `${_name} ${_aliases}`.trim();
      const _acronym = food.name
        .split(/\s+/)
        .map((w) => w[0]?.toLowerCase() ?? "")
        .join("");
      return { ...food, _name, _aliases, _blob, _acronym };
    });
  })();
  return indexedFoodsPromise;
}

function score(food: IndexedFood, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  let s = 0;
  if (food._name === q) s += 1200;
  if (food._name.startsWith(q)) s += 600;
  if (food._blob.includes(q)) s += 300;

  const tokens = q.split(/\s+/).filter(Boolean);
  let covered = 0;
  for (const token of tokens) {
    if (food._name.includes(token)) {
      s += 70;
      covered += 1;
    } else if (food._blob.includes(token)) {
      s += 28;
      covered += 1;
    }
  }
  if (covered === tokens.length && tokens.length > 0) s += 120;

  if (/^\d+/.test(food._name)) s -= 160;
  if (/\boz\b|\bplus\b|\bpremium\b|\borganic\b/.test(food._name)) s -= 70;
  s -= Math.max(0, food._name.split(/\s+/).length - tokens.length) * 8;

  return s;
}

export async function searchFoodsAsync(query: string, limit = SEARCH_LIMIT_DEFAULT): Promise<FoodItem[]> {
  const q = normalize(query);
  const cacheKey = `${q}::${limit}`;
  const cached = queryCache.get(cacheKey);
  if (cached) return cached;

  let result: FoodItem[];
  const allFoods = await loadAllFoods();
  const indexedFoods = await loadIndexedFoods();
  if (!q) {
    result = [...allFoods].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  } else {
    const rows = indexedFoods
      .map((food) => ({ food, score: score(food, q) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
      .slice(0, Math.max(limit, 80))
      .map((row) => row.food);

    const exact = rows.filter((f) => normalize(f.name) === q);
    const others = rows.filter((f) => normalize(f.name) !== q);
    result = [...exact, ...others].slice(0, limit);
  }

  queryCache.set(cacheKey, result);
  if (queryCache.size > CACHE_LIMIT) {
    const firstKey = queryCache.keys().next().value as string | undefined;
    if (firstKey) queryCache.delete(firstKey);
  }
  return result;
}

export function formatServingLabel(label: string): string {
  const trimmed = String(label ?? "").trim();
  const m = trimmed.match(/^(\d+(?:\.\d+)?)(\s*[a-zA-Z].*)$/);
  if (!m) return trimmed;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return trimmed;
  const normalizedNum =
    Math.abs(num - Math.round(num)) < 1e-9
      ? String(Math.round(num))
      : String(Math.round(num * 100) / 100);
  return `${normalizedNum}${m[2]}`;
}

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
    };
  }

  const grams = (value / item.caloriesPer100g) * 100;
  const factor = grams / 100;
  return {
    grams,
    servings: grams / item.servingGrams,
    calories: value,
    proteinGrams: item.proteinPer100g * factor,
  };
}
