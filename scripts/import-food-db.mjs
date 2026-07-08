#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";

/**
 * Usage:
 * node scripts/import-food-db.mjs --source normalized --in ./data/foods.json --out ./src/nutrition/data --chunk 500
 * node scripts/import-food-db.mjs --source usda --in ./data/usda.json --out ./src/nutrition/data --chunk 500
 * node scripts/import-food-db.mjs --source usda-csv --in ./data/usda_csv_2025-12-18/FoodData_Central_csv_2025-12-18 --out ./src/nutrition/data --chunk 500
 * node scripts/import-food-db.mjs --source off --in ./data/openfoodfacts.json --out ./src/nutrition/data --chunk 500
 * node scripts/import-food-db.mjs --source off-jsonl --in ./data/openfoodfacts-products.jsonl.gz --out ./src/nutrition/data --chunk 500
 */

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx === args.length - 1) return fallback;
  return args[idx + 1];
};

const inputPath = readArg("--in", "");
const outputDir = readArg("--out", "./src/nutrition/data");
const chunkSize = Number(readArg("--chunk", "500"));
const source = String(readArg("--source", "normalized")).toLowerCase();
const maxRows = Number(readArg("--max", "50000"));
const includeBranded = String(readArg("--include-branded", "false")).toLowerCase() === "true";
const mergeWithExisting = String(readArg("--merge-existing", "false")).toLowerCase() === "true";
const canonicalKeepListPath = path.resolve("./scripts/canonical-food-keep-list.json");

if (!inputPath) {
  console.error("Missing --in path");
  process.exit(1);
}

const resolvedInputPath = path.resolve(inputPath);

const slugify = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toFinite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const pickAlias = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return String(Math.round(value * 100) / 100);
};

const fromNormalized = (row, idx) => ({
  id: String(row.id ?? `food-${idx + 1}`).trim(),
  name: String(row.name ?? "").trim(),
  aliases: pickAlias(row.aliases),
  servingLabel: String(row.servingLabel ?? "100 g").trim(),
  servingGrams: toFinite(row.servingGrams),
  caloriesPer100g: toFinite(row.caloriesPer100g),
  proteinPer100g: toFinite(row.proteinPer100g),
  carbsPer100g: toFinite(row.carbsPer100g ?? row.carbPer100g ?? row.carbohydratesPer100g),
  fatPer100g: toFinite(row.fatPer100g ?? row.fatsPer100g),
  foodFamilies: Array.isArray(row.foodFamilies) ? row.foodFamilies : undefined,
  foodForms: Array.isArray(row.foodForms) ? row.foodForms : undefined,
  isBaseFood: typeof row.isBaseFood === "boolean" ? row.isBaseFood : undefined,
  isPrepared: typeof row.isPrepared === "boolean" ? row.isPrepared : undefined,
  isComboMeal: typeof row.isComboMeal === "boolean" ? row.isComboMeal : undefined,
  isBranded: typeof row.isBranded === "boolean" ? row.isBranded : undefined,
  isDerivative: typeof row.isDerivative === "boolean" ? row.isDerivative : undefined,
  isStaple: typeof row.isStaple === "boolean" ? row.isStaple : undefined,
});

const findUsdaNutrient = (foodNutrients, names) => {
  if (!Array.isArray(foodNutrients)) return null;
  for (const n of foodNutrients) {
    const nutrientName = String(n?.nutrientName ?? n?.nutrient?.name ?? "").toLowerCase();
    if (names.some((name) => nutrientName.includes(name))) {
      const value = toFinite(n?.value ?? n?.amount);
      if (value != null) return value;
    }
  }
  return null;
};

const fromUsda = (row, idx) => {
  const name = String(row?.description ?? "").trim();
  const fdcId = row?.fdcId ?? row?.id ?? idx + 1;
  const calories = findUsdaNutrient(row?.foodNutrients, ["energy", "kcal"]);
  const protein = findUsdaNutrient(row?.foodNutrients, ["protein"]);
  const carbs = findUsdaNutrient(row?.foodNutrients, ["carbohydrate"]);
  const fat = findUsdaNutrient(row?.foodNutrients, ["total lipid", "fat"]);
  const servingGrams = toFinite(row?.servingSize) ?? 100;
  const servingUnit = String(row?.servingSizeUnit ?? "g").toLowerCase();
  const servingLabel = `${servingGrams} ${servingUnit}`;
  const aliases = pickAlias(row?.commonNames);
  return {
    id: `usda-${slugify(fdcId) || idx + 1}`,
    name,
    aliases,
    servingLabel,
    servingGrams,
    caloriesPer100g: calories,
    proteinPer100g: protein,
    carbsPer100g: carbs,
    fatPer100g: fat,
  };
};

