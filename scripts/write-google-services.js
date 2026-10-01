const fs = require("fs");
const path = require("path");

const variant = process.env.APP_VARIANT === "dev" ? "dev" : "prod";
const primaryVar = variant === "dev" ? "GOOGLE_SERVICES_JSON_DEV" : "GOOGLE_SERVICES_JSON_PROD";
const fallbackVar = "GOOGLE_SERVICES_JSON";

const rawValue = process.env[primaryVar] || process.env[fallbackVar];
if (!rawValue) {
  console.error(`Missing Google services env var. Expected ${primaryVar}${fallbackVar ? ` or ${fallbackVar}` : ""}.`);
  process.exit(1);
}

const resolveJsonContent = (value) => {
  const trimmed = value.trim();

  // File env vars in EAS commonly resolve to a temp file path.
  if (fs.existsSync(trimmed) && fs.statSync(trimmed).isFile()) {
    return fs.readFileSync(trimmed, "utf8");
  }

  // Plain JSON content (legacy/plain-text var case)
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  // Last-resort: local file path in repo
  const candidate = path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return fs.readFileSync(candidate, "utf8");
  }

  throw new Error(
    `Unable to resolve Google services JSON from ${primaryVar}. Value is neither a file path nor JSON content.`
  );
};

const jsonContent = resolveJsonContent(rawValue);
const parsed = JSON.parse(jsonContent);
if (!parsed?.project_info || !Array.isArray(parsed?.client)) {
  throw new Error("Resolved Google services content is not a valid google-services.json payload.");
}

const rootOutput = path.resolve(process.cwd(), "google-services.json");
const androidOutput = path.resolve(process.cwd(), "android", "app", "google-services.json");

fs.writeFileSync(rootOutput, jsonContent, "utf8");
fs.mkdirSync(path.dirname(androidOutput), { recursive: true });
fs.writeFileSync(androidOutput, jsonContent, "utf8");

console.log(`google-services.json prepared for variant=${variant}`);
console.log(`- ${rootOutput}`);
console.log(`- ${androidOutput}`);
