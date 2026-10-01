const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function injectOnce(source, marker, insertion) {
  if (source.includes(insertion.trim())) return source;
  if (!source.includes(marker)) return source;
  return source.replace(marker, `${marker}\n${insertion}`);
}

module.exports = function withWorkoutNativeOverrides(config) {
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