const fromOff = (row, idx) => {
  const nutr = row?.nutriments ?? {};
  const calories =
    toFinite(nutr["energy-kcal_100g"]) ??
    (() => {
      const kj = toFinite(nutr["energy-kj_100g"]);
      return kj == null ? null : kj * 0.239005736;
    })();
  const protein = toFinite(nutr.proteins_100g);
  const carbs = toFinite(nutr.carbohydrates_100g);
  const fat = toFinite(nutr.fat_100g);
  const servingLabelRaw = String(row?.serving_size ?? "").trim();
  let servingGrams = 100;
  if (servingLabelRaw) {
    const m = servingLabelRaw.match(/(\d+(\.\d+)?)\s*g/i);
    if (m) {
      const parsed = toFinite(m[1]);
      if (parsed != null && parsed > 0) servingGrams = parsed;
    }
  }
  const aliases = [
    ...pickAlias(row?.brands),
    ...pickAlias(row?.categories_tags),
    ...pickAlias(row?.generic_name),
  ];
  return {
    id: `off-${slugify(row?.code || row?.id || idx + 1)}`,
    name: String(row?.product_name ?? row?.product_name_en ?? "").trim(),
    aliases,
    servingLabel: servingLabelRaw || `${servingGrams} g`,
    servingGrams,
    caloriesPer100g: calories,
    proteinPer100g: protein,
    carbsPer100g: carbs,
    fatPer100g: fat,
  };
};

const NOISY_MARKERS = [
  "100%",
  "all natural",
  "minimally processed",
  "with rib meat",
  "premium",
  "authentic",
  "style",
  "family size",
  "value pack",
  "limited edition",
];

const hasEmojiOrSymbolNoise = (text) => /[\u{1F300}-\u{1FAFF}]/u.test(text) || /[“”]/.test(text);

const isLikelyNoisyProductName = (name) => {
  const n = String(name ?? "").trim();
  if (!n) return true;
  const lower = n.toLowerCase();
  if (n.length > 90) return true;
  if (hasEmojiOrSymbolNoise(n)) return true;
  if (/^\d+[%\s]/.test(lower)) return true;
  if ((lower.match(/,/g) ?? []).length >= 3) return true;
  if (NOISY_MARKERS.some((marker) => lower.includes(marker))) return true;
  return false;
};

const qualityScore = (row, sourceTag = "unknown") => {
  const name = String(row?.name ?? "").toLowerCase().trim();
  let score = 0;
  if (sourceTag === "usda") score += 40;
  if (sourceTag === "normalized") score += 35;
  if (sourceTag === "off") score += 20;
  score += Math.max(0, 30 - Math.floor(name.length / 4));
  if (NOISY_MARKERS.some((marker) => name.includes(marker))) score -= 20;
  if ((name.match(/,/g) ?? []).length >= 2) score -= 15;
  if (/^\d+[%\s]/.test(name)) score -= 12;
  if (hasEmojiOrSymbolNoise(name)) score -= 20;
  if (Number.isFinite(Number(row?.proteinPer100g)) && Number(row.proteinPer100g) > 0) score += 6;
  if (Number.isFinite(Number(row?.caloriesPer100g)) && Number(row.caloriesPer100g) > 0) score += 6;
  return score;
};

const canonicalKeepConfig = fs.existsSync(canonicalKeepListPath)
  ? JSON.parse(fs.readFileSync(canonicalKeepListPath, "utf8"))
  : { requiredNames: [] };
const requiredCanonicalNames = new Set(
  (Array.isArray(canonicalKeepConfig.requiredNames) ? canonicalKeepConfig.requiredNames : [])
    .map((x) => String(x).toLowerCase().trim())
    .filter(Boolean)
);

const isRequiredCanonicalName = (name) =>
  requiredCanonicalNames.has(String(name ?? "").toLowerCase().trim());

