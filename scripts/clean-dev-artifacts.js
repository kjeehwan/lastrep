const fs = require("fs");
const path = require("path");

const root = process.cwd();
const targets = [
  "android/app/build",
  "android/app/.cxx",
  "android/.gradle",
  "node_modules/react-native-reanimated/android/build",
  "node_modules/react-native-reanimated/android/.cxx",
  "node_modules/react-native-worklets/android/build",
  "node_modules/react-native-worklets/android/.cxx",
  "node_modules/react-native-screens/android/build",
  "node_modules/react-native-screens/android/.cxx",
  "node_modules/react-native-gesture-handler/android/build",
  "node_modules/react-native-gesture-handler/android/.cxx",
  "node_modules/expo/node_modules/expo-modules-core/android/build",
  "node_modules/expo/node_modules/expo-modules-core/android/.cxx",
];

for (const relativeTarget of targets) {
  const absoluteTarget = path.resolve(root, relativeTarget);
  if (!absoluteTarget.startsWith(root)) {
    throw new Error(`Refusing to delete outside workspace: ${absoluteTarget}`);
  }
  if (fs.existsSync(absoluteTarget)) {
    fs.rmSync(absoluteTarget, { recursive: true, force: true });
    console.log(`Removed ${relativeTarget}`);
  } else {
    console.log(`Skipped ${relativeTarget} (not found)`);
  }
}
