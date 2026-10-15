# Nutrition DB Offline Import

This app uses an offline structured food database for Nutrition search and conversion.

## Supported input sources

- `normalized` (default): already mapped rows
- `usda`: USDA-style export rows
- `usda-csv`: USDA full CSV folder (e.g. `FoodData_Central_csv_YYYY-MM-DD`)
- `off`: OpenFoodFacts JSON export (`[]` or `{ products: [] }`)
- `off-jsonl`: OpenFoodFacts JSONL / JSONL.GZ export

## Command

```bash
npm run import:food-db -- --source <normalized|usda|usda-csv|off|off-jsonl> --in <path> --out ./src/nutrition/data --chunk 500 --max 50000
```

Examples:

```bash
npm run import:food-db -- --source usda --in ./data/usda-foods.json
npm run import:food-db -- --source off --in ./data/openfoodfacts-products.json
npm run import:food-db -- --source usda-csv --in ./data/usda_csv_2025-12-18/FoodData_Central_csv_2025-12-18 --out ./src/nutrition/data --chunk 12000 --max 12200
npm run import:food-db -- --source off-jsonl --in ./data/openfoodfacts-products.jsonl.gz --out ./src/nutrition/data --chunk 12000 --max 20000 --merge-existing true
```

Optional flags:

- `--max <n>`: cap final dataset size
- `--chunk <n>`: size per `foods-rest-*` output chunk
- `--merge-existing true`: merge new source with existing generated files before dedupe
- `--include-branded true`: include USDA `branded_food` rows (default: `false`)

## Output

- `assets/nutrition-data/foods-core.blob`
- `assets/nutrition-data/foods-rest-*.blob`
- `assets/nutrition-data/foods-search-catalog.blob`
- `src/nutrition/data/foodsAssetManifest.ts`

Current runtime note:

- App search examines the lightweight name/alias catalog, then loads matching
  chunks through the asset manifest. It does not parse the raw source CSV files.
- Food-ID hydration uses this catalog's actual chunk locations, not the older
  capped token/prefix index, which can be out of sync with packaged chunks.
- `--merge-existing true` reads all current blob chunks in numeric order rather
  than only the obsolete TS core/rest-1 files. It rejects a `--max` below the
  current corpus size. Choose a limit with room for additional rows; full corpus
  regeneration/deduplication must still be reviewed before shipping its assets.
- `foods-generic.blob` is a separately generated, bounded supplement of USDA
  Foundation/SR Legacy reference foods. Existing packaged IDs always take
  precedence, preserving old nutrition and serving definitions.

## Generic reference supplement

```bash
node scripts/build-generic-foods.mjs --in ./data/FoodData_Central_csv_2026-04-30/FoodData_Central_csv_2026-04-30
```

This streams local `food.csv`, `food_nutrient.csv` and `nutrient.csv`; it makes no
network requests and does not bundle raw source files. It selects up to 40
distinct descriptions per configured food family rather than taking the first
alphabetical portion of the entire source. Breast and brown-rice variants have
their own families to avoid being crowded out by other cuts/grains.

Nutrient IDs and units are checked against the source definitions. Energy is
selected from 2048 (specific Atwater), then 2047 (general Atwater), then 1008
(kcal). Protein 1003, total fat 1004 and carbohydrate 1005 are grams per 100 g.
Missing, negative or impossible required values are rejected. Serving size is
explicitly 100 g rather than an inferred cup/portion. Values are not guessed or
converted from a branded product to a generic food.

The current supplement contains 783 source records. Records whose IDs already
exist in the packaged dataset are not substituted at runtime.

Coverage is not exhaustive. A brand absent from the packaged corpus may still
be available via the separate Open Food Facts barcode lookup. Unknown searches
return no match rather than unrelated filler. Korean packaged-food coverage is
not promised by this batch.

The Nutrition page continues to use the same UI and logic:
- search by food
- entry by grams/servings/calories
- auto-conversion for calories and protein

## Required normalized fields

The importer outputs this schema:

- `id: string`
- `name: string`
- `aliases: string[]`
- `servingLabel: string`
- `servingGrams: number`
- `caloriesPer100g: number`
- `proteinPer100g: number`

Rows missing required numeric nutrition values are filtered out.
Import also applies basic curation + name dedupe to reduce noisy/duplicate entries.
