const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const files = [
  {
    path: path.join(
      root,
      "node_modules",
      "react-native-health-connect",
      "android",
      "src",
      "main",
      "java",
      "dev",
      "matinzd",
      "healthconnect",
      "permissions",
      "HealthConnectPermissionDelegate.kt"
    ),
    apply(content) {
      if (content.includes("fun isInitialized(): Boolean")) return content;
      return content.replace(
        "  private lateinit var requestRoutePermission: ActivityResultLauncher<String>\n",
        "  private lateinit var requestRoutePermission: ActivityResultLauncher<String>\n\n  fun isInitialized(): Boolean {\n    return this::requestPermission.isInitialized && this::requestRoutePermission.isInitialized\n  }\n"
      );
    },
  },
  {
    path: path.join(
      root,
      "node_modules",
      "react-native-health-connect",
      "android",
      "src",
      "main",
      "java",
      "dev",
      "matinzd",
      "healthconnect",
      "HealthConnectManager.kt"
    ),
    apply(content) {
      const oldBlock = `      // Ensure the permission launcher is registered on the currently-hosting activity
      // right before launching permission request.
      HealthConnectPermissionDelegate.setPermissionDelegate(hostActivity)`;
      const nextBlock = `      if (!HealthConnectPermissionDelegate.isInitialized()) {
        HealthConnectPermissionDelegate.setPermissionDelegate(hostActivity)
      }`;
      if (content.includes(nextBlock)) return content;
      return content.replace(oldBlock, nextBlock);
    },
  },
];

let changed = false;

for (const file of files) {
  try {
    const content = fs.readFileSync(file.path, "utf8");
    const next = file.apply(content);
    if (next !== content) {
      fs.writeFileSync(file.path, next, "utf8");
      changed = true;
      console.log(`Patched ${path.relative(root, file.path)}`);
    } else {
      console.log(`Health Connect patch already applied: ${path.relative(root, file.path)}`);
    }
  } catch (error) {
    console.error(`Failed to patch ${path.relative(root, file.path)}:`, error.message);
    process.exitCode = 1;
  }
}

if (!changed && process.exitCode !== 1) {
  console.log("Health Connect patch already up to date.");
}
