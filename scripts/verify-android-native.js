const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const buildGradlePath = path.join(projectRoot, "android", "app", "build.gradle");

function read(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

const buildGradle = read(buildGradlePath);
if (!buildGradle) {
  fail("Missing android/app/build.gradle");
  process.exit(process.exitCode || 1);
}

const namespaceMatch = buildGradle.match(/namespace\s+'([^']+)'/);
const appIdMatch = buildGradle.match(/applicationId\s+'([^']+)'/);
const packageName = namespaceMatch?.[1] || appIdMatch?.[1];

if (!packageName) {
  fail("Could not detect Android package name from build.gradle");
  process.exit(process.exitCode || 1);
}
ok(`Detected package: ${packageName}`);

const packagePath = packageName.split(".").join(path.sep);
const javaBase = path.join(projectRoot, "android", "app", "src", "main", "java", packagePath);
const mainApplicationPath = path.join(javaBase, "MainApplication.kt");
const mainApplication = read(mainApplicationPath);

if (!mainApplication) {
  fail(`Missing MainApplication.kt at ${mainApplicationPath}`);
} else {
  const hasGestureAdd = mainApplication.includes("add(WorkoutGestureTextInputPackage())");
  const hasSetListAdd = mainApplication.includes("add(WorkoutSetListPackage())");
  if (!hasGestureAdd) fail("MainApplication.kt missing add(WorkoutGestureTextInputPackage())");
  else ok("MainApplication.kt registers WorkoutGestureTextInputPackage");
  if (!hasSetListAdd) fail("MainApplication.kt missing add(WorkoutSetListPackage())");
  else ok("MainApplication.kt registers WorkoutSetListPackage");
  if (!mainApplication.includes("add(MealTimeWheelPackage())")) fail("MainApplication.kt missing add(MealTimeWheelPackage())");
  else ok("MainApplication.kt registers MealTimeWheelPackage");
}

const requiredNativeFiles = [
  "gesture/WorkoutGestureReactEditText.kt",
  "gesture/WorkoutGestureTextInputManager.kt",
  "gesture/WorkoutGestureTextInputPackage.kt",
  "workoutnative/WorkoutSetListManager.kt",
  "workoutnative/WorkoutSetListPackage.kt",
  "workoutnative/WorkoutSetListView.kt",
  "timewheel/MealTimeWheelManager.kt",
  "timewheel/MealTimeWheelPackage.kt",
  "timewheel/MealTimeWheelView.kt",
];

for (const rel of requiredNativeFiles) {
  const full = path.join(javaBase, rel);
  if (!fs.existsSync(full)) {
    fail(`Missing native file: ${full}`);
  } else {
    ok(`Native file present: ${rel}`);
    if (rel.startsWith("timewheel/")) {
      const template = read(path.join(projectRoot, "native-overrides", "android-kotlin", rel));
      const expected = template?.replaceAll("__PACKAGE__", packageName).replace(/\r\n/g, "\n");
      if (read(full).replace(/\r\n/g, "\n") !== expected) fail(`Native time wheel differs from its prebuild template: ${rel}`);
    }
  }
}

if (!buildGradle.includes('implementation("androidx.recyclerview:recyclerview:1.3.2")')) {
  fail("build.gradle missing RecyclerView dependency line");
} else {
  ok("RecyclerView dependency present");
}

try {
  const errors = require("./check-android-config").verifyAndroidConfig(projectRoot);
  for (const error of errors) fail(error);
  if (errors.length === 0) ok("Dev/prod Expo and tracked Android configuration checks passed");
} catch (error) {
  fail(`Android configuration verification could not complete: ${error.message}`);
}

if (process.exitCode && process.exitCode !== 0) {
  console.error("Android native verification failed.");
  process.exit(process.exitCode);
}

console.log("Android native verification passed.");
