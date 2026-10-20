import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

// The importer is a Node ESM script, not app runtime code.
import { readPackagedFoods } from "../../scripts/read-packaged-foods.mjs";

it("merges every packaged chunk in numeric order, without index or generic blobs", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lastrep-food-import-"));
  const entries = { "foods-core.blob": [{ id: "core" }], "foods-rest-10.blob": [{ id: "ten" }], "foods-rest-2.blob": [{ id: "two" }],
    "foods-search-index.blob": {}, "foods-generic.blob": [{ id: "separate" }] };
  try {
    for (const [file, data] of Object.entries(entries)) fs.writeFileSync(path.join(directory, file), JSON.stringify(data));
    expect(readPackagedFoods(directory)).toEqual([{ id: "core" }, { id: "two" }, { id: "ten" }]);
  } finally {
    for (const file of Object.keys(entries)) fs.unlinkSync(path.join(directory, file));
    fs.rmdirSync(directory);
  }
});

it("retains source brand fields separately from categories through a real isolated import", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lastrep-food-brands-"));
  const input = path.join(directory, "source.json");
  const output = path.join(directory, "output");
  fs.writeFileSync(input, JSON.stringify([{ code: "12345678", product_name: "Oat cereal", brands: "Fixture Brand", categories_tags: ["en:breakfast-cereals"], nutriments: { "energy-kcal_100g": 400, proteins_100g: 10, carbohydrates_100g: 70, fat_100g: 8 }, serving_size: "40 g" }]));
  try {
    execFileSync(process.execPath, [path.resolve("scripts/import-food-db.mjs"), "--source", "off", "--in", input, "--out", output, "--include-branded", "true"], { cwd: directory, stdio: "pipe" });
    const [food] = JSON.parse(fs.readFileSync(path.join(directory, "assets/nutrition-data/foods-core.blob"), "utf8"));
    expect(food.brandNames).toEqual(["Fixture Brand"]);
    expect(food.aliases).toContain("en:breakfast-cereals");
    const [candidate] = JSON.parse(fs.readFileSync(path.join(directory, "assets/nutrition-data/foods-search-catalog.blob"), "utf8"));
    expect(candidate[2]).toContain("fixture brand");
  } finally {
    if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith("lastrep-food-brands-")) throw new Error("Unexpected import test cleanup path");
    fs.rmSync(directory, { recursive: true });
  }
});
