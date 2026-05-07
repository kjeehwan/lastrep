import { FOODS_CORE } from "./data/foods-core";
import { FOOD_ID_TO_CHUNK, FOOD_PREFIX_INDEX, FOOD_TOKEN_INDEX } from "./data/foods-search-index";
import { FOODS_REST_LOADERS } from "./data/foods-rest-map";

export type FoodItem = {
  id: string;
  name: string;
  aliases: string[];
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
};

export type FoodEntryMode = "grams" | "servings" | "calories";

const SEARCH_LIMIT_DEFAULT = 20;
const queryCache = new Map<string, FoodItem[]>();
const CACHE_LIMIT = 180;
let usdaFallbackPromise: Promise<IndexedFood[]> | null = null;
const canonicalCoreUsda = FOODS_CORE
  .filter((f) => String(f.id).startsWith("usda-"))
  .map((f) => toIndexedFood(f));

export function clearFoodSearchCache() {
  queryCache.clear();
}

export async function prewarmFoodSearch(): Promise<void> {
  await Promise.all([loadRestChunk(1), loadRestChunk(2), loadUsdaFallbackFoods()]);
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function expandQueryTokens(q: string): string[] {
  const base = normalize(q);
  if (!base) return [];
  const tokens = base.split(/\s+/).filter(Boolean);
  const expanded: string[] = [base];

  for (const token of tokens) {
    const forms = [token];
    if (!token.endsWith("s")) forms.push(`${token}s`);
    if (token.endsWith("y")) forms.push(`${token.slice(0, -1)}ies`);
    if (token.endsWith("ies")) forms.push(`${token.slice(0, -3)}y`);
    if (token.endsWith("s")) forms.push(token.slice(0, -1));
    for (const form of forms) {
      expanded.push(form);
      expanded.push(`${form} raw`);
    }
  }

  const map: Record<string, string[]> = {
    cherry: ["cherries", "sweet cherries", "sour cherries", "cherries raw"],
    cherries: ["cherry", "sweet cherries", "sour cherries", "cherries raw"],
    banana: ["bananas", "banana raw", "raw banana"],
    oatmeal: ["oats", "rolled oats", "oatmeal cooked", "oatmeal raw"],
    melon: ["melons", "cantaloupe", "honeydew", "watermelon", "melon raw"],
  };

  for (const token of tokens) {
    const extras = map[token];
    if (extras) expanded.push(...extras);
  }

  if (base === "sweet potato" || base === "sweet potatoes") {
    expanded.push(
      "sweet potato",
      "sweet potatoes",
      "sweet potato raw",
      "sweet potatoes raw",
      "yam",
      "yams"
    );
  }
  if (base === "potato" || base === "potatoes") {
    expanded.push("potato raw", "potatoes raw", "potato cooked", "potatoes cooked");
  }

  return unique(expanded);
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

const coreById = new Map<string, FoodItem>(FOODS_CORE.map((f) => [f.id, f]));
const restChunkPromises = new Map<number, Promise<FoodItem[]>>();

async function loadRestChunk(chunk: number): Promise<FoodItem[]> {
  const cached = restChunkPromises.get(chunk);
  if (cached) return cached;
  const promise = (async () => {
    const loader = FOODS_REST_LOADERS[chunk];
    if (!loader) return [];
    return loader();
  })();
  restChunkPromises.set(chunk, promise);
  return promise;
}

async function resolveFoodsByIds(ids: string[]): Promise<FoodItem[]> {
  const byChunk = new Map<number, string[]>();
  const found: FoodItem[] = [];

  for (const id of ids) {
    const core = coreById.get(id);
    if (core) {
      found.push(core);
      continue;
    }
    const chunkGuess = FOOD_ID_TO_CHUNK[id] ?? null;
    if (!chunkGuess) continue;
    const arr = byChunk.get(chunkGuess) ?? [];
    arr.push(id);
    byChunk.set(chunkGuess, arr);
  }

  const chunkMaps = new Map<number, Map<string, FoodItem>>();
  const chunkNos = [...byChunk.keys()];
  const loaded = await Promise.all(chunkNos.map(async (chunkNo) => [chunkNo, await loadRestChunk(chunkNo)] as const));
  for (const [chunkNo, rows] of loaded) {
    chunkMaps.set(chunkNo, new Map(rows.map((r) => [r.id, r])));
  }
  for (const [chunkNo, chunkIds] of byChunk) {
    const map = chunkMaps.get(chunkNo);
    if (!map) continue;
    for (const id of chunkIds) {
      const row = map.get(id);
      if (row) found.push(row);
    }
  }
  return dedupeFoodsByName(found);
}

async function loadUsdaFallbackFoods(): Promise<IndexedFood[]> {
  if (usdaFallbackPromise) return usdaFallbackPromise;
  usdaFallbackPromise = (async () => {
    const chunkSet = new Set<number>();
    for (const id of Object.keys(FOOD_ID_TO_CHUNK)) {
      if (!id.startsWith("usda-")) continue;
      const chunk = FOOD_ID_TO_CHUNK[id];
      if (chunk) chunkSet.add(chunk);
    }

    const rows: FoodItem[] = [];
    for (const f of FOODS_CORE) {
      if (f.id.startsWith("usda-")) rows.push(f);
    }
    for (const chunk of [...chunkSet].sort((a, b) => a - b)) {
      const r = await loadRestChunk(chunk);
      for (const item of r) {
        if (item.id.startsWith("usda-")) rows.push(item);
      }
    }
    return dedupeFoodsByName(rows).map(toIndexedFood);
  })();
  return usdaFallbackPromise;
}

export async function getFoodsByIdsAsync(ids: string[]): Promise<FoodItem[]> {
  const uniqueIds = unique(ids.map((x) => String(x).trim()).filter(Boolean));
  if (uniqueIds.length === 0) return [];
  return resolveFoodsByIds(uniqueIds);
}

type IndexedFood = FoodItem & {
  _name: string;
  _aliases: string;
  _blob: string;
  _acronym: string;
};

function toIndexedFood(food: FoodItem): IndexedFood {
  const _name = normalize(food.name);
  const _aliases = normalize((food.aliases ?? []).join(" "));
  const _blob = `${_name} ${_aliases}`.trim();
  const _acronym = food.name
    .split(/\s+/)
    .map((w) => w[0]?.toLowerCase() ?? "")
    .join("");
  return { ...food, _name, _aliases, _blob, _acronym };
}

type QueryCtx = {
  q: string;
  tokens: string[];
  expanded: string[];
  singular?: string;
  plural?: string;
  intentFamilies: Set<CategoryHint>;
};

const NOISY_TOP_TERMS =
  /\b(drink|mix|soda|tea|candy|jelly|bar|cookie|chips|sauce|seasoned|flavored|sparkling|cocktail)\b/;
const DERIVATIVE_FORM_TERMS =
  /\b(crumbs?|sticks?|dumplings?|mix|seasoning|croutons?|bites?|powder|instant|packet|kit)\b/;
const NON_CORE_FOLLOWUP_TERMS =
  /\b(breaded|crumbs?|sticks?|chips?|dumplings?|mix|seasoned|seasoning|pickles?|soda|drink|candy|cookie|bar)\b/;
const STARTS_WITH_NON_CORE_TERMS =
  /^(and|&|flour|crumbs?|crumb|sticks?|chips?|dumplings?|mix|seasoned|seasoning|pickles?|butter|breaded)\b/;
const TOP_TIER_EXCLUDE_TERMS =
  /\b(babyfood|baby|toddler|stage\s*\d+|juice|juices|drink|drinks|beverage|beverages|cocktail|concentrate|pie|pies|cobbler|sauce|mix|seasoning|dessert|candy|cookie|bar|chips?|snack|cake|cakes|blintz|blintzes|pudding|bakery)\b/;
const FRUIT_NOISE_TERMS =
  /\b(limeade|lime|ade|cranberry|slices?|rings?|gummy|flavor|flavored|soda|tea|sparkling|cocktail|drink|beverage|juice)\b/;
const FRUIT_LIKE_QUERY_TOKENS = new Set([
  "cherry",
  "cherries",
  "melon",
  "melons",
  "apple",
  "apples",
  "banana",
  "bananas",
  "grape",
  "grapes",
  "orange",
  "oranges",
  "berry",
  "berries",
  "peach",
  "peaches",
  "pear",
  "pears",
  "mango",
  "mangos",
]);
const STAPLE_QUERY_TOKENS = new Set(["bread", "rice", "potato", "sweet", "oat", "oats", "oatmeal"]);
const DISH_CONTAINS_PATTERN =
  /\b(with|and|style|in sauce|in broth|casserole|dinner|meal|sandwich|wrap|bowl|adobo|pilaf|fried)\b/;

const RANK_WEIGHTS = {
  exactName: 1600,
  exactMultiTokenContains: 1200,
  startsWith: 600,
  blobContains: 300,
  nameTokenExact: 260,
  aliasTokenExact: 140,
  expandedExact: 420,
  expandedStartsWith: 210,
  expandedContains: 130,
  expandedNameToken: 170,
  nearPrefixWrongWordPenalty: -260,
  tokenNameCoverage: 70,
  tokenBlobCoverage: 28,
  allTokensCoveredBonus: 120,
  singleTokenStemStartsWith: 520,
  singleTokenRawBonus: 280,
  singleTokenExactSingularPlural: 1800,
  singleTokenShortStartsWith: 340,
  singleTokenLongNamePenalty: -160,
  singleTokenSpecialCharPenalty: -220,
  singleTokenPreparedPenalty: -280,
  wholeFoodContextBonus: 110,
  produceContextBonus: 70,
  processedPenalty: -180,
  brandedAdjectivePenalty: -90,
  melonDrinkPenalty: -380,
  melonRawBonus: 260,
  melonCantaloupeHoneydewBonus: 220,
  melonWatermelonPenalty: -120,
  noisyTopPenalty: -220,
  genericWholeFoodBonus: 160,
  nonCoreFollowupPenalty: -260,
  prefixedVariantPenalty: -260,
  wholeTokenBonus: 260,
  startsWithDigitPenalty: -160,
  ozPenalty: -70,
  extraWordsPenalty: -8,
  impossibleNutritionPenalty: -5000,
} as const;

function isGenericWholeFood(food: IndexedFood): boolean {
  const n = food._name;
  if (NOISY_TOP_TERMS.test(n)) return false;
  if (/[&()]/.test(n)) return false;
  if ((n.match(/,/g) ?? []).length > 2) return false;
  return /\b(raw|fresh|frozen)\b/.test(n) || n.split(/\s+/).length <= 2;
}

function isDerivativeForm(food: IndexedFood): boolean {
  if (typeof food.isDerivative === "boolean") return food.isDerivative;
  return DERIVATIVE_FORM_TERMS.test(food._name);
}


type CategoryHint =
  | "bread"
  | "produce"
  | "protein"
  | "dairy"
  | "grain"
  | "starch"
  | "processed"
  | "beverage"
  | "snack";

const TOP_NEGATIVE_BY_FAMILY: Record<string, RegExp> = {
  grain: /\b(flour|mix|seasoning|sauce|fried|pilaf|adobo|bowl|dinner|meal|sandwich|wrap)\b/,
  starch: /\b(fries|french fries|hash brown|chips?|crisps?|leaves|bread|mix|dinner|meal|sandwich|wrap)\b/,
  produce: /\b(drink|juice|cocktail|soda|candy|dessert|pie|cake|cookie)\b/,
};

function detectFoodCategories(food: IndexedFood): Set<CategoryHint> {
  if (Array.isArray(food.foodFamilies) && food.foodFamilies.length > 0) {
    const mapped = new Set<CategoryHint>();
    for (const f of food.foodFamilies) {
      if (f === "grains") mapped.add("grain");
      if (f === "starches") mapped.add("starch");
      if (f === "produce") mapped.add("produce");
      if (f === "protein") mapped.add("protein");
      if (f === "dairy") mapped.add("dairy");
      if (f === "legumes") mapped.add("protein");
    }
    if (food.isPrepared || food.isComboMeal || food.isDerivative) mapped.add("processed");
    if (food.isBranded) mapped.add("snack");
    if (mapped.size > 0) return mapped;
  }
  const t = `${food._name} ${food._aliases}`;
  const out = new Set<CategoryHint>();
  if (/\b(bread|loaf|whole\s*wheat|multigrain|baguette|sourdough|rye)\b/.test(t)) out.add("bread");
  if (/\b(raw|fresh|fruit|vegetable|berries?|cherries?|banana|apple|melon|potato|tomato|onion)\b/.test(t)) out.add("produce");
  if (/\b(chicken|beef|turkey|fish|salmon|egg|tofu|protein)\b/.test(t)) out.add("protein");
  if (/\b(milk|yogurt|cheese|dairy|whey)\b/.test(t)) out.add("dairy");
  if (/\b(rice|oat|oats|oatmeal|quinoa|grain|pasta)\b/.test(t)) out.add("grain");
  if (/\b(potato|potatoes|sweet potato|yam|cassava|taro)\b/.test(t)) out.add("starch");
  if (/\b(soda|cola|drink|juice|tea|coffee|beverage|sparkling)\b/.test(t)) out.add("beverage");
  if (/\b(candy|cookie|chips?|bar|snack|dessert|chocolate)\b/.test(t)) out.add("snack");
  if (/\b(breaded|prepared|frozen|seasoned|mix|dumplings?|crumbs?|sticks?|pickles?)\b/.test(t)) out.add("processed");
  return out;
}

function detectQueryIntent(tokens: string[]): Set<CategoryHint> {
  const q = tokens.join(" ");
  const out = new Set<CategoryHint>();
  if (/\b(bread|loaf|baguette|sourdough|rye)\b/.test(q)) out.add("bread");
  if (/\b(cherry|melon|banana|apple|potato|tomato|onion|fruit|vegetable)\b/.test(q)) out.add("produce");
  if (/\b(potato|sweet potato|yam|yams)\b/.test(q)) out.add("starch");
  if (/\b(chicken|beef|fish|egg|tofu|protein)\b/.test(q)) out.add("protein");
  if (/\b(milk|yogurt|cheese|whey)\b/.test(q)) out.add("dairy");
  if (/\b(rice|oat|oats|oatmeal|quinoa|pasta|grain)\b/.test(q)) out.add("grain");
  if (/\b(juice|tea|coffee|drink|soda)\b/.test(q)) out.add("beverage");
  if (/\b(cookie|chips?|candy|snack|dessert|chocolate)\b/.test(q)) out.add("snack");
  return out;
}

function getQueryLemmas(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    out.add(t);
    if (t.endsWith("ies")) out.add(`${t.slice(0, -3)}y`);
    if (t.endsWith("y")) out.add(`${t.slice(0, -1)}ies`);
    if (t.endsWith("s")) out.add(t.slice(0, -1));
    if (!t.endsWith("s")) out.add(`${t}s`);
  }
  return [...out].filter(Boolean);
}

function categoryPriorScore(food: IndexedFood, ctx: QueryCtx): number {
  if (ctx.tokens.length === 0) return 0;
  const intents = detectQueryIntent(ctx.tokens);
  if (intents.size === 0) return 0;
  const cats = detectFoodCategories(food);
  let s = 0;
  for (const intent of intents) {
    if (cats.has(intent)) s += 260;
  }
  if (intents.has("bread")) {
    if (cats.has("processed")) s -= 240;
    if (cats.has("snack")) s -= 220;
    if (cats.has("beverage")) s -= 260;
  }
  if (intents.has("produce")) {
    if (cats.has("snack")) s -= 220;
    if (cats.has("beverage")) s -= 180;
  }
  if (intents.has("protein")) {
    if (cats.has("snack")) s -= 180;
    if (cats.has("beverage")) s -= 140;
  }
  return s;
}

function isTopTierWholeFood(food: IndexedFood, queryLemmas: string[]): boolean {
  const n = food._name;
  if (TOP_TIER_EXCLUDE_TERMS.test(n)) return false;
  if (NON_CORE_FOLLOWUP_TERMS.test(n)) return false;
  if (NOISY_TOP_TERMS.test(n)) return false;
  if (isDerivativeForm(food)) return false;
  if (/\b(with|in|style|prepared|frozen dinner)\b/.test(n)) return false;
  if (n.split(/\s+/).length > 7) return false;
  const wholeHit = queryLemmas.some((q) => new RegExp(`\\b${q}\\b`).test(n));
  if (!wholeHit) return false;
  return /(raw|fresh|plain|whole|white|brown|sweet|wheat|rice|bread|cherries|cherry|melon|potato)/.test(n);
}

function isHardTopEligible(food: FoodItem, ctx: QueryCtx): boolean {
  if (ctx.tokens.length === 0) return false;
  const f = toIndexedFood(food);
  const lemmas = getQueryLemmas(ctx.tokens);
  if (!isTopTierWholeFood(f, lemmas)) return false;
  // Require explicit token/lemma word hit for top slots.
  if (ctx.tokens.length > 1) {
    const strictHit = ctx.tokens.every((t) => new RegExp(`\\b${t}\\b`).test(f._name));
    if (!strictHit) return false;
  } else {
    const hit = lemmas.some((q) => new RegExp(`\\b${q}\\b`).test(f._name));
    if (!hit) return false;
  }
  if (TOP_TIER_EXCLUDE_TERMS.test(f._name)) return false;
  for (const fam of ctx.intentFamilies) {
    const neg = TOP_NEGATIVE_BY_FAMILY[fam];
    if (neg && neg.test(f._name)) return false;
  }
  if (ctx.tokens.length === 1) {
    const t0 = ctx.tokens[0];
    const startsLemma = lemmas.some((q) => f._name.startsWith(q) || f._name.startsWith(`${q},`));
    // For single-token queries, top slots should be direct forms, not incidental suffix mentions.
    if (!startsLemma && !new RegExp(`\\b${t0}\\b`).test(f._name)) return false;
    if (FRUIT_LIKE_QUERY_TOKENS.has(t0)) {
      // Fruit queries should bias toward canonical fresh/raw forms in top slots.
      if (FRUIT_NOISE_TERMS.test(f._name)) return false;
      if (!/\b(raw|fresh)\b/.test(f._name) && f._name.split(/\s+/).length > 1) return false;
    }
    if (STAPLE_QUERY_TOKENS.has(t0)) {
      if (
        /\b(with|and|style|sauce|flavor|flavored|mix|mixes|snack|chips?|bar|cake|cookie|dessert)\b/.test(f._name) ||
        DISH_CONTAINS_PATTERN.test(f._name)
      ) {
        return false;
      }
      // For staple one-word lookups, require direct head match near start.
      if (!(f._name === t0 || f._name.startsWith(`${t0} `) || f._name.startsWith(`${t0},`) || /\b(raw|cooked|boiled|baked|white|brown|whole)\b/.test(f._name))) {
        return false;
      }
    }
  } else {
    const q = ctx.tokens.join(" ");
    if (q.includes("sweet potato")) {
      if (!/\bsweet\b/.test(f._name) || !/\bpotato(?:es)?\b/.test(f._name)) return false;
    }
    if (q.includes("chicken breast")) {
      if (!/\bchicken\b/.test(f._name) || !/\bbreast\b/.test(f._name)) return false;
    }
    if (q.includes("brown rice")) {
      if (!/\bbrown\b/.test(f._name) || !/\brice\b/.test(f._name)) return false;
    }
    if (q.includes("sweet potato")) {
      if (DISH_CONTAINS_PATTERN.test(f._name)) return false;
    }
  }
  return true;
}

function topTierScore(food: FoodItem, ctx: QueryCtx): number {
  const f = toIndexedFood(food);
  let s = score(f, ctx);
  const fams = detectFoodCategories(f);
  if (typeof f.isBaseFood === "boolean") {
    if (f.isBaseFood) s += 420;
    else s -= 220;
  } else if (isGenericWholeFood(f)) {
    s += 180;
  }
  if (typeof f.isPrepared === "boolean" && f.isPrepared) s -= 260;
  if (typeof f.isComboMeal === "boolean" && f.isComboMeal) s -= 280;
  if (typeof f.isDerivative === "boolean" && f.isDerivative) s -= 240;
  if (typeof f.isBranded === "boolean" && f.isBranded) s -= 120;
  if (ctx.intentFamilies.has("grain")) {
    if (fams.has("grain")) s += 220;
    if (fams.has("starch")) s += 60;
  }
  if (ctx.intentFamilies.has("starch")) {
    if (fams.has("starch")) s += 220;
    if (fams.has("grain")) s += 60;
  }
  if (ctx.q === "rice") {
    if (/\brice\b/.test(f._name)) s += 420;
    if (/\b(white|brown|basmati|jasmine|long grain|short grain|raw|cooked|boiled)\b/.test(f._name)) s += 260;
    if (/\bflour\b/.test(f._name)) s -= 460;
  }
  if (ctx.q === "bread") {
    if (/\bbread\b/.test(f._name)) s += 360;
    if (/\b(whole wheat|whole-wheat|wheat|white|rye|sourdough|italian|french)\b/.test(f._name)) s += 200;
  }
  if (ctx.q === "potato") {
    if (f._name === "potato" || f._name.startsWith("potato,") || f._name.startsWith("potatoes,")) s += 540;
    if (/\bpotato(?:es)?\b/.test(f._name)) s += 360;
    if (/\b(raw|cooked|boiled|baked|flesh)\b/.test(f._name)) s += 240;
    if (/\b(fries|french|hash brown|chips?|crisps?)\b/.test(f._name)) s -= 560;
  }
  if (ctx.q.includes("sweet potato")) {
    if (/\bsweet\b/.test(f._name) && /\bpotato(?:es)?\b/.test(f._name)) s += 520;
    if (/\b(raw|cooked|boiled|baked|flesh)\b/.test(f._name)) s += 220;
  }
  return s;
}


async function canonicalUsdaRank(ctx: QueryCtx, limit: number): Promise<FoodItem[]> {
  const usdaFoods = await loadUsdaFallbackFoods();
  const qTokens = unique([ctx.q, ...ctx.tokens, ...ctx.expanded, ...getQueryLemmas(ctx.tokens)].map((x) => normalize(x)).filter(Boolean));
  const candidateIds = new Set<string>();
  for (const token of qTokens) {
    for (const id of FOOD_TOKEN_INDEX[token] ?? []) {
      if (id.startsWith("usda-")) candidateIds.add(id);
      if (candidateIds.size >= 420) break;
    }
    if (candidateIds.size >= 420) break;
  }
  if (candidateIds.size < 220) {
    for (const token of qTokens) {
      const prefix = token.slice(0, 3);
      if (!prefix) continue;
      for (const id of FOOD_PREFIX_INDEX[prefix] ?? []) {
        if (id.startsWith("usda-")) candidateIds.add(id);
        if (candidateIds.size >= 760) break;
      }
      if (candidateIds.size >= 760) break;
    }
  }
  const usdaPool =
    candidateIds.size > 0
      ? (await resolveFoodsByIds([...candidateIds]))
          .filter((x) => x.id.startsWith("usda-"))
          .map(toIndexedFood)
      : usdaFoods;
  const isCanonicalUsda = (f: IndexedFood): boolean =>
    f.id.startsWith("usda-") &&
    f.caloriesPer100g <= 900 &&
    f.proteinPer100g <= 100 &&
    (typeof f.carbsPer100g !== "number" || f.carbsPer100g <= 100) &&
    (typeof f.fatPer100g !== "number" || f.fatPer100g <= 100);

  const isPotatoBaseCanonical = (f: IndexedFood): boolean => {
    const n = f._name;
    if (ctx.q === "potato" || ctx.q === "potatoes") {
      if (!/\bpotato(?:es)?\b/.test(n)) return false;
      if (!/\b(raw|cooked|boiled|baked|flesh|with skin|without skin)\b/.test(n)) return false;
      if (/\b(fries|french|hash brown|chips?|crisps?|snack|mix|bread|cookie|pie|salad|soup|dumpling)\b/.test(n)) return false;
      return true;
    }
    if (ctx.q.includes("sweet potato")) {
      if (!/\bsweet\b/.test(n) || !/\bpotato(?:es)?\b/.test(n)) return false;
      if (!/\b(raw|cooked|boiled|baked|flesh|with skin|without skin)\b/.test(n)) return false;
      if (/\b(fries|french|hash brown|chips?|crisps?|snack|mix|bread|cookie|pie|salad|soup|leaves?)\b/.test(n)) return false;
      return true;
    }
    return true;
  };

  const canonicalScore = (f: IndexedFood): number => {
    let s = 0;
    if (f._name === ctx.q) s += 2400;
    if (ctx.tokens.length > 1 && f._name.includes(ctx.q)) s += 1600;
    let cov = 0;
    for (const t of ctx.tokens) if (new RegExp(`\\b${t}\\b`).test(f._name)) cov += 1;
    s += cov * 260;
    if (ctx.tokens.length > 0 && cov === ctx.tokens.length) s += 900;
    if (/(^|[\s,])(raw|fresh|plain|whole|white|wheat|brown|uncooked|prepared)([\s,]|$)/.test(f._name)) s += 280;
    if (TOP_TIER_EXCLUDE_TERMS.test(f._name)) s -= 1200;
    return s;
  };

  const scored = usdaPool.filter(isCanonicalUsda).filter((f) => {
    if (!isPotatoBaseCanonical(f)) return false;
    if (!ctx.q) return false;
    if (ctx.tokens.length > 1) return ctx.tokens.every((t) => f._blob.includes(t)) || f._name.includes(ctx.q);
    return qTokens.some((t) => f._blob.includes(t));
  }).map((f) => ({
      f,
      s: canonicalScore(f),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name))
    .map((x) => x.f as FoodItem);

  return dedupeFoodsByName(scored).slice(0, Math.max(limit, 12));
}

async function resolvePotatoFamilyStrict(ctx: QueryCtx, limit: number): Promise<FoodItem[]> {
  const queryTokens = unique([ctx.q, ...ctx.tokens, ...ctx.expanded].map((t) => normalize(t)).filter(Boolean));
  const candidateIds = new Set<string>();
  for (const token of queryTokens) {
    for (const id of FOOD_TOKEN_INDEX[token] ?? []) {
      candidateIds.add(id);
      if (candidateIds.size >= 1200) break;
    }
    if (candidateIds.size >= 1200) break;
  }
  if (candidateIds.size < 300) {
    for (const token of queryTokens) {
      const prefix = token.slice(0, 3);
      if (!prefix) continue;
      for (const id of FOOD_PREFIX_INDEX[prefix] ?? []) {
        candidateIds.add(id);
        if (candidateIds.size >= 1800) break;
      }
      if (candidateIds.size >= 1800) break;
    }
  }
  const pool = (await resolveFoodsByIds([...candidateIds])).map(toIndexedFood);
  const isSweet = ctx.q.includes("sweet potato");
  const rows = pool
    .filter((f) => {
      const n = f._name;
      if (isSweet) {
        if (!/\bsweet\b/.test(n) || !/\bpotato(?:es)?\b/.test(n)) return false;
      } else {
        if (!/\bpotato(?:es)?\b/.test(n)) return false;
      }
      const isPlainBase = /^(potato|potatoes|sweet potato|sweet potatoes)\s*(,|$)/.test(n);
      const isCookingBase = /\b(raw|cooked|boiled|baked|flesh|with skin|without skin)\b/.test(n);
      if (!(isPlainBase || isCookingBase)) return false;
      if (/\b(fries|french|hash brown|chips?|crisps?|snack|mix|bread|cookie|pie|salad|soup|dumpling|gnocchi|knish|flour|flakes|bites|blintzes|crowns|crusted|munchers|pancakes|puffs|sausage|skins|starch|stix|ridges)\b/.test(n)) {
        return false;
      }
      return true;
    })
    .map((f) => ({ f: f as FoodItem, s: score(f, ctx) + (f.id.startsWith("usda-") ? 2400 : 2000) }))
    .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name))
    .map((x) => x.f);

  return dedupeFoodsByName(rows).slice(0, limit);
}

