const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const extraArgs = process.argv.slice(2);
const hasClear = extraArgs.includes("--clear");
const fastMode = extraArgs.includes("--fast");

const localWatchmanBin = path.resolve(process.cwd(), ".dev-tools", "watchman", "bin");
const hasLocalWatchman = fs.existsSync(path.join(localWatchmanBin, "watchman.exe"));

const env = {
  ...process.env,
  APP_VARIANT: "dev",
  EXPO_NO_DEPENDENCY_VALIDATION: "1",
  EXPO_NO_TELEMETRY: "1",
  // Android's adb reverse forwards 127.0.0.1. Keep Metro on IPv4 localhost.
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --dns-result-order=ipv4first`.trim(),
  PATH: hasLocalWatchman
    ? `${localWatchmanBin};${process.env.PATH ?? ""}`
    : process.env.PATH,
};

// The dev client uses localhost. Map the phone's port 8081 to Metro on this PC.
const adbReverse = spawnSync("adb", ["reverse", "tcp:8081", "tcp:8081"], {
  stdio: "inherit",
  env,
});

if (adbReverse.error || adbReverse.status !== 0) {
  throw new Error(
    "Could not map the Android device to Metro. Connect an authorized device by USB, then run the command again."
  );
}

const args = [
  "start",
  "--dev-client",
  "--scheme",
  "lastrep-dev",
  "--localhost",
  "--max-workers",
  "4",
];

if (hasClear) args.push("--clear");
if (fastMode) args.push("--no-dev", "--minify");

const expoCliPath = ".\\node_modules\\.bin\\expo.cmd";
const child = spawn("cmd.exe", ["/d", "/s", "/c", `${expoCliPath} ${args.join(" ")}`], {
  stdio: "inherit",
  windowsVerbatimArguments: false,
  env,
});

child.on("exit", (exitCode, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(exitCode ?? 1);
});
