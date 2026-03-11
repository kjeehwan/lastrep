import type { ExpoConfig } from "@expo/config-types";
import fs from "node:fs";
import path from "node:path";
const appJsonPath = path.join(__dirname, "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8")) as { expo: ExpoConfig };
const baseConfig = appJson.expo;

const projectRoot = __dirname;
const localGoogleServicesPath = path.join(projectRoot, "google-services.json");
const resolvedGoogleServicesFile =
  process.env.GOOGLE_SERVICES_JSON && process.env.GOOGLE_SERVICES_JSON.trim().length > 0
    ? process.env.GOOGLE_SERVICES_JSON
    : "./google-services.json";

if (
  resolvedGoogleServicesFile === "./google-services.json" &&
  !fs.existsSync(localGoogleServicesPath)
) {
  throw new Error(
    "Missing google-services.json. Add the file locally or set GOOGLE_SERVICES_JSON as an EAS file secret."
  );
}

const config: ExpoConfig = {
  ...baseConfig,
  android: {
    ...baseConfig.android,
    googleServicesFile: resolvedGoogleServicesFile,
  },
};

export default config;
