import type { FoodItem } from "./foodDb";
import { reviewedFoodMetadata, reviewedSearchAliases } from "./reviewedFoodCatalog";

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
const referenceCategories = new Set(["fish", "cereals", "cheese", "oil", "beans"]);
const specializedTokens = new Set(["dry", "dried", "dehydrated", "canned", "frozen", "condensed", "imitation", "buttermilk", "sheep", "goat", "buffalo", "human", "fried", "fermented", "gizzard", "heart", "liver", "leave", "leaf", "stalk", "stick", "crumb", "spinach", "fortified", "chocolate", "vanilla", "cinnamon", "cheese", "egg", "sweetened", "sodium", "cooked", "powder"]);
const canonicalTokens = (tokens: string[]) => tokens.map(token => alternatives[token]?.[0] ?? token).join(" ");

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
  const plantMilk = tokens.includes("milk") && tokens.some(token => ["oat", "almond", "soy", "coconut"].includes(token));
  const groups = tokens.map((token) => token === "milk" && plantMilk ? ["milk", "beverage", "drink"] : alternatives[token] ?? [token]);
  const namedPreparation = tokens.some((token) => preparationTokens.has(token));
  const expressions = groups.map((group) => {
    const forms = group.flatMap((word) => word.endsWith("%") ? [word] : [word, `${word}s`, word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}es`]);
    const pattern = forms.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return {
      exact: new RegExp(`(?:^|[^\\p{L}\\p{N}/.])(?:${pattern})(?=$|[^\\p{L}\\p{N}/.])`, "iu"),
      prefix: new RegExp(`(?:^|[^\\p{L}\\p{N}/.])(?:${pattern})`, "iu"),
    };
  });
  // A necessary substring condition only; the full matcher remains authoritative.
  // Drop final y so both cherry/cherries pass. Non-ASCII queries skip this gate.
  const fastTerms = groups.every(group => group.every(word => /^[a-z0-9%/.]+$/.test(word)))
    ? groups.map(group => group.map(word => word.endsWith("y") ? word.slice(0, -1) : word)) : null;
  return { normalized, tokens, groups, namedPreparation, expressions, fastTerms };
}
type Query = ReturnType<typeof foodQuery>;

export function foodSearchText(name: string, aliases: string): string | null {
  const text = `${name} ${aliases}`;
  // Unicode case folding has extra equivalences; keep those rows on the full path.
  return /^[\x00-\x7F]*$/.test(text) ? text.toLowerCase() : null;
}
export function mayMatchFoodQuery(text: string | null, query: Query): boolean {
  return text === null || query.fastTerms === null || query.fastTerms.every(group => group.some(word => text.includes(word)));
}

export function matchesFoodQuery(name: string, aliases: string, query: Query, prefix = false): boolean {
  if (!query.tokens.length) return false;
  // "Non-soy" is not a positive soy match. An explicit "non soy" query still
  // finds it; do not silently reverse a user's ingredient qualifier.
  if (!query.tokens.includes("non") && [...name.matchAll(/\bnon[-\s]+([\p{L}\p{N}]+)/giu)].some(match =>
    query.groups.some(group => group.includes(stem(match[1].toLowerCase()))))) return false;
  const plantMilk = query.groups[query.tokens.indexOf("milk")]?.includes("beverage");
  if (plantMilk && !query.tokens.includes("powder") && /\bpowders?\b/i.test(name) && !/\bmilk\b/i.test(name)) return false;
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
    const reviewed = reviewedFoodMetadata(food.id);
    const name = normalizeFoodSearch(title);
    const tokens = foodSearchTokens(title);
    let value = tokens.length ? 400 - Math.max(0, tokens.length - query.tokens.length) * 6 : 0;
    const canonicalName = canonicalTokens(tokens);
    const canonicalQuery = canonicalTokens(query.tokens);
    if (canonicalName === canonicalQuery) value += 700;
    if (canonicalName.startsWith(canonicalQuery)) value += 120;
    value += query.groups.filter((group) => group.some((token) => tokens.includes(token))).length * 100;
    // Explicit brands still need to match the full query before this boost can
    // apply; generic produce must not lose to ambiguous one-word product names.
    const requested = (token: string) => query.groups.some(group => group.includes(token));
    const brandAliases = reviewed?.brands ?? food.brandNames ?? food.aliases.slice(0, 2);
    const brandMatch = brandAliases.some(alias => !/^[a-z]{2}:/.test(alias) && canonicalTokens(foodSearchTokens(alias)).startsWith(canonicalQuery));
    const nameMatch = matchesFoodQuery(title, "", query, prefix);
    const noise = brandMatch && !nameMatch ? 0 : tokens.filter((token) => ["dessert", "cookie", "brownie", "smoothie", "cake", "bar", "pancake", "breaded", "candy", "sauce", "dip", "dressing", "creamer", "drink", "soda", "beverage", "cocktail", "babyfood", "infant", "toddler", "juice", "snack", "chip", "mix", "syrup", "flour", "soup", "bread", "pasta", "cracker", "popcorn", "wafer", "skin", "giblet", "feet"].includes(token) && !requested(token) && !(token === "skin" && /\bwithout skin\b/.test(name))).length;
    // Reference provenance must not promote a nutrient mentioned only in a
    // description (e.g. yogurt's protein amount) above the requested food name.
    const primaryName = reviewed?.identity ?? food.searchIdentity ?? title.split(",")[0];
    const primaryTokens = foodSearchTokens(primaryName);
    const identityName = referenceCategories.has(normalizeFoodSearch(primaryName)) ? title.split(",").slice(0, 3).join(" ") : primaryName;
    const primaryMatch = query.expressions.some((expression) => expression.exact.test(identityName));
    if (query.tokens.length === 1 && primaryTokens.length === 1 && query.expressions.every(expression => expression.exact.test(primaryName))) value += 1500;
    const specialization = tokens.filter(token => specializedTokens.has(token) && !requested(token)).length;
    // Category tags and ingredient lists remain searchable, but a real name or
    // leading brand/alias match comes before a metadata-only match.
    const leadingAliases = [...brandAliases, reviewed?.identity ?? food.searchIdentity ?? ""].filter(alias => !/^[a-z]{2}:/.test(alias)).join(" ");
    if (nameMatch) value += 1200;
    else if (!matchesFoodQuery(title, leadingAliases, query, prefix)) value -= 2500;
    else if (brandMatch) value += 800;
    if (primaryMatch && (food.sourceType === "usda-generic" || (food.id.startsWith("usda-") && /\b(raw|fresh)\b/.test(name) && !/\b(bar|mix|snack|drink|cake|cookie|candy)\b/.test(name)))) value += noise || specialization ? 400 : 1600;
    const brandWords = title.match(/\b[A-Z]{3,}\b/g) ?? [];
    if (food.sourceType === "usda-generic" && brandWords.length && !brandWords.some((word) => query.tokens.includes(word.toLowerCase()))) value -= 500;
    value -= noise * 700;
    if (!query.namedPreparation && /\b(plain|raw|fresh)\b/.test(name)) value += 100;
    return value;
  };
  const ranked = foods.filter(credibleNutrition).filter(food => reviewedFoodMetadata(food.id)?.searchable !== false).filter((food) => matchesFoodQuery(food.name, [...food.aliases, ...(food.brandNames ?? []), food.searchIdentity ?? "", reviewedSearchAliases(food.id)].join(" "), query, prefix))
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
