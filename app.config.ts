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
const isEasBuild = process.env.EAS_BUILD === "true";

const resolveGoogleServicesFile = () => {
  const envFileForVariant =
    variant === "dev" ? process.env.GOOGLE_SERVICES_JSON_DEV : process.env.GOOGLE_SERVICES_JSON_PROD;
  const legacyEnvFile = process.env.GOOGLE_SERVICES_JSON;
  const fallbackRelativePath = variant === "dev" ? "./google-services.dev.json" : "./google-services.json";
  const fallbackAbsolutePath = path.join(projectRoot, fallbackRelativePath.replace("./", ""));

  const hasVariantEnv = !!(envFileForVariant && envFileForVariant.trim().length > 0);
  const hasLegacyEnv = !!(legacyEnvFile && legacyEnvFile.trim().length > 0);
  const resolved = (hasVariantEnv && envFileForVariant) || (hasLegacyEnv && legacyEnvFile) || fallbackRelativePath;

  if (isEasBuild) {
    if (!hasVariantEnv) {
      throw new Error(
        variant === "dev"
          ? "EAS build requires GOOGLE_SERVICES_JSON_DEV as a File variable for APP_VARIANT=dev."
          : "EAS build requires GOOGLE_SERVICES_JSON_PROD as a File variable for APP_VARIANT=prod."
      );
    }
    if (!envFileForVariant) {
      throw new Error("Google services file variable is empty.");
    }
    const trimmed = envFileForVariant.trim();
    if (trimmed.startsWith("{") || trimmed === "google-services.json" || trimmed === "google-services.dev.json") {
      throw new Error(
        variant === "dev"
          ? "GOOGLE_SERVICES_JSON_DEV must be a File variable path, not plain text content or filename string."
          : "GOOGLE_SERVICES_JSON_PROD must be a File variable path, not plain text content or filename string."
      );
    }
    if (!fs.existsSync(trimmed)) {
      throw new Error(
        variant === "dev"
          ? "GOOGLE_SERVICES_JSON_DEV does not point to an existing file in EAS build environment."
          : "GOOGLE_SERVICES_JSON_PROD does not point to an existing file in EAS build environment."
      );
    }
    return trimmed;
  }

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
  ? "./assets/images/logo-splash-512-foreground-padded-dev.png"
  : "./assets/images/logo-splash-512-foreground-padded-v3.png";

const mappedPlugins = (baseConfig.plugins ?? []).map((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === "expo-splash-screen") {
    return [
      "expo-splash-screen",
      {
        ...(plugin[1] as Record<string, unknown>),
        image: splashImage,
        backgroundColor: "#0d0d1a",
        dark: { backgroundColor: "#0d0d1a" },
      },
    ] as ExpoConfig["plugins"][number];
  }
  return plugin;
});

const requiredPlugins = ["expo-audio"] as const;
let plugins = [...mappedPlugins];
for (const requiredPlugin of requiredPlugins) {
  const exists = plugins.some(
    (plugin) => plugin === requiredPlugin || (Array.isArray(plugin) && plugin[0] === requiredPlugin)
  );
  if (!exists) {
    plugins = [...plugins, requiredPlugin];
  }
}

const config: ExpoConfig = {
  ...baseConfig,
  name: appName,
  scheme: appScheme,
  icon: appIcon,
  extra: {
    ...(baseConfig.extra ?? {}),
    appVariant: variant,
  },
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

