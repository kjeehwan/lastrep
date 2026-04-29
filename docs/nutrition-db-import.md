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

- `src/nutrition/data/foods-core.ts`
- `src/nutrition/data/foods-rest-*.ts`

Current runtime note:

- App search currently loads `foods-core` + `foods-rest-1` only for performance.
- If more chunks are generated, they are not used until search loader is updated.

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
