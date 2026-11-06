const { readdirSync, readFileSync, mkdtempSync, rmSync, rmdirSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { spawnSync } = require("node:child_process");

// Refuse accidental execution against production or without both local services.
for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[key] || "")) {
    throw new Error(`${key} must point to a local emulator.`);
  }
}
if (!(process.env.GCLOUD_PROJECT || "").startsWith("demo-")) {
  throw new Error("GCLOUD_PROJECT must identify a disposable demo- project.");
}

function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? discover(path)
      : /\.(emulator|integration)\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}
const suites = ["src/firestore.rules.test.ts", "src/storage.rules.test.ts",
  ...discover("src"), ...discover("functions/src")].sort();
const required = ["src/sleep/sleepJournal.integration.test.ts",
  "src/workouts/programStore.emulator.test.ts", "functions/src/workoutSharing.emulator.test.ts",
  "functions/src/programSharing.emulator.test.ts", "functions/src/sharingRetention.emulator.test.ts"];
for (const suite of required) {
  if (!suites.includes(suite)) throw new Error(`Required suite missing: ${suite}`);
}
const directory = mkdtempSync(join(tmpdir(), "lastrep-firebase-tests-"));
const report = join(directory, "results.json");
try {
  const run = spawnSync(process.execPath, [resolve("node_modules/vitest/vitest.mjs"),
    "run", ...suites, "--reporter=default", "--reporter=json", `--outputFile.json=${report}`],
  { stdio: "inherit", env: process.env });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`Firebase integration tests failed (${run.status}).`);
  const result = JSON.parse(readFileSync(report, "utf8"));
  if (result.numPendingTests || result.numTodoTests || !result.numPassedTests) {
    throw new Error("Firebase integration gate requires executed tests with no skips/todos.");
  }
  for (const suite of suites) {
    const file = result.testResults.find(file => resolve(file.name) === resolve(suite));
    if (!file || !file.assertionResults.length || file.assertionResults.some(test => test.status !== "passed")) {
      throw new Error(`Suite did not fully execute: ${suite}`);
    }
  }
  console.log(`Firebase boundary gate: ${suites.length} files, ${result.numPassedTests} tests, no skips.`);
} finally {
  // Only this invocation's newly-created report directory is removed.
  rmSync(report, { force: true });
  rmdirSync(directory);
}