const PRIORITY_KEEP_TOKENS = [
  "cherry",
  "melon",
  "sweet potato",
  "potato",
  "bread",
  "rice",
  "chicken",
  "beef",
  "salmon",
  "egg",
  "milk",
  "yogurt",
  "broccoli",
  "carrot",
  "onion",
  "pasta",
  "tofu",
  "banana",
  "apple",
  "oat",
];

const isPriorityKeepName = (name) => {
  const n = String(name ?? "").toLowerCase().trim();
  if (!n) return false;
  return PRIORITY_KEEP_TOKENS.some((t) => n.includes(t));
};

const isUsdaPotatoBaseKeep = (row) => {
  const id = String(row?.id ?? "");
  if (!id.startsWith("usda-")) return false;
  const n = String(row?.name ?? "").toLowerCase().trim();
  const isPotatoFamily =
    (/\bpotato(?:es)?\b/.test(n) && !/\bsweet\b/.test(n)) ||
    (/\bsweet\b/.test(n) && /\bpotato(?:es)?\b/.test(n));
  if (!isPotatoFamily) return false;
  const baseForm = /\b(raw|cooked|boiled|baked|flesh|with skin|without skin)\b/.test(n);
  if (!baseForm) return false;
  if (
    /\b(fries|french|hash brown|chips?|crisps?|snack|mix|bread|cookie|pie|salad|soup|dumpling|gnocchi|knish|flakes|bites|blintzes|crowns|crusted|munchers|pancakes|puffs|sausage|skins|starch|stix|ridges)\b/.test(
      n
    )
  ) {
    return false;
  }
  return true;
};

const MUST_KEEP_NAME_RULES = [
  /^melon$/,
  /^melons$/,
  /^melon,\s*raw$/,
  /^melons,\s*raw$/,
  /^melon,\s*frozen$/,
  /^melons,\s*frozen$/,
  /^cantaloupe,\s*raw$/,
  /^honeydew,\s*raw$/,
];

const isMustKeepGeneric = (name) => {
  const n = String(name ?? "").toLowerCase().trim();
  return MUST_KEEP_NAME_RULES.some((rule) => rule.test(n));
};

