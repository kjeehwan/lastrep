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
  for (const [key, id] of nutrientIdByName.entries()) {
    const [name, unitName] = key.split("|");
    if (name.includes("energy") && unitName === "kcal") kcalNutrientIds.add(id);
    if (name === "protein") proteinNutrientIds.add(id);
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
const existingNameSet = new Set(existingRows.map((r) => String(r.name ?? "").toLowerCase().trim()));

if (source === "usda-csv") {
  normalized = (await loadFromUsdaCsv(resolvedInputPath)).filter(isValidRow);
} else if (source === "off-jsonl") {
  const nextRows = [];
  const uniqueNameSet = new Set(existingNameSet);
  const targetAdditional =
    Number.isFinite(maxRows) && maxRows > 0 ? Math.max(0, maxRows - existingRows.length) : Number.MAX_SAFE_INTEGER;
  let idx = 0;
  await streamJsonl(resolvedInputPath, (row) => {
    const mapped = fromOff(row, idx);
    idx += 1;
    if (!isValidRow(mapped)) return true;
    if (isLikelyNoisyProductName(mapped.name)) return true;
    const key = mapped.name.toLowerCase().trim();
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
  normalized = rows.map((row, idx) => mapper(row, idx)).filter(isValidRow);
}

normalized.sort((a, b) => a.name.localeCompare(b.name));
if (mergeWithExisting) {
  normalized = [...existingRows, ...normalized];
}
// Import-time dedupe by normalized name for cleaner search corpus.
const dedupedByName = new Map();
for (const row of normalized) {
  const key = String(row.name).toLowerCase().trim();
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
if (Number.isFinite(maxRows) && maxRows > 0 && normalized.length > maxRows) {
  normalized = normalized.slice(0, maxRows);
}

fs.mkdirSync(path.resolve(outputDir), { recursive: true });

const coreSize = Math.min(200, normalized.length);
const core = normalized.slice(0, coreSize);
const rest = normalized.slice(coreSize);

const writeTs = (filePath, exportName, dataRows) => {
  const content =
    `import type { FoodItem } from "../foodDb";\n\n` +
    `export const ${exportName}: FoodItem[] = ${JSON.stringify(dataRows, null, 2)};\n`;
  fs.writeFileSync(filePath, content, "utf8");
};

writeTs(path.resolve(outputDir, "foods-core.ts"), "FOODS_CORE", core);
for (let i = 0; i < rest.length; i += chunkSize) {
  const chunk = rest.slice(i, i + chunkSize);
  const chunkNumber = Math.floor(i / chunkSize) + 1;
  writeTs(path.resolve(outputDir, `foods-rest-${chunkNumber}.ts`), `FOODS_REST_${chunkNumber}`, chunk);
}

console.log(
  `[${source}] Imported ${normalized.length} foods (after cap). Core=${core.length}, rest chunks=${Math.ceil(
    rest.length / chunkSize
  )}`
);
