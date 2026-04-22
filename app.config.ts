import type { ExpoConfig } from "@expo/config-types";
import fs from "node:fs";
import path from "node:path";

type AppVariant = "dev" | "prod";

const appJsonPath = path.join(__dirname, "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8")) as { expo: ExpoConfig };
const baseConfig = appJson.expo;

const projectRoot = __dirname;
const variant: AppVariant = process.env.APP_VARIANT === "dev" ? "dev" : "prod";
const isDevVariant = variant === "dev";

const resolveGoogleServicesFile = () => {
  const envFileForVariant =
    variant === "dev" ? process.env.GOOGLE_SERVICES_JSON_DEV : process.env.GOOGLE_SERVICES_JSON_PROD;
  const legacyEnvFile = process.env.GOOGLE_SERVICES_JSON;
  const fallbackRelativePath = variant === "dev" ? "./google-services.dev.json" : "./google-services.json";
  const fallbackAbsolutePath = path.join(projectRoot, fallbackRelativePath.replace("./", ""));

  const resolved =
    (envFileForVariant && envFileForVariant.trim().length > 0 && envFileForVariant) ||
    (legacyEnvFile && legacyEnvFile.trim().length > 0 && legacyEnvFile) ||
    fallbackRelativePath;

  if (resolved === fallbackRelativePath && !fs.existsSync(fallbackAbsolutePath)) {
    throw new Error(
      variant === "dev"
        ? "Missing dev google services file. Add google-services.dev.json locally or set GOOGLE_SERVICES_JSON_DEV as an EAS file secret."
        : "Missing prod google services file. Add google-services.json locally or set GOOGLE_SERVICES_JSON_PROD as an EAS file secret."
    );
  }

  return resolved;
};

const resolvedGoogleServicesFile = resolveGoogleServicesFile();

const androidPackage = isDevVariant ? "com.kjeehwan.lastrep.dev" : "com.kjeehwan.lastrep";
const appScheme = isDevVariant ? "lastrep-dev" : "lastrep";
const appName = isDevVariant ? "Lastrep Dev" : "Lastrep";
const appIcon = isDevVariant
  ? "./assets/images/logo-splash-512-appicon-dev.png"
  : "./assets/images/logo-splash-512-appicon-v3.png";
const adaptiveForeground = isDevVariant
  ? "./assets/images/logo-splash-512-foreground-padded-dev.png"
  : "./assets/images/logo-splash-512-foreground-padded-v3.png";
const splashImage = isDevVariant
  ? "./assets/images/logo-splash-dev.png"
  : "./assets/images/logo-splash-v2.png";

const plugins = (baseConfig.plugins ?? []).map((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === "expo-splash-screen") {
    return [
      "expo-splash-screen",
      {
        ...(plugin[1] as Record<string, unknown>),
        image: splashImage,
      },
    ] as ExpoConfig["plugins"][number];
  }
  return plugin;
});

const config: ExpoConfig = {
  ...baseConfig,
  name: appName,
  scheme: appScheme,
  icon: appIcon,
  plugins,
  newArchEnabled: true,
  android: {
    ...baseConfig.android,
    package: androidPackage,
    googleServicesFile: resolvedGoogleServicesFile,
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      ...(baseConfig.android?.adaptiveIcon ?? {}),
      foregroundImage: adaptiveForeground,
    },
  },
};

export default config;