function buildQueryCtx(query: string): QueryCtx {
  const q = normalize(query);
  const tokens = q.split(/\s+/).filter(Boolean);
  let singular: string | undefined;
  let plural: string | undefined;
  if (tokens.length === 1) {
    const t = tokens[0];
    singular = t.endsWith("ies") ? `${t.slice(0, -3)}y` : t.endsWith("s") ? t.slice(0, -1) : t;
    plural = singular.endsWith("y") ? `${singular.slice(0, -1)}ies` : `${singular}s`;
  }
  const intentFamilies = detectQueryIntent(tokens);
  return { q, tokens, expanded: expandQueryTokens(q), singular, plural, intentFamilies };
}

function hasAllCoreTokensForTop(food: IndexedFood, ctx: QueryCtx): boolean {
  if (ctx.tokens.length <= 1) return true;
  return ctx.tokens.every((t) => new RegExp(`\\b${t}\\b`).test(food._name) || new RegExp(`\\b${t}\\b`).test(food._aliases));
}

function isFamilyCompatible(food: IndexedFood, ctx: QueryCtx): boolean {
  if (ctx.intentFamilies.size === 0) return true;
  const cats = detectFoodCategories(food);
  for (const fam of ctx.intentFamilies) {
    if (cats.has(fam)) return true;
  }
  return false;
}