const normalizedNameKey = (name) =>
  String(name ?? "")
    .toLowerCase()
    .replace(/[%]/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[,.;:/\\|+_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const FAMILY_PATTERNS = {
  grains: /\b(rice|bread|wheat|rye|oat|oats|oatmeal|pasta|noodle|quinoa|barley|grain|flour)\b/,
  starches: /\b(potato|potatoes|sweet potato|yam|cassava|taro)\b/,
  produce: /\b(raw|fresh|fruit|vegetable|berries?|cherries?|banana|apple|melon|potato|tomato|onion|broccoli|carrot)\b/,
  protein: /\b(chicken|beef|turkey|fish|salmon|egg|tofu|protein|pork)\b/,
  dairy: /\b(milk|yogurt|cheese|dairy|whey)\b/,
  legumes: /\b(bean|beans|lentil|lentils|chickpea|chickpeas|pea|peas)\b/,
} ;

const FORM_PATTERNS = {
  raw: /\braw\b/,
  cooked: /\bcooked\b/,
  baked: /\bbaked\b/,
  boiled: /\bboiled\b/,
  roasted: /\broasted\b/,
  fresh: /\bfresh\b/,
  plain: /\bplain\b/,
  frozen: /\bfrozen\b/,
};

const PREPARED_PATTERNS =
  /\b(fried|fries|hash brown|breaded|battered|sandwich|wrap|bowl|dinner|meal|with|and|style|sauce|cocktail|mix|dessert|candy|cookie|chips?)\b/;
const DERIVATIVE_PATTERNS = /\b(flour|powder|crumbs?|mix|seasoning|extract|concentrate)\b/;

const deriveMetadata = (row) => {
  const n = String(row?.name ?? "").toLowerCase();
  const a = Array.isArray(row?.aliases) ? row.aliases.join(" ").toLowerCase() : "";
  const t = `${n} ${a}`.trim();
  const foodFamilies = Object.entries(FAMILY_PATTERNS)
    .filter(([, rx]) => rx.test(t))
    .map(([k]) => k);
  const foodForms = Object.entries(FORM_PATTERNS)
    .filter(([, rx]) => rx.test(t))
    .map(([k]) => k);
  const isPrepared = PREPARED_PATTERNS.test(t);
  const isDerivative = DERIVATIVE_PATTERNS.test(t);
  const isComboMeal = /\b(with|and)\b/.test(n) || /\b(dinner|meal|sandwich|wrap|bowl)\b/.test(n);
  const isBranded = String(row?.id ?? "").startsWith("off-") || /\b(premium|authentic|style|brand|organic)\b/.test(t);
  const isStaple = /\b(rice|bread|potato|sweet potato|oat|oats|oatmeal)\b/.test(t);
  const isBaseFood =
    !isPrepared &&
    !isDerivative &&
    !isComboMeal &&
    (foodForms.includes("raw") || foodForms.includes("fresh") || foodForms.includes("plain") || n.split(/\s+/).length <= 3);
  return {
    foodFamilies,
    foodForms,
    isBaseFood,
    isPrepared,
    isComboMeal,
    isBranded,
    isDerivative,
    isStaple,
  };
};

const loadExistingFoodsFromTs = (filePath, exportName) => {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  const marker = `export const ${exportName}: FoodItem[] = `;
  const start = text.indexOf(marker);
  if (start === -1) return [];
  const jsonStart = start + marker.length;
  const end = text.lastIndexOf(";");
  if (end === -1 || end <= jsonStart) return [];
  const jsonText = text.slice(jsonStart, end).trim();
  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const streamJsonl = async (filePath, onItem) => {
  const input = fs.createReadStream(filePath);
  const isGzip = filePath.toLowerCase().endsWith(".gz");
  const stream = isGzip ? input.pipe(zlib.createGunzip()) : input;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const item = JSON.parse(trimmed);
      const shouldContinue = onItem(item);
      if (shouldContinue === false) break;
    } catch {
      // skip malformed lines
    }
  }
};

const isValidRow = (row) =>
  row.id &&
  row.name &&
  Number.isFinite(row.servingGrams) &&
  row.servingGrams > 0 &&
  Number.isFinite(row.caloriesPer100g) &&
  row.caloriesPer100g > 0 &&
  Number.isFinite(row.proteinPer100g) &&
  row.proteinPer100g >= 0;

const BAD_NAME_CONTEXT = /\b(candy|candies|soda|cola|drink|mix|gelatin|jelly|cookie|bar|chips|syrup)\b/i;
const GENERIC_FRUIT_NAME = /^(cherry|melon|banana|apple|orange|grape|peach|pear)$/i;

const isSaneRow = (row) => {
  const calories = Number(row.caloriesPer100g);
  const protein = Number(row.proteinPer100g);
  const carbs = Number(row.carbsPer100g ?? 0);
  const fat = Number(row.fatPer100g ?? 0);
  const servingGrams = Number(row.servingGrams);
  const name = String(row.name ?? "").trim();
  const aliasesText = Array.isArray(row.aliases) ? row.aliases.join(" ") : String(row.aliases ?? "");
  const contextText = `${name} ${aliasesText}`.toLowerCase();
  const isOffRow = String(row.id ?? "").startsWith("off-");

  if (!Number.isFinite(calories) || calories <= 0 || calories > 900) return false;
  if (!Number.isFinite(protein) || protein < 0 || protein > 100) return false;
  if (Number.isFinite(carbs) && (carbs < 0 || carbs > 100)) return false;
  if (Number.isFinite(fat) && (fat < 0 || fat > 100)) return false;
  if (!Number.isFinite(servingGrams) || servingGrams <= 0 || servingGrams > 5000) return false;

  const macroSum = (Number.isFinite(protein) ? protein : 0) + (Number.isFinite(carbs) ? carbs : 0) + (Number.isFinite(fat) ? fat : 0);
  if (macroSum > 110) return false;

  // Extremely low-calorie high-macro or impossible density artifacts.
  if (calories < 10 && macroSum > 30) return false;

  // Generic single-fruit names should not carry obvious processed-food context.
  if (GENERIC_FRUIT_NAME.test(name) && BAD_NAME_CONTEXT.test(contextText)) return false;
  // OFF often has ambiguous one-word branded names ("Cherry") that are not canonical produce.
  if (isOffRow && GENERIC_FRUIT_NAME.test(name) && !/\b(raw|fresh)\b/.test(contextText)) return false;

  return true;
};

const parseCsvLine = (line) => {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
};

const readCsvRecords = (filePath) => {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  const records = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const rec = {};
    for (let j = 0; j < headers.length; j += 1) {
      rec[headers[j]] = cols[j] ?? "";
    }
    records.push(rec);
  }
  return records;
};

