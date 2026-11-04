const fs = require("node:fs"), path = require("node:path");
const source = path.resolve(__dirname, "../../hosting/workout-sharing/index.html");
const output = path.resolve(__dirname, "../src/sharingPageTemplate.ts");
const header = "// Generated from hosting/workout-sharing/index.html by the functions build.\n";
if (fs.existsSync(source)) fs.writeFileSync(output, header + "export const sharingPageTemplate = " + JSON.stringify(fs.readFileSync(source, "utf8").replaceAll("\r\n", "\n")) + ";\n");
else if (!fs.existsSync(output) || !fs.readFileSync(output, "utf8").startsWith(header)) throw Error("Prepared sharing page is missing.");