function score(food: IndexedFood, ctx: QueryCtx): number {
  const q = ctx.q;
  if (!q) return 0;
  let s = 0;
  if (food._name === q) s += RANK_WEIGHTS.exactName;
  if (ctx.tokens.length > 1 && food._name.includes(q)) s += RANK_WEIGHTS.exactMultiTokenContains;
  if (food._name.startsWith(q)) s += RANK_WEIGHTS.startsWith;
  if (food._blob.includes(q)) s += RANK_WEIGHTS.blobContains;
  if (food._name.split(/[^a-z0-9]+/).includes(q)) s += RANK_WEIGHTS.nameTokenExact;
  if (food._aliases.split(/[^a-z0-9]+/).includes(q)) s += RANK_WEIGHTS.aliasTokenExact;

  for (const eq of ctx.expanded) {
    if (!eq || eq === q) continue;
    if (food._name === eq) s += RANK_WEIGHTS.expandedExact;
    if (food._name.startsWith(eq)) s += RANK_WEIGHTS.expandedStartsWith;
    if (food._blob.includes(eq)) s += RANK_WEIGHTS.expandedContains;
    if (food._name.split(/[^a-z0-9]+/).includes(eq)) s += RANK_WEIGHTS.expandedNameToken;
  }

  // Strongly demote near-prefix but different words (e.g. "cherimoya" for "cherry").
  if (ctx.tokens.length === 1) {
    const t = ctx.tokens[0];
    if (food._name.startsWith(t.slice(0, 3)) && !food._name.includes(t) && !ctx.expanded.some((e) => food._name.includes(e))) {
      s += RANK_WEIGHTS.nearPrefixWrongWordPenalty;
    }
  }

  let covered = 0;
  for (const token of ctx.tokens) {
    if (food._name.includes(token)) {
      s += RANK_WEIGHTS.tokenNameCoverage;
      covered += 1;
    } else if (food._blob.includes(token)) {
      s += RANK_WEIGHTS.tokenBlobCoverage;
      covered += 1;
    }
  }
  if (covered === ctx.tokens.length && ctx.tokens.length > 0) s += RANK_WEIGHTS.allTokensCoveredBonus;

  // For single-food queries (e.g. "cherry"), strongly boost canonical raw entries.
  if (ctx.tokens.length === 1 && ctx.singular && ctx.plural) {
    if (
      food._name.startsWith(ctx.singular) ||
      food._name.startsWith(`${ctx.singular},`) ||
      food._name.startsWith(ctx.plural) ||
      food._name.startsWith(`${ctx.plural},`)
    ) {
      s += RANK_WEIGHTS.singleTokenStemStartsWith;
    }
    if (food._name.includes(" raw")) s += RANK_WEIGHTS.singleTokenRawBonus;
    // Prefer plain/base names for single-item lookups: "chicken", "banana", etc.
    const wordCount = food._name.split(/\s+/).length;
    if (food._name === ctx.singular || food._name === ctx.plural) s += RANK_WEIGHTS.singleTokenExactSingularPlural;
    if (
      (food._name.startsWith(ctx.singular) || food._name.startsWith(ctx.plural)) &&
      wordCount <= 4 &&
      !/[&'()]/.test(food._name)
    ) {
      s += RANK_WEIGHTS.singleTokenShortStartsWith;
    }
    if (wordCount > 6) s += RANK_WEIGHTS.singleTokenLongNamePenalty;
    if (/[&'()]/.test(food._name)) s += RANK_WEIGHTS.singleTokenSpecialCharPenalty;
    if (
      /\b(with|and|style|sauce|flavored|barbecue|bbq|ribs|mashed|rice|pasta|sandwich|nuggets|strips|prepared)\b/.test(
        food._name
      )
    ) {
      s += RANK_WEIGHTS.singleTokenPreparedPenalty;
    }
  }

  // Favor plain produce-style entries for short whole-food queries.
  if (/(^|\\s)(raw|fresh|plain|unsweetened)(\\s|$)/.test(food._blob)) s += RANK_WEIGHTS.wholeFoodContextBonus;
  if (/(^|\\s)(fruit|vegetable|berries|berry|cherry|banana|apple|oatmeal)(\\s|$)/.test(food._blob)) s += RANK_WEIGHTS.produceContextBonus;

  // Demote branded/processed terms that often crowd simple searches.
  if (/(^|\\s)(pie|strudel|cola|frosted|balls|candy|cookie|bar|chips|syrup|sauce)(\\s|$)/.test(food._blob)) s += RANK_WEIGHTS.processedPenalty;
  if (/(^|\\s)(premium|authentic|seasoned|minimally|processed|organic|plus)(\\s|$)/.test(food._blob)) s += RANK_WEIGHTS.brandedAdjectivePenalty;
  if (ctx.q === "melon" || ctx.q === "melons") {
    if (/\b(strawberry|drink|mix|iced tea|sparkling|cocktail|beverage)\b/.test(food._blob)) s += RANK_WEIGHTS.melonDrinkPenalty;
    if (/\braw\b/.test(food._blob)) s += RANK_WEIGHTS.melonRawBonus;
    if (/\b(cantaloupe|honeydew|muskmelon)\b/.test(food._blob)) s += RANK_WEIGHTS.melonCantaloupeHoneydewBonus;
    if (/\bwatermelon\b/.test(food._blob)) s += RANK_WEIGHTS.melonWatermelonPenalty;
  }
  if (NOISY_TOP_TERMS.test(food._blob)) s += RANK_WEIGHTS.noisyTopPenalty;
  if (isGenericWholeFood(food)) s += RANK_WEIGHTS.genericWholeFoodBonus;
  if (ctx.tokens.length === 1 && isDerivativeForm(food)) s -= 240;
  if (ctx.tokens.length === 1 && NON_CORE_FOLLOWUP_TERMS.test(food._name)) {
    s += RANK_WEIGHTS.nonCoreFollowupPenalty;
  }
  if (ctx.tokens.length === 1 && ctx.tokens[0]) {
    const t = ctx.tokens[0];
    const asWord = new RegExp(`\\b${t}\\b`);
    if (asWord.test(food._name)) s += RANK_WEIGHTS.wholeTokenBonus;
    if (food._name.endsWith(` ${t}`)) s += 420;
    if (food._name.startsWith(`${t} `)) {
      const remainder = food._name.slice(t.length + 1).trim();
      if (STARTS_WITH_NON_CORE_TERMS.test(remainder)) s -= 700;
    }
    // penalize prefixed variants where query is not a standalone token (e.g., breaded for bread)
    if (food._name.startsWith(t) && !asWord.test(food._name)) s += RANK_WEIGHTS.prefixedVariantPenalty;
    if (
      STAPLE_QUERY_TOKENS.has(t) &&
      (/\b(with|and|style|sauce|flavor|flavored|mix|mixes|snack|chips?|bar|cake|cookie|dessert)\b/.test(food._name) ||
        DISH_CONTAINS_PATTERN.test(food._name))
    ) {
      s -= 420;
    }
    if (t === "rice") {
      if (food._name === "rice" || food._name.startsWith("rice,") || food._name.startsWith("rice ")) s += 900;
      if (/\brice\b/.test(food._name) && /\b(white|brown|raw|cooked|boiled|long grain|short grain|basmati|jasmine)\b/.test(food._name)) s += 520;
      if (DISH_CONTAINS_PATTERN.test(food._name)) s -= 700;
    }
    if (t === "bread") {
      if (food._name === "bread" || food._name.startsWith("bread,") || food._name.startsWith("bread ")) s += 700;
      if (/\bbread\b/.test(food._name) && /\b(white|whole wheat|whole-wheat|wheat|rye|sourdough|italian|french)\b/.test(food._name)) s += 420;
      if (DISH_CONTAINS_PATTERN.test(food._name)) s -= 520;
    }
    if (t === "potato") {
      if (food._name === "potato" || food._name.startsWith("potato,") || food._name.startsWith("potato ")) s += 700;
      if (/\bpotato(?:es)?\b/.test(food._name) && /\b(raw|baked|boiled|cooked|flesh)\b/.test(food._name)) s += 420;
      if (DISH_CONTAINS_PATTERN.test(food._name)) s -= 520;
    }
  }

  if (/^\d+/.test(food._name)) s += RANK_WEIGHTS.startsWithDigitPenalty;
  if (/\boz\b/.test(food._name)) s += RANK_WEIGHTS.ozPenalty;
  s += Math.max(0, food._name.split(/\s+/).length - ctx.tokens.length) * RANK_WEIGHTS.extraWordsPenalty;

  // Hard-demote obviously corrupted nutrition rows (bad unit scaling/import artifacts).
  if (
    food.caloriesPer100g > 900 ||
    food.proteinPer100g > 100 ||
    (typeof food.carbsPer100g === "number" && food.carbsPer100g > 100) ||
    (typeof food.fatPer100g === "number" && food.fatPer100g > 100)
  ) {
    s += RANK_WEIGHTS.impossibleNutritionPenalty;
  }

  s += categoryPriorScore(food, ctx);

  const qJoined = ctx.tokens.join(" ");
  if (qJoined.includes("sweet potato")) {
    if (/\bsweet\b/.test(food._name) && /\bpotato(?:es)?\b/.test(food._name)) s += 520;
    if (!/\bpotato(?:es)?\b/.test(food._name)) s -= 520;
  }
  if (qJoined.includes("chicken breast")) {
    if (/\bchicken\b/.test(food._name) && /\bbreast\b/.test(food._name)) s += 420;
    if (!/\bchicken\b/.test(food._name) || !/\bbreast\b/.test(food._name)) s -= 420;
  }
  if (qJoined.includes("brown rice")) {
    if (/\bbrown\b/.test(food._name) && /\brice\b/.test(food._name)) s += 420;
    if (!/\bbrown\b/.test(food._name) || !/\brice\b/.test(food._name)) s -= 420;
  }
  if (qJoined.includes("sweet potato")) {
    if (DISH_CONTAINS_PATTERN.test(food._name)) s -= 700;
    if (/\bsweet\b/.test(food._name) && /\bpotato(?:es)?\b/.test(food._name) && /\b(raw|baked|boiled|cooked)\b/.test(food._name)) s += 520;
  }

  return s;
}


export async function searchFoodsAsync(query: string, limit = SEARCH_LIMIT_DEFAULT): Promise<FoodItem[]> {
  const q = normalize(query);
  const ctx = buildQueryCtx(q);
  const cacheKey = `canonical::${q}::${limit}`;
  const cached = queryCache.get(cacheKey);
  if (cached) return cached;

  if (!q) {
    const defaultRows = canonicalCoreUsda
      .slice(0, Math.max(limit, 20))
      .map((x) => x as FoodItem)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
    queryCache.set(cacheKey, defaultRows);
    return defaultRows;
  }

  if (q === "potato" || q === "potatoes" || q.includes("sweet potato")) {
    const strictPotato = await resolvePotatoFamilyStrict(ctx, limit);
    queryCache.set(cacheKey, strictPotato);
    return strictPotato;
  }

  const canonicalTop = await canonicalUsdaRank(ctx, Math.max(limit, 240));
  const potatoPin =
    ctx.q === "potato" || ctx.q === "potatoes"
      ? canonicalTop.filter((x) =>
          /\bpotato(?:es)?\b/.test(normalize(x.name)) && /\b(raw|cooked|boiled|baked|flesh)\b/.test(normalize(x.name))
        )
      : [];
  const sweetPotatoPin =
    ctx.q.includes("sweet potato")
      ? canonicalTop.filter((x) =>
          /\bsweet\b/.test(normalize(x.name)) &&
          /\bpotato(?:es)?\b/.test(normalize(x.name)) &&
          /\b(raw|cooked|boiled|baked|flesh)\b/.test(normalize(x.name))
        )
      : [];
  const topEligible = canonicalTop.filter((x) => {
    if (TOP_TIER_EXCLUDE_TERMS.test(normalize(x.name))) return false;
    if (!isHardTopEligible(x, ctx)) return false;
    const fx = toIndexedFood(x);
    if (!isFamilyCompatible(fx, ctx)) return false;
    if (!hasAllCoreTokensForTop(fx, ctx)) return false;
    return true;
  });
  const rankedTopEligible = topEligible
    .map((x) => ({ x, s: topTierScore(x, ctx) }))
    .sort((a, b) => b.s - a.s || a.x.name.localeCompare(b.x.name))
    .map((p) => p.x);
  const pinned = dedupeFoodsByName([...sweetPotatoPin, ...potatoPin]);
  const rankedWithPins = dedupeFoodsByName([...pinned, ...rankedTopEligible]);
  const topEligibleIds = new Set(rankedWithPins.map((x) => x.id));
  const restCanonical = canonicalTop.filter((x) => !topEligibleIds.has(x.id));

  const topSlots = Math.min(limit, 5);
  const top: FoodItem[] = rankedWithPins.slice(0, topSlots);
  // Minimum-result floor: if strict top filter is too narrow, backfill from canonical matches.
  if (top.length < Math.min(5, topSlots)) {
    for (const row of restCanonical) {
      if (top.find((x) => x.id === row.id)) continue;
      if (TOP_TIER_EXCLUDE_TERMS.test(normalize(row.name))) continue;
      const fx = toIndexedFood(row);
      if (!isFamilyCompatible(fx, ctx)) continue;
      top.push(row);
      if (top.length >= Math.min(5, topSlots)) break;
    }
  }
  const topIds = new Set(top.map((x) => x.id));
  const rest = canonicalTop.filter((x) => !topIds.has(x.id));
  const restClean = rest.filter((x) => !TOP_TIER_EXCLUDE_TERMS.test(normalize(x.name)));
  const restNoisy = rest.filter((x) => TOP_TIER_EXCLUDE_TERMS.test(normalize(x.name)));
  const visibleTarget = Math.min(5, limit);
  const head: FoodItem[] = [...top, ...restClean];
  if (head.length < visibleTarget) {
    const branded = await searchFoodsBrandedAsync(query, Math.max(limit, 12));
    const existing = new Set(head.map((x) => normalize(x.name)));
    for (const row of branded) {
      if (TOP_TIER_EXCLUDE_TERMS.test(normalize(row.name))) continue;
      const key = normalize(row.name);
      if (existing.has(key)) continue;
      head.push(row);
      existing.add(key);
      if (head.length >= visibleTarget) break;
    }
  }
  let result = [...head, ...restNoisy].slice(0, limit);
  if (result.length < Math.min(3, limit)) {
    const queryTokens = unique([ctx.q, ...ctx.tokens, ...ctx.expanded].map((t) => normalize(t)).filter(Boolean));
    const candidateIds = new Set<string>();
    for (const token of queryTokens) {
      for (const id of FOOD_TOKEN_INDEX[token] ?? []) {
        candidateIds.add(id);
        if (candidateIds.size >= 400) break;
      }
      if (candidateIds.size >= 400) break;
    }
    if (candidateIds.size < 220) {
      for (const token of queryTokens) {
        const prefix = token.slice(0, 3);
        if (!prefix) continue;
        for (const id of FOOD_PREFIX_INDEX[prefix] ?? []) {
          candidateIds.add(id);
          if (candidateIds.size >= 500) break;
        }
        if (candidateIds.size >= 500) break;
      }
    }
    const relaxed = (await resolveFoodsByIds([...candidateIds]))
      .map(toIndexedFood)
      .filter((f) => !TOP_TIER_EXCLUDE_TERMS.test(f._name))
      .map((f) => ({ f: f as FoodItem, s: score(f, ctx) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name))
      .map((x) => x.f);
    const existing = new Set(result.map((x) => normalize(x.name)));
    for (const row of relaxed) {
      const key = normalize(row.name);
      if (existing.has(key)) continue;
      result.push(row);
      existing.add(key);
      if (result.length >= limit) break;
    }
  }

  queryCache.set(cacheKey, result);
  if (queryCache.size > CACHE_LIMIT) {
    const firstKey = queryCache.keys().next().value as string | undefined;
    if (firstKey) queryCache.delete(firstKey);
  }
  return result;
}

export async function searchFoodsBrandedAsync(query: string, limit = SEARCH_LIMIT_DEFAULT): Promise<FoodItem[]> {
  const q = normalize(query);
  if (!q) return [];
  const ctx = buildQueryCtx(q);
  const queryTokens = unique([q, ...ctx.expanded, ...ctx.tokens].map((t) => normalize(t)).filter(Boolean));
  const candidateIds = new Set<string>();
  const addIds = (ids: string[], cap: number) => {
    for (const id of ids) {
      if (id.startsWith("usda-")) continue;
      candidateIds.add(id);
      if (candidateIds.size >= cap) break;
    }
  };
  for (const token of queryTokens) {
    addIds(FOOD_TOKEN_INDEX[token] ?? [], 220);
    if (candidateIds.size >= 180) break;
  }
  if (candidateIds.size < 80) {
    for (const token of queryTokens) {
      const prefix = token.slice(0, 3);
      if (!prefix) continue;
      addIds(FOOD_PREFIX_INDEX[prefix] ?? [], 280);
      if (candidateIds.size >= 220) break;
    }
  }
  const resolved = await resolveFoodsByIds([...candidateIds]);
  const rows = resolved
    .filter((x) => !x.id.startsWith("usda-"))
    .map(toIndexedFood)
    .map((food) => ({ food, s: score(food, ctx) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.food.name.localeCompare(b.food.name))
    .map((x) => x.food as FoodItem);
  return dedupeFoodsByName(rows).slice(0, limit);
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
