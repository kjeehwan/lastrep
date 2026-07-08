const { spawn } = require("child_process");

const env = {
  ...process.env,
  APP_VARIANT: "dev",
};

const projectRoot = process.cwd().toLowerCase();

const detectMetroPort = async () =>
  new Promise((resolve) => {
    let stdout = "";
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "$root = '" +
          projectRoot.replace(/'/g, "''") +
          "';" +
          "$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*expo*start*' -and $_.CommandLine.ToLower().Contains($root) };" +
          "$match = $procs | Select-Object -First 1;" +
          "if (-not $match) { '{\"port\":8081}' } else {" +
          "  $cmd = $match.CommandLine;" +
          "  if ($cmd -match '--port\\s+(\\d+)') { [pscustomobject]@{ port = [int]$Matches[1] } | ConvertTo-Json -Compress } else { '{\"port\":8081}' }" +
          "}",
      ],
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
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(Number(parsed.port) || 8081);
      } catch {
        resolve(8081);
      }
    });
    child.on("error", () => resolve(8081));
  });

void (async () => {
  const port = await detectMetroPort();
  const child = spawn(
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

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
})();
