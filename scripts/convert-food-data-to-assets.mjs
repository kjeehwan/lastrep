#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "src", "nutrition", "data");
const assetDir = path.join(projectRoot, "assets", "nutrition-data");
const manifestPath = path.join(sourceDir, "foodsAssetManifest.ts");

const readFile = (filePath) => fs.readFileSync(filePath, "utf8");

const extractExportJson = (content, exportName) => {
  const startToken = `export const ${exportName}`;
  const startIndex = content.indexOf(startToken);
  if (startIndex === -1) {
    throw new Error(`Could not find export ${exportName}`);
  }
  const equalsIndex = content.indexOf("=", startIndex);
  if (equalsIndex === -1) {
    throw new Error(`Could not find assignment for export ${exportName}`);
  }
  const valueStart = equalsIndex + 1;
  const firstBraceIndex = content.indexOf("{", valueStart);
  const firstBracketIndex = content.indexOf("[", valueStart);
  const hasBrace =
    firstBraceIndex !== -1 && (firstBracketIndex === -1 || firstBraceIndex < firstBracketIndex);
  const openChar = hasBrace ? "{" : "[";
  const closeChar = hasBrace ? "}" : "]";
  const openIndex = hasBrace ? firstBraceIndex : firstBracketIndex;
  if (openIndex === -1) {
    throw new Error(`Could not find JSON start for export ${exportName}`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = openIndex; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return content.slice(openIndex, index + 1).trim();
      }
    }
  }

  throw new Error(`Could not find terminating JSON block for export ${exportName}`);
};

const coreContent = readFile(path.join(sourceDir, "foods-core.ts"));
const coreJson = extractExportJson(coreContent, "FOODS_CORE");

const searchIndexContent = readFile(path.join(sourceDir, "foods-search-index.ts"));
const tokenIndexJson = extractExportJson(searchIndexContent, "FOOD_TOKEN_INDEX");
const prefixIndexJson = extractExportJson(searchIndexContent, "FOOD_PREFIX_INDEX");
const idToChunkJson = extractExportJson(searchIndexContent, "FOOD_ID_TO_CHUNK");
const combinedSearchIndexJson = `{
  "FOOD_TOKEN_INDEX": ${tokenIndexJson},
  "FOOD_PREFIX_INDEX": ${prefixIndexJson},
  "FOOD_ID_TO_CHUNK": ${idToChunkJson}
}
`;

const restFiles = fs
  .readdirSync(sourceDir)
  .filter((name) => /^foods-rest-\d+\.ts$/.test(name))
  .sort((a, b) => {
    const aNum = Number(a.match(/\d+/)?.[0] ?? "0");
    const bNum = Number(b.match(/\d+/)?.[0] ?? "0");
    return aNum - bNum;
  });

fs.mkdirSync(assetDir, { recursive: true });

fs.writeFileSync(path.join(assetDir, "foods-core.blob"), `${coreJson}\n`, "utf8");
fs.writeFileSync(path.join(assetDir, "foods-search-index.blob"), combinedSearchIndexJson, "utf8");

const restAssetEntries = [];

for (const fileName of restFiles) {
  const chunkNumber = Number(fileName.match(/\d+/)?.[0] ?? "0");
  const exportName = `FOODS_REST_${chunkNumber}`;
  const rowsJson = extractExportJson(readFile(path.join(sourceDir, fileName)), exportName);
  const assetFileName = `foods-rest-${chunkNumber}.blob`;
  fs.writeFileSync(path.join(assetDir, assetFileName), `${rowsJson}\n`, "utf8");
  restAssetEntries.push(
    `  ${chunkNumber}: require("../../../assets/nutrition-data/${assetFileName}")`
  );
}

const manifest = `export const FOOD_CORE_ASSET = require("../../../assets/nutrition-data/foods-core.blob");
export const FOOD_SEARCH_INDEX_ASSET = require("../../../assets/nutrition-data/foods-search-index.blob");
export const FOOD_REST_ASSETS: Record<number, number> = {
${restAssetEntries.join(",\n")}
};
`;

fs.writeFileSync(manifestPath, manifest, "utf8");

console.log(`Wrote nutrition assets to ${assetDir}`);
console.log(`Updated manifest ${manifestPath}`);