const streamCsv = async (filePath, onRecord) => {
  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    if (!line) continue;
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    const cols = parseCsvLine(line);
    const rec = {};
    for (let j = 0; j < headers.length; j += 1) {
      rec[headers[j]] = cols[j] ?? "";
    }
    onRecord(rec);
  }
};

const loadFromUsdaCsv = async (dirPath) => {
  const foodPath = path.join(dirPath, "food.csv");
  const nutrientPath = path.join(dirPath, "food_nutrient.csv");
  const nutrientDefPath = path.join(dirPath, "nutrient.csv");
  const portionPath = path.join(dirPath, "food_portion.csv");
  const measureUnitPath = path.join(dirPath, "measure_unit.csv");

  for (const p of [foodPath, nutrientPath, nutrientDefPath]) {
    if (!fs.existsSync(p)) {
      console.error(`Missing required USDA CSV file: ${p}`);
      process.exit(1);
    }
  }

  const nutrientDefs = readCsvRecords(nutrientDefPath);
  const nutrientIdByName = new Map();
  for (const n of nutrientDefs) {
    const id = String(n.id ?? "");
    const name = String(n.name ?? "").toLowerCase();
    const unitName = String(n.unit_name ?? "").toLowerCase();
    if (!id || !name) continue;
    nutrientIdByName.set(`${name}|${unitName}`, id);
  }
  const kcalNutrientIds = new Set();
  const proteinNutrientIds = new Set();
  const carbNutrientIds = new Set();
  const fatNutrientIds = new Set();
  for (const [key, id] of nutrientIdByName.entries()) {
    const [name, unitName] = key.split("|");
    if (name.includes("energy") && unitName === "kcal") kcalNutrientIds.add(id);
    if (name === "protein") proteinNutrientIds.add(id);
    if (name.includes("carbohydrate")) carbNutrientIds.add(id);
    if (name.includes("total lipid") || (name.includes("fat") && !name.includes("fatty acids"))) {
      fatNutrientIds.add(id);
    }
  }

  const measures = fs.existsSync(measureUnitPath) ? readCsvRecords(measureUnitPath) : [];
  const measureNameById = new Map();
  for (const m of measures) {
    measureNameById.set(String(m.id ?? ""), String(m.name ?? "").trim());
  }

  const portions = fs.existsSync(portionPath) ? readCsvRecords(portionPath) : [];
  const firstPortionByFoodId = new Map();
  for (const p of portions) {
    const foodId = String(p.fdc_id ?? p.food_id ?? "");
    if (!foodId || firstPortionByFoodId.has(foodId)) continue;
    firstPortionByFoodId.set(foodId, p);
  }

  const caloriesByFoodId = new Map();
  const proteinByFoodId = new Map();
  const carbsByFoodId = new Map();
  const fatByFoodId = new Map();
  await streamCsv(nutrientPath, (row) => {
    const foodId = String(row.fdc_id ?? row.food_id ?? "");
    const nutrientId = String(row.nutrient_id ?? "");
    const amount = toFinite(row.amount);
    if (!foodId || amount == null) return;
    if (kcalNutrientIds.has(nutrientId) && !caloriesByFoodId.has(foodId)) {
      caloriesByFoodId.set(foodId, amount);
    }
    if (proteinNutrientIds.has(nutrientId) && !proteinByFoodId.has(foodId)) {
      proteinByFoodId.set(foodId, amount);
    }
    if (carbNutrientIds.has(nutrientId) && !carbsByFoodId.has(foodId)) {
      carbsByFoodId.set(foodId, amount);
    }
    if (fatNutrientIds.has(nutrientId) && !fatByFoodId.has(foodId)) {
      fatByFoodId.set(foodId, amount);
    }
  });

  const out = [];
  const allowedTypes = new Set([
    "foundation_food",
    "sr_legacy_food",
    "survey_fndds_food",
    "fndds",
  ]);
  if (includeBranded) {
    allowedTypes.add("branded_food");
  }

  await streamCsv(foodPath, (f) => {
    const foodId = String(f.fdc_id ?? f.id ?? "");
    const name = String(f.description ?? "").trim();
    const dataType = String(f.data_type ?? "").toLowerCase().trim();
    if (!foodId || !name) return;
    if (!allowedTypes.has(dataType)) return;
    const calories = caloriesByFoodId.get(foodId) ?? null;
    const protein = proteinByFoodId.get(foodId) ?? null;
    const carbs = carbsByFoodId.get(foodId) ?? null;
    const fat = fatByFoodId.get(foodId) ?? null;
    const portion = firstPortionByFoodId.get(foodId);
    const servingGrams = toFinite(portion?.gram_weight) ?? 100;
    const unitName = (measureNameById.get(String(portion?.measure_unit_id ?? "")) ?? "g").trim();
    const amount = toFinite(portion?.amount);
    const portionDescription = String(portion?.portion_description ?? "").trim();
    const modifier = String(portion?.modifier ?? "").trim();
    const baseGramLabel = `${formatNumber(servingGrams)} g`;
    const isUndeterminedUnit =
      unitName.length === 0 ||
      unitName.toLowerCase().includes("undetermined") ||
      /^\d+$/.test(unitName);
    const hasNoisyModifier = /^\d+$/.test(modifier) || modifier.toLowerCase().includes("undetermined");
    let servingLabel = baseGramLabel;
    if (
      amount != null &&
      amount > 0 &&
      !isUndeterminedUnit
    ) {
      const descriptor =
        !hasNoisyModifier && modifier
          ? modifier
          : portionDescription && !/^\d+$/.test(portionDescription)
            ? portionDescription
            : "";
      servingLabel = `${formatNumber(amount)} ${unitName}${descriptor ? ` ${descriptor}` : ""}`.trim();
    }
    out.push({
      id: `usda-${slugify(foodId)}`,
      name,
      aliases: [],
      servingLabel,
      servingGrams,
      caloriesPer100g: calories,
      proteinPer100g: protein,
      carbsPer100g: carbs,
      fatPer100g: fat,
    });
  });
  return out;
};

