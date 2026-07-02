const { spawn } = require("child_process");

const command =
  "npx.cmd expo start --dev-client --clear --scheme lastrep-dev --android";

const child = spawn("cmd.exe", ["/d", "/s", "/c", command], {
  stdio: "inherit",
  windowsVerbatimArguments: false,
  env: {
    ...process.env,
    APP_VARIANT: "dev",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
