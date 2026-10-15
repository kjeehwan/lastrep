import fs from "node:fs";
import path from "node:path";

/** Read the current blob corpus, not the obsolete TS-only core/rest-1 layout. */
export function readPackagedFoods(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = fs.readdirSync(directory).filter((file) => /^foods-(core|rest-\d+)\.blob$/.test(file));
  files.sort((a, b) => (a === "foods-core.blob" ? 0 : Number(a.match(/\d+/)[0])) -
    (b === "foods-core.blob" ? 0 : Number(b.match(/\d+/)[0])));
  return files.flatMap((file) => {
    const rows = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
    if (!Array.isArray(rows)) throw new Error(`Invalid food array in ${file}`);
    return rows;
  });
}
