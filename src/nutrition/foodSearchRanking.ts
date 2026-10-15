import type { FoodItem } from "./foodDb";

const alternatives: Record<string, string[]> = {
  yoghurt: ["yogurt", "yoghurt"], yogurt: ["yogurt", "yoghurt"],
  aubergine: ["aubergine", "eggplant"], eggplant: ["aubergine", "eggplant"],
  courgette: ["courgette", "zucchini"], zucchini: ["courgette", "zucchini"],
  garbanzo: ["garbanzo", "chickpea"], chickpea: ["garbanzo", "chickpea"],
  oatmeal: ["oatmeal", "oat"], oat: ["oatmeal", "oat"],
  melon: ["melon", "cantaloupe", "honeydew", "muskmelon"],
  cooked: ["cooked", "boiled", "roasted", "grilled", "baked", "steamed"],
  raw: ["raw", "uncooked"], uncooked: ["raw", "uncooked"],
  ground: ["ground", "minced"], minced: ["ground", "minced"],
};
const preparationTokens = new Set(["raw", "uncooked", "cooked", "boiled", "roasted", "grilled", "baked", "steamed", "dry", "frozen", "unsweetened", "plain", "nonfat"]);

export function normalizeFoodSearch(text: string): string {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^\p{L}\p{N}%/.]+/gu, " ").trim().replace(/\s+/g, " ");
}
function stem(token: string): string {
  if (/^(cookies|brownies|smoothies|pies)$/.test(token)) return token.slice(0, -1);
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.endsWith("oes")) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) return token.slice(0, -1);
  return token;
}
export function foodSearchTokens(text: string): string[] {
  return (normalizeFoodSearch(text).match(/\d+(?:[/.]\d+)?%|[\p{L}\p{N}]+/gu) ?? []).map(stem);
}
export function foodQuery(query: string) {
  const normalized = normalizeFoodSearch(query);
  const tokens = foodSearchTokens(query);
  const groups = tokens.map((token) => alternatives[token] ?? [token]);
  const namedPreparation = tokens.some((token) => preparationTokens.has(token));
  const expressions = groups.map((group) => {
    const forms = group.flatMap((word) => word.endsWith("%") ? [word] : [word, `${word}s`, word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}es`]);
    const pattern = forms.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return {
      exact: new RegExp(`(?:^|[^\\p{L}\\p{N}/.])(?:${pattern})(?=$|[^\\p{L}\\p{N}/.])`, "iu"),
      prefix: new RegExp(`(?:^|[^\\p{L}\\p{N}/.])(?:${pattern})`, "iu"),
    };
  });
  return { normalized, tokens, groups, namedPreparation, expressions };
}
type Query = ReturnType<typeof foodQuery>;

export function matchesFoodQuery(name: string, aliases: string, query: Query, prefix = false): boolean {
  if (!query.tokens.length) return false;
  return query.expressions.every((expression, index) => {
    // Explicit preparation and percentage qualifiers must be in the food name,
    // not merely an Open Food Facts category tag shared by unrelated products.
    const nameOnly = preparationTokens.has(query.tokens[index]) || query.tokens[index].endsWith("%");
    const rx = prefix && index === query.groups.length - 1 && query.tokens[index].length >= 3 ? expression.prefix : expression.exact;
    return rx.test(name) || (!nameOnly && rx.test(aliases));
  });
}

function credibleNutrition(food: FoodItem): boolean {
  const macros = [food.proteinPer100g, food.carbsPer100g, food.fatPer100g];
  return Number.isFinite(food.caloriesPer100g) && food.caloriesPer100g >= 0 && food.caloriesPer100g <= 900 &&
    Number.isFinite(food.servingGrams) && food.servingGrams > 0 &&
    macros.every((value) => value == null || (Number.isFinite(value) && value >= 0 && value <= 100));
}

export function rankFoodMatches(foods: FoodItem[], query: Query, limit: number, prefix = false): FoodItem[] {
  const score = (food: FoodItem) => {
    const title = food.name.replace(/\(Includes foods for USDA's Food Distribution Program\)/gi, "");
    const name = normalizeFoodSearch(title);
    const tokens = foodSearchTokens(title);
    let value = tokens.length ? 400 - Math.max(0, tokens.length - query.tokens.length) * 6 : 0;
    if (name === query.normalized) value += 700;
    if (name.startsWith(query.normalized)) value += 120;
    value += query.groups.filter((group) => group.some((token) => tokens.includes(token))).length * 100;
    // Explicit brands still need to match the full query before this boost can
    // apply; generic produce must not lose to ambiguous one-word product names.
    const noise = tokens.filter((token) => ["dessert", "cookie", "brownie", "smoothie", "cake", "bar", "pancake", "breaded", "candy", "sauce", "dip", "dressing", "creamer", "drink", "soda", "beverage", "cocktail", "babyfood", "infant", "toddler", "juice", "snack", "chip", "mix", "syrup", "flour", "soup", "bread", "pasta", "cracker", "popcorn", "wafer", "skin", "giblet", "feet"].includes(token) && !query.tokens.includes(token)).length;
    if (food.sourceType === "usda-generic" || (food.id.startsWith("usda-") && /\b(raw|fresh)\b/.test(name) && !/\b(bar|mix|snack|drink|cake|cookie|candy)\b/.test(name))) value += noise ? 400 : 1600;
    const brandWords = title.match(/\b[A-Z]{3,}\b/g) ?? [];
    if (food.sourceType === "usda-generic" && brandWords.length && !brandWords.some((word) => query.tokens.includes(word.toLowerCase()))) value -= 500;
    value -= noise * 700;
    if (!query.namedPreparation && /\b(plain|raw|fresh)\b/.test(name)) value += 100;
    return value;
  };
  const ranked = foods.filter(credibleNutrition).filter((food) => matchesFoodQuery(food.name, food.aliases.join(" "), query, prefix))
    .map((food) => ({ food, score: score(food) })).sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name) || a.food.id.localeCompare(b.food.id));
  const seen = new Set<string>();
  return ranked.filter(({ food }) => {
    // Normalize punctuation/case, but retain different raw/cooked preparations
    // and same-name products with different nutrition or barcode identities.
    const key = `${normalizeFoodSearch(food.name)}|${food.caloriesPer100g}|${food.proteinPer100g}|${food.carbsPer100g}|${food.fatPer100g}|${food.barcode ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, limit).map(({ food }) => food);
}
