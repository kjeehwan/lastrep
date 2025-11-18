const fs = require("fs");
const path = require("path");

const tslibPath = path.join(__dirname, "..", "node_modules", "tslib", "tslib.js");

try {
  let content = fs.readFileSync(tslibPath, "utf8");
  if (!content.includes("module.exports.default")) {
    content += "\n// Ensure default export for tslib consumers expecting tslib.default\nmodule.exports.default = module.exports;\n";
    fs.writeFileSync(tslibPath, content, "utf8");
    console.log("Patched tslib to add default export.");
  } else {
    console.log("tslib already patched.");
  }
} catch (err) {
  console.error("Failed to patch tslib:", err.message);
  process.exitCode = 1;
}
