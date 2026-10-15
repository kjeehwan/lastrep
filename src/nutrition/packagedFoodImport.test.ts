import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
