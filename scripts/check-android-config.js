const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function checkAndroidConfig({ configs, gradle, manifest, properties, strings, styles, exists }) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  for (const [variant, config] of Object.entries(configs)) {
    const flavor = gradle.match(new RegExp(`\\b${variant}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))?.[1] || "";
    check(flavor.includes(`applicationId "${config.android.package}"`), `${variant}: package ID differs from Expo config`);
    check(flavor.includes(`appAuthScheme: "${config.scheme}"`), `${variant}: app scheme differs from Expo config`);
    check(flavor.includes(`expoAppAuthScheme: "exp+${config.scheme}"`), `${variant}: dev-client scheme differs from Expo config`);
    check(flavor.includes(`resValue "string", "app_name", "${config.name}"`), `${variant}: app name differs from Expo config`);
    for (const permission of config.android.permissions || []) {
      check(manifest.includes(`android:name="${permission}"`), `${variant}: missing configured permission ${permission}`);
    }
    check(config.orientation === "default" && !/android:screenOrientation=/.test(manifest), `${variant}: orientation must remain unrestricted`);
    check(manifest.includes('android:resizeableActivity="true"'), `${variant}: activity must support resizing`);
    check(strings.includes(`>${config.userInterfaceStyle}</string>`), `${variant}: UI style differs from Expo config`);
    for (const asset of [config.icon, config.android.adaptiveIcon.foregroundImage]) {
      check(exists(asset), `${variant}: missing branding source ${asset}`);
    }
    const sourceSet = variant === "dev" ? "dev" : "main";
    for (const resource of ["mipmap-xxxhdpi/ic_launcher", "mipmap-xxxhdpi/ic_launcher_foreground", "drawable-xxxhdpi/splashscreen_logo"]) {
      const prefix = `android/app/src/${sourceSet}/res/${resource}`;
      check(exists(`${prefix}.png`) || exists(`${prefix}.webp`), `${variant}: missing native branding resource ${resource}`);
    }
    const buildPlugin = (config.plugins || []).find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties");
    for (const [key, value] of Object.entries(buildPlugin?.[1]?.android || {})) {
      if (["minSdkVersion", "enableMinifyInReleaseBuilds", "enableShrinkResourcesInReleaseBuilds"].includes(key)) {
        check(new RegExp(`^android\\.${key}=${value}\\s*$`, "m").test(properties), `${variant}: Gradle property ${key} differs from Expo config`);
      }
    }
  }
  for (const placeholder of ["appAuthScheme", "expoAppAuthScheme"]) {
    check(manifest.includes(`android:scheme="\${${placeholder}}"`), `Manifest must use ${placeholder} flavor placeholder`);
  }
  check(styles.includes("@drawable/splashscreen_logo"), "Splash theme must reference native branding");
  return errors;
}

function verifyAndroidConfig(projectRoot) {
  const configs = {};
  const base = JSON.parse(fs.readFileSync(path.join(projectRoot, "app.base.json"), "utf8")).expo;
  // Separate processes avoid Expo's config cache leaking one variant into another.
  // Skip plugin execution: dependency permissions are merged by Android, not this manifest.
  for (const variant of ["dev", "prod"]) {
    configs[variant] = JSON.parse(execFileSync(process.execPath, ["-e",
      "process.stdout.write(JSON.stringify(require('@expo/config').getConfig(process.cwd(), {skipPlugins:true}).exp))",
    ], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        APP_VARIANT: variant,
        EAS_BUILD: "false",
        GOOGLE_SERVICES_JSON_DEV: path.join(projectRoot, "google-services.example.json"),
        GOOGLE_SERVICES_JSON_PROD: path.join(projectRoot, "google-services.example.json"),
      },
    }));
    configs[variant].plugins = base.plugins;
  }
  const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
  return checkAndroidConfig({
    configs,
    gradle: read("android/app/build.gradle"),
    manifest: read("android/app/src/main/AndroidManifest.xml"),
    properties: read("android/gradle.properties"),
    strings: read("android/app/src/main/res/values/strings.xml"),
    styles: read("android/app/src/main/res/values/styles.xml"),
    exists: (file) => fs.existsSync(path.join(projectRoot, file)),
  });
}

module.exports = { checkAndroidConfig, verifyAndroidConfig };
