/* global __dirname */
const fs = require("node:fs");
const path = require("node:path");
const canonical = path.resolve(
  __dirname,
  "../../src/sharing/sharingContract.ts",
);
const output = path.resolve(__dirname, "../src/workoutSharingContract.ts");
const header =
  "// Generated from src/sharing/sharingContract.ts. Run npm --prefix functions run build.\n";
if (fs.existsSync(canonical)) {
  const generated = header + fs.readFileSync(canonical, "utf8");
  if (process.argv.includes("--check")) {
    if (
      fs.readFileSync(output, "utf8").replaceAll("\r\n", "\n") !==
      generated.replaceAll("\r\n", "\n")
    )
      throw Error("Sharing contracts differ. Rebuild functions.");
  } else fs.writeFileSync(output, generated);
} else {
  // Cloud Functions receives the prepared server source, without the native app tree.
  if (
    !fs.existsSync(output) ||
    !fs.readFileSync(output, "utf8").startsWith(header)
  )
    throw Error("The prepared sharing contract is missing.");
}