let normalized = [];
const existingCore = mergeWithExisting
  ? loadExistingFoodsFromTs(path.resolve(outputDir, "foods-core.ts"), "FOODS_CORE")
  : [];
const existingRest = mergeWithExisting
  ? loadExistingFoodsFromTs(path.resolve(outputDir, "foods-rest-1.ts"), "FOODS_REST_1")
  : [];
const existingRows = mergeWithExisting ? [...existingCore, ...existingRest] : [];
const existingNameSet = new Set(existingRows.map((r) => normalizedNameKey(r.name)));

if (source === "usda-csv") {
  normalized = (await loadFromUsdaCsv(resolvedInputPath)).filter((row) => isValidRow(row) && isSaneRow(row));
} else if (source === "off-jsonl") {
  const nextRows = [];
  const uniqueNameSet = new Set(existingNameSet);
  const targetAdditional =
    Number.isFinite(maxRows) && maxRows > 0 ? Math.max(0, maxRows - existingRows.length) : Number.MAX_SAFE_INTEGER;
  let idx = 0;
  await streamJsonl(resolvedInputPath, (row) => {
    const mapped = fromOff(row, idx);
    idx += 1;
    if (!isValidRow(mapped) || !isSaneRow(mapped)) return true;
    if (isLikelyNoisyProductName(mapped.name)) return true;
    const key = normalizedNameKey(mapped.name);
    if (uniqueNameSet.has(key)) return true;
    uniqueNameSet.add(key);
    nextRows.push(mapped);
    if (nextRows.length >= targetAdditional) {
      return false;
    }
    return true;
  });
  normalized = nextRows;
} else {
  const raw = JSON.parse(fs.readFileSync(resolvedInputPath, "utf8"));
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.products) ? raw.products : [];
  if (!Array.isArray(rows)) {
    console.error("Input must be a JSON array or { products: [] }.");
    process.exit(1);
  }
  const mapper =
    source === "usda" ? fromUsda : source === "off" ? fromOff : fromNormalized;
  normalized = rows.map((row, idx) => mapper(row, idx)).filter((r) => isValidRow(r) && isSaneRow(r));
}

