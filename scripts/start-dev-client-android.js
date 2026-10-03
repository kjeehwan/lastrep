const { spawn } = require("child_process");
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

// Start Metro before forwarding localhost. A dev client retrying an old bundle URL can
// otherwise leave `adb reverse` waiting before Metro has bound port 8081.
setTimeout(() => {
  const adbReverse = spawn("adb", ["reverse", "tcp:8081", "tcp:8081"], {
    stdio: "inherit",
    env,
  });
  const timeout = setTimeout(() => {
    adbReverse.kill();
    console.warn("ADB port forwarding timed out. Reconnect and authorize the Android device, then run: adb reverse tcp:8081 tcp:8081");
  }, 8000);

  adbReverse.on("exit", (exitCode) => {
    clearTimeout(timeout);
    if (exitCode !== 0) {
      console.warn("ADB port forwarding failed. Metro is still running; reconnect the Android device and run: adb reverse tcp:8081 tcp:8081");
    }
  });
}, 1000);
