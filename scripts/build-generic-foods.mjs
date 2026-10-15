import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const input = process.argv[process.argv.indexOf("--in") + 1];
if (!process.argv.includes("--in") || !input) throw new Error("Pass --in <USDA CSV directory>");

function parseCsv(line) {
  const columns = []; let value = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { columns.push(value); value = ""; }
    else value += char;
  }
  columns.push(value); return columns;
}
async function scanCsv(file, visit) {
  const lines = readline.createInterface({ input: fs.createReadStream(path.join(input, file), { encoding: "utf8" }), crlfDelay: Infinity });
  let headers;
  for await (const line of lines) {
    if (!line) continue;
    if (!headers) { headers = parseCsv(line); continue; }
    visit(Object.fromEntries(parseCsv(line).map((value, index) => [headers[index], value])));
  }
}

// Bound the supplement by food family rather than alphabetically truncating the
// complete USDA corpus. Existing packaged records are never rewritten.
const families = [
  /\b(oats|oatmeal)\b/i, /^rice, brown/i, /^rice,/i, /^chicken,.*breast/i, /^chicken,/i, /^turkey,/i,
  /^egg,/i, /^yogurt,/i, /^milk,/i, /^beverages,.*(?:almond|soy|oat|rice)/i, /^almond milk/i, /^cheese,/i, /^bread,/i,
  /^pasta,/i, /^spaghetti,/i, /^potatoes,/i, /^sweet potato/i,
  /^fish, salmon/i, /^fish, tuna/i, /^beef,/i, /^pork,/i,
  /^tofu/i, /^lentils,/i, /^chickpeas/i, /^beans,/i,
  /^oil, olive/i, /^peanut butter/i, /^nuts, almonds/i,
  /^bananas,/i, /^apples,/i, /^cherries,/i, /^oranges,/i,
  /^strawberries,/i, /^blueberries,/i, /^avocados,/i,
  /^broccoli,/i, /^carrots,/i, /^spinach,/i, /^onions,/i,
  /^tomatoes,/i, /^mushrooms,/i, /^cucumber/i, /^peppers,/i,
];
const pools = families.map(() => []);
await scanCsv("food.csv", (row) => {
  if (!["sr_legacy_food", "foundation_food"].includes(row.data_type)) return;
  if (/\b(babyfood|infant|sandwich|casserole|dinner|sauce|with|breaded|battered)\b/i.test(row.description)) return;
  const index = families.findIndex((pattern) => pattern.test(row.description));
  if (index >= 0) pools[index].push(row);
});
const selected = new Map();
for (const pool of pools) {
  pool.sort((a, b) => a.description.length - b.description.length || a.description.localeCompare(b.description) || Number(a.fdc_id) - Number(b.fdc_id));
  const names = new Set();
  for (const row of pool) {
    if (names.has(row.description.toLowerCase())) continue;
    names.add(row.description.toLowerCase()); selected.set(row.fdc_id, row);
    if (names.size >= 40) break;
  }
}
console.log(`Selected ${selected.size} generic USDA candidates; scanning nutrient values...`);
const nutrients = new Map();
const allowed = new Set(["1008", "2047", "2048", "1003", "1004", "1005"]);
const definitions = new Map();
await scanCsv("nutrient.csv", (row) => { if (allowed.has(row.id)) definitions.set(row.id, row); });
for (const id of allowed) {
  const definition = definitions.get(id);
  const expectedUnit = ["1008", "2047", "2048"].includes(id) ? "KCAL" : "G";
  if (!definition || definition.unit_name.toUpperCase() !== expectedUnit) throw new Error(`Unexpected USDA nutrient definition for ${id}`);
}
await scanCsv("food_nutrient.csv", (row) => {
  if (!selected.has(row.fdc_id) || !allowed.has(row.nutrient_id) || !row.amount.trim()) return;
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount < 0) return;
  if (!nutrients.has(row.fdc_id)) nutrients.set(row.fdc_id, {});
  nutrients.get(row.fdc_id)[row.nutrient_id] ??= amount;
});
const output = [];
for (const [id, row] of selected) {
  const values = nutrients.get(id) ?? {};
  const kcal = values["2048"] ?? values["2047"] ?? values["1008"];
  const [protein, fat, carbs] = [values["1003"], values["1004"], values["1005"]];
  if (![kcal, protein, fat, carbs].every(Number.isFinite) || kcal <= 0 || kcal > 900 || Math.max(protein, fat, carbs) > 100 || protein + fat + carbs > 110) continue;
  output.push({ id: `usda-${id}`, name: row.description, aliases: [], servingLabel: "100 g", servingGrams: 100,
    caloriesPer100g: kcal, proteinPer100g: protein, carbsPer100g: carbs, fatPer100g: fat,
    sourceType: "usda-generic" });
}
output.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync("assets/nutrition-data/foods-generic.blob", JSON.stringify(output));
console.log(`Wrote ${output.length} verified generic foods, all values per 100 g; no existing assets changed.`);