normalized.sort((a, b) => a.name.localeCompare(b.name));
if (mergeWithExisting) {
  normalized = [...existingRows, ...normalized];
}
// Import-time dedupe by normalized name for cleaner search corpus.
const dedupedByName = new Map();
for (const row of normalized) {
  const key = normalizedNameKey(row.name);
  const sourceTag = String(row.id ?? "").startsWith("usda-")
    ? "usda"
    : String(row.id ?? "").startsWith("off-")
      ? "off"
      : "normalized";
  const existing = dedupedByName.get(key);
  if (!existing) {
    dedupedByName.set(key, row);
  } else {
    const existingSourceTag = String(existing.id ?? "").startsWith("usda-")
      ? "usda"
      : String(existing.id ?? "").startsWith("off-")
        ? "off"
        : "normalized";
    const nextScore = qualityScore(row, sourceTag);
    const prevScore = qualityScore(existing, existingSourceTag);
    if (nextScore > prevScore) {
      dedupedByName.set(key, row);
    }
  }
}
normalized = [...dedupedByName.values()];
normalized.sort((a, b) => a.name.localeCompare(b.name));
normalized = normalized.map((row) => ({ ...row, ...deriveMetadata(row) }));
if (Number.isFinite(maxRows) && maxRows > 0 && normalized.length > maxRows) {
  const mustKeep = normalized.filter(
    (row) =>
      isMustKeepGeneric(row.name) ||
      isRequiredCanonicalName(row.name) ||
      isPriorityKeepName(row.name) ||
      isUsdaPotatoBaseKeep(row)
  );
  const restRows = normalized.filter(
    (row) =>
      !(
        isMustKeepGeneric(row.name) ||
        isRequiredCanonicalName(row.name) ||
        isPriorityKeepName(row.name) ||
        isUsdaPotatoBaseKeep(row)
      )
  );
  normalized = [...mustKeep, ...restRows].slice(0, maxRows);
}

// Final canonical guarantee pass: append required canonical rows from existing USDA load if missing.
if (requiredCanonicalNames.size > 0) {
  const existingNames = new Set(normalized.map((r) => String(r.name ?? "").toLowerCase().trim()));
  const missingRequired = [...requiredCanonicalNames].filter((n) => !existingNames.has(n));
  if (missingRequired.length > 0) {
    let usdaRowsForBackfill = [];
    if (source === "usda-csv") {
      usdaRowsForBackfill = normalized.filter((r) => String(r.id ?? "").startsWith("usda-"));
    } else if (fs.existsSync(path.resolve("./data/FoodData_Central_csv_2026-04-30/FoodData_Central_csv_2026-04-30"))) {
      usdaRowsForBackfill = (await loadFromUsdaCsv(path.resolve("./data/FoodData_Central_csv_2026-04-30/FoodData_Central_csv_2026-04-30")))
        .filter((row) => isValidRow(row) && isSaneRow(row));
    }
    const byName = new Map(usdaRowsForBackfill.map((r) => [String(r.name ?? "").toLowerCase().trim(), r]));
    const additions = [];
    for (const name of missingRequired) {
      const row = byName.get(name);
      if (row) additions.push(row);
    }
    if (additions.length > 0) {
      const cur = new Map(normalized.map((r) => [String(r.name ?? "").toLowerCase().trim(), r]));
      for (const row of additions) cur.set(String(row.name ?? "").toLowerCase().trim(), row);
      normalized = [...cur.values()];
      normalized.sort((a, b) => a.name.localeCompare(b.name));
      if (Number.isFinite(maxRows) && maxRows > 0 && normalized.length > maxRows) {
        const mustKeep = normalized.filter(
          (row) =>
            isMustKeepGeneric(row.name) ||
            isRequiredCanonicalName(row.name) ||
            isPriorityKeepName(row.name) ||
            isUsdaPotatoBaseKeep(row)
        );
        const restRows = normalized.filter(
          (row) =>
            !(
              isMustKeepGeneric(row.name) ||
              isRequiredCanonicalName(row.name) ||
              isPriorityKeepName(row.name) ||
              isUsdaPotatoBaseKeep(row)
            )
        );
        normalized = [...mustKeep, ...restRows].slice(0, maxRows);
      }
    }
  }
}

fs.mkdirSync(path.resolve(outputDir), { recursive: true });
const assetOutputDir = path.resolve("./assets/nutrition-data");
fs.mkdirSync(assetOutputDir, { recursive: true });

const coreSize = Math.min(200, normalized.length);
const core = normalized.slice(0, coreSize);
const rest = normalized.slice(coreSize);

const writeBlob = (filePath, data) => {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const STOP_TOKENS = new Set([
  "and",
  "with",
  "for",
  "the",
  "from",
  "into",
  "fresh",
  "style",
  "food",
  "foods",
  "brand",
  "original",
  "natural",
]);

const normalizeToken = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (text) =>
  normalizeToken(text)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t.length <= 24 && !STOP_TOKENS.has(t));

