import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Derive complete name/alias candidates without changing dataset order or deduplication. */
export function buildFoodSearchCatalog(directory) {
  const files = ["foods-core.blob", ...fs.readdirSync(directory)
    .filter((file) => /^foods-rest-\d+\.blob$/.test(file))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))];
  const seen = new Set();
  const catalog = [];
  for (const file of files) {
    for (const food of JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))) {
      const name = food.name.toLowerCase().trim();
      if (seen.has(name)) continue;
      seen.add(name);
      const chunk = file === "foods-core.blob" ? 0 : Number(file.match(/\d+/)[0]);
      catalog.push([food.id, name, (food.aliases ?? []).join(" ").toLowerCase().trim(), chunk]);
    }
  }
  fs.writeFileSync(path.join(directory, "foods-search-catalog.blob"), JSON.stringify(catalog));
  return catalog.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/nutrition-data");
  console.log(`Built search catalog: ${buildFoodSearchCatalog(directory)} unique foods`);
}
