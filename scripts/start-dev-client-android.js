const { spawn } = require("child_process");

const extraArgs = process.argv.slice(2);
const hasClear = extraArgs.includes("--clear");
const shouldOpen = extraArgs.includes("--open");
const fastMode = extraArgs.includes("--fast");

const env = {
  ...process.env,
  APP_VARIANT: "dev",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runPowerShellJson = async (script) =>
  new Promise((resolve) => {
    let stdout = "";
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", script],
      {
        stdio: ["ignore", "pipe", "ignore"],
        windowsVerbatimArguments: false,
        env,
      }
    );
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("exit", () => {
      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(trimmed));
      } catch {
        resolve(null);
      }
    });
    child.on("error", () => resolve(null));
  });

const isPortFree = async (port) => {
  const result = await runPowerShellJson(
    "$conn = Get-NetTCPConnection -LocalPort " +
      String(port) +
      " -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;" +
      "if ($conn) { '{\"busy\":true}' } else { '{\"busy\":false}' }"
  );
  return !result || result.busy !== true;
};

const resolveExpoPort = async () => {
  const preferredPorts = [8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089, 8090];
  for (const port of preferredPorts) {
    if (await isPortFree(port)) return port;
  }
  throw new Error("Unable to find a free Metro port between 8081 and 8090.");
};

const waitForMetro = async (port, attempts = 60, delayMs = 1000) => {
  for (let index = 0; index < attempts; index += 1) {
    const probe = spawn(
      "powershell.exe",
      [
        "-Command",
        "$ProgressPreference='SilentlyContinue';" +
          "try {" +
          "  $response = Invoke-WebRequest -Uri 'http://127.0.0.1:" +
          String(port) +
          "/status' -UseBasicParsing -TimeoutSec 2;" +
          "  if ($response.Content -match 'packager-status:running') { exit 0 }" +
          "  exit 1" +
          "} catch { exit 1 }",
      ],
      {
      stdio: "ignore",
      windowsVerbatimArguments: false,
      env,
      }
    );

    const exitCode = await new Promise((resolve) => {
      probe.on("exit", (code) => resolve(code ?? 1));
      probe.on("error", () => resolve(1));
    });

    if (exitCode === 0) {
      return true;
    }

    await sleep(delayMs);
  }

  return false;
};

const prewarmAndroidBundle = async (port, attempts = 90, delayMs = 1000) => {
  for (let index = 0; index < attempts; index += 1) {
    const probe = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "$ProgressPreference='SilentlyContinue';" +
          "try {" +
          "  $response = Invoke-WebRequest -Uri 'http://127.0.0.1:" +
          String(port) +
          "/index.bundle?platform=android&dev=true&minify=false' -UseBasicParsing -TimeoutSec 15;" +
          "  if ($response.StatusCode -eq 200 -and $response.Content.Length -gt 0) { exit 0 }" +
          "  exit 1" +
          "} catch { exit 1 }",
      ],
      {
        stdio: "ignore",
        windowsVerbatimArguments: false,
        env,
      }
    );

    const exitCode = await new Promise((resolve) => {
      probe.on("exit", (code) => resolve(code ?? 1));
      probe.on("error", () => resolve(1));
    });

    if (exitCode === 0) {
      return true;
    }

    await sleep(delayMs);
  }

  return false;
};

const runAdbReverse = async (port) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "cmd.exe",
      ["/d", "/s", "/c", `adb reverse tcp:${port} tcp:${port}`],
      {
        stdio: "inherit",
        windowsVerbatimArguments: false,
        env,
      }
    );
    child.on("exit", (code) => {
      if ((code ?? 1) === 0) {
        resolve();
        return;
      }
      reject(new Error(`adb reverse failed with code ${code ?? 1}`));
    });
    child.on("error", reject);
  });

const openDevApp = (port) => {
  spawn(
    "cmd.exe",
    [
      "/d",
      "/s",
      "/c",
      `adb shell am start -W -a android.intent.action.VIEW -d "lastrep-dev://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${port}`)}"`,
    ],
    {
      stdio: "inherit",
      windowsVerbatimArguments: false,
      env,
    }
  );
};

void (async () => {
  const port = await resolveExpoPort();
  await runAdbReverse(port);
  const baseArgs = [
    "expo",
    "start",
    "--dev-client",
    "--scheme",
    "lastrep-dev",
    "--localhost",
    "--max-workers",
    "4",
    "--port",
    String(port),
  ];

  if (hasClear) baseArgs.push("--clear");
  if (fastMode) baseArgs.push("--no-dev", "--minify");

  const command = `npx.cmd ${baseArgs.join(" ")}`;
  const child = spawn("cmd.exe", ["/d", "/s", "/c", command], {
    stdio: "inherit",
    windowsVerbatimArguments: false,
    env,
  });
  if (shouldOpen) {
    void (async () => {
      const ready = await waitForMetro(port);
      if (ready) {
        const prewarmed = await prewarmAndroidBundle(port);
        void prewarmed;
        openDevApp(port);
      }
    })();
  }
  child.on("exit", (exitCode, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(exitCode ?? 1);
  });
})();