const buildSearchIndex = (rows, coreCount, restChunkSize) => {
  const tokenIndex = new Map();
  const prefixIndex = new Map();
  const idToChunk = {};
  const pushUnique = (map, key, id) => {
    if (!key) return;
    const arr = map.get(key);
    if (!arr) {
      map.set(key, [id]);
      return;
    }
    if (arr[arr.length - 1] !== id && !arr.includes(id)) arr.push(id);
  };

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const id = String(row.id ?? "");
    if (!id) continue;
    if (idx < coreCount) {
      idToChunk[id] = 0;
    } else {
      idToChunk[id] = Math.floor((idx - coreCount) / restChunkSize) + 1;
    }
    const tokenSet = new Set([
      ...tokenize(row.name),
    ]);

    let count = 0;
    for (const token of tokenSet) {
      pushUnique(tokenIndex, token, id);
      pushUnique(prefixIndex, token.slice(0, 3), id);
      count += 1;
      if (count >= 18) break;
    }
  }

  const scoreForToken = (name, token) => {
    const n = normalizeToken(name);
    let s = 0;
    if (n === token) s += 1200;
    if (n.startsWith(token)) s += 700;
    if (n.endsWith(` ${token}`)) s += 680;
    if (new RegExp(`\\b${token}\\b`).test(n)) s += 420;
    if (n.includes(`${token}, raw`) || n.includes(`${token} raw`)) s += 600;
    if (n.includes(token)) s += 180;
    if (n.includes("cherries, raw")) s += 500;
    if (
      n.includes("premium") ||
      n.includes("style") ||
      n.includes("pie") ||
      n.includes("cola") ||
      n.includes("frosted") ||
      n.includes("strudel")
    ) s -= 180;
    return s;
  };

  const nameById = new Map(rows.map((r) => [r.id, r.name]));

  const compress = (map, cap) => {
    const out = {};
    for (const [k, arr] of map.entries()) {
      const dedup = new Map();
      for (const id of arr) {
        const next = scoreForToken(
          nameById.get(id) ?? "",
          k
        );
        const prev = dedup.get(id);
        if (prev == null || next > prev) dedup.set(id, next);
      }
      out[k] = [...dedup.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, cap)
        .map(([id]) => id);
    }
    return out;
  };

  return {
    FOOD_TOKEN_INDEX: compress(tokenIndex, 240),
    FOOD_PREFIX_INDEX: compress(prefixIndex, 320),
    FOOD_ID_TO_CHUNK: idToChunk,
  };
};

const buildSearchIndexBlob = (rows, coreCount, restChunkSize) => {
  const built = buildSearchIndex(rows, coreCount, restChunkSize);
  return built;
};

writeBlob(path.resolve(assetOutputDir, "foods-core.blob"), core);
const assetManifestEntries = [];
for (let i = 0; i < rest.length; i += chunkSize) {
  const chunk = rest.slice(i, i + chunkSize);
  const chunkNumber = Math.floor(i / chunkSize) + 1;
  const assetFileName = `foods-rest-${chunkNumber}.blob`;
  writeBlob(path.resolve(assetOutputDir, assetFileName), chunk);
  assetManifestEntries.push(
    `  ${chunkNumber}: require("../../../assets/nutrition-data/${assetFileName}")`
  );
}
writeBlob(
  path.resolve(assetOutputDir, "foods-search-index.blob"),
  buildSearchIndexBlob(normalized, coreSize, chunkSize)
);

const manifestContent = `/* eslint-disable @typescript-eslint/no-require-imports */
export const FOOD_CORE_ASSET = require("../../../assets/nutrition-data/foods-core.blob");
export const FOOD_SEARCH_INDEX_ASSET = require("../../../assets/nutrition-data/foods-search-index.blob");
export const FOOD_REST_ASSETS: Record<number, number> = {
${assetManifestEntries.join(",\n")}
};
`;
fs.writeFileSync(path.resolve(outputDir, "foodsAssetManifest.ts"), manifestContent, "utf8");

console.log(
  `[${source}] Imported ${normalized.length} foods (after cap). Core=${core.length}, rest chunks=${Math.ceil(
    rest.length / chunkSize
  )}`
);
