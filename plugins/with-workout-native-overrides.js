const fs = require("fs");
const path = require("path");
const { withDangerousMod, withAndroidManifest } = require("@expo/config-plugins");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function injectOnce(source, marker, insertion) {
  if (source.includes(insertion.trim())) return source;
  if (!source.includes(marker)) return source;
  return source.replace(marker, `${marker}\n${insertion}`);
}

module.exports = function withWorkoutNativeOverrides(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const permissions = manifest["uses-permission"] ?? [];
    for (const name of ["android.permission.POST_NOTIFICATIONS", "android.permission.SCHEDULE_EXACT_ALARM"]) {
      if (!permissions.some((item) => item.$["android:name"] === name)) permissions.push({ $: { "android:name": name } });
    }
    manifest["uses-permission"] = permissions;
    const app = manifest.application[0];
    const name = ".restalerts.RestAlertReceiver";
    app.receiver = [...(app.receiver ?? []).filter((item) => item.$["android:name"] !== name), { $: { "android:name": name, "android:exported": "false" } }];
    return cfg;
  });
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const packageName = cfg.android?.package;
      if (!packageName) {
        throw new Error("android.package is required for with-workout-native-overrides");
      }

      const packagePath = packageName.split(".").join(path.sep);
      const templateBase = path.join(projectRoot, "native-overrides", "android-kotlin");
      const targetBase = path.join(projectRoot, "android", "app", "src", "main", "java", packagePath);

      const templates = [
        "gesture/WorkoutGestureReactEditText.kt",
        "gesture/WorkoutGestureTextInputManager.kt",
        "gesture/WorkoutGestureTextInputPackage.kt",
        "workoutnative/WorkoutSetListManager.kt",
        "workoutnative/WorkoutSetListPackage.kt",
        "workoutnative/WorkoutSetListView.kt",
        "timewheel/MealTimeWheelView.kt",
        "timewheel/MealTimeWheelManager.kt",
        "timewheel/MealTimeWheelPackage.kt",
        "systembars/NotebookSystemBarsPackage.kt",
        "restalerts/RestAlertsPackage.kt",
      ];

      for (const rel of templates) {
        const templatePath = path.join(templateBase, rel);
        if (!fs.existsSync(templatePath)) {
          throw new Error(`Missing native override template: ${templatePath}`);
        }
        const raw = fs.readFileSync(templatePath, "utf8");
        const resolved = raw.replaceAll("__PACKAGE__", packageName);
        const outPath = path.join(targetBase, rel);
        ensureDir(outPath);
        fs.writeFileSync(outPath, resolved, "utf8");
      }

      const mainApplicationPath = path.join(targetBase, "MainApplication.kt");
      if (!fs.existsSync(mainApplicationPath)) {
        throw new Error(`MainApplication.kt not found at ${mainApplicationPath}`);
      }
      let mainApp = fs.readFileSync(mainApplicationPath, "utf8");
      mainApp = injectOnce(
        mainApp,
        "import com.facebook.react.defaults.DefaultReactNativeHost",
        `import ${packageName}.gesture.WorkoutGestureTextInputPackage\nimport ${packageName}.workoutnative.WorkoutSetListPackage`
      );
      mainApp = injectOnce(
        mainApp,
        "// add(MyReactNativePackage())",
        "              add(WorkoutGestureTextInputPackage())\n              add(WorkoutSetListPackage())"
      );
      mainApp = injectOnce(mainApp, "import com.facebook.react.defaults.DefaultReactNativeHost", `import ${packageName}.timewheel.MealTimeWheelPackage`);
      mainApp = injectOnce(mainApp, "add(WorkoutSetListPackage())", "        add(MealTimeWheelPackage())");
      mainApp = injectOnce(mainApp, "import com.facebook.react.defaults.DefaultReactNativeHost", `import ${packageName}.systembars.NotebookSystemBarsPackage`);
      mainApp = injectOnce(mainApp, "add(MealTimeWheelPackage())", "        add(NotebookSystemBarsPackage())");
      mainApp = injectOnce(mainApp, "import com.facebook.react.defaults.DefaultReactNativeHost", `import ${packageName}.restalerts.RestAlertsPackage`);
      mainApp = injectOnce(mainApp, "add(NotebookSystemBarsPackage())", "        add(RestAlertsPackage())");
      const gongTarget = path.join(projectRoot, "android", "app", "src", "main", "res", "raw", "rest_gong.wav");
      ensureDir(gongTarget);
      fs.copyFileSync(path.join(projectRoot, "assets", "sounds", "gong.wav"), gongTarget);
      fs.writeFileSync(mainApplicationPath, mainApp, "utf8");

      const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");
      if (!fs.existsSync(buildGradlePath)) {
        throw new Error(`build.gradle not found at ${buildGradlePath}`);
      }
      let buildGradle = fs.readFileSync(buildGradlePath, "utf8");
      const recyclerDep = '    implementation("androidx.recyclerview:recyclerview:1.3.2")';
      if (!buildGradle.includes("androidx.recyclerview:recyclerview")) {
        buildGradle = injectOnce(
          buildGradle,
          '    implementation("com.facebook.react:react-android")',
          recyclerDep
        );
      }
      fs.writeFileSync(buildGradlePath, buildGradle, "utf8");

      return cfg;
    },
  ]);
};
