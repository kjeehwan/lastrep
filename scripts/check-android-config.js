const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function checkAndroidConfig({ configs, gradle, manifest, properties, strings, styles, splashColors, splashBrand, wordmarkAssetsValid, exists }) {
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
    const splashPlugin = (config.plugins || []).find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen");
    check(splashPlugin?.[1]?.backgroundColor === "#000000" && splashPlugin?.[1]?.dark?.backgroundColor === "#000000", `${variant}: Expo splash background must be black in both modes`);
    check(splashPlugin?.[1]?.imageWidth === 288, `${variant}: splash image width must match native composition`);
    check(splashPlugin?.[1]?.image === `./assets/images/wordmark-splash-${variant}.png`, `${variant}: splash must use its own Home wordmark colors`);
    for (const [key, value] of Object.entries(buildPlugin?.[1]?.android || {})) {
      if (["minSdkVersion", "enableMinifyInReleaseBuilds", "enableShrinkResourcesInReleaseBuilds"].includes(key)) {
        check(new RegExp(`^android\\.${key}=${value}\\s*$`, "m").test(properties), `${variant}: Gradle property ${key} differs from Expo config`);
      }
    }
  }
  for (const placeholder of ["appAuthScheme", "expoAppAuthScheme"]) {
    check(manifest.includes(`android:scheme="\${${placeholder}}"`), `Manifest must use ${placeholder} flavor placeholder`);
  }
  check(styles.includes("@drawable/splashscreen_brand"), "Splash theme must reference native branding");
  check(splashBrand.includes('<vector') && splashBrand.includes('android:viewportWidth="288"'), "Native splash must use the shared wordmark vector canvas");
  check(wordmarkAssetsValid, "Home wordmark splash assets must match shared geometry");
  check(styles.includes('<item name="android:windowBackground">@color/splashscreen_background</item>'), "App launch window must use the splash background");
  for (const sourceSet of ["main", "dev"]) {
    for (const mode of ["values", "values-night"]) {
      check(/<color name="splashscreen_background">#000000<\/color>/.test(splashColors?.[`${sourceSet}/${mode}`] || ""), `${sourceSet}/${mode}: native splash background must be black`);
    }
  }
  return errors;
}

function verifyAndroidConfig(projectRoot) {
  const configs = {};
  // Separate processes avoid Expo's config cache leaking one variant into another.
  // Skip plugin execution: dependency permissions are merged by Android, not this manifest.
  // Capture dynamic plugin options first: Expo deletes them in skipPlugins mode.
  for (const variant of ["dev", "prod"]) {
    configs[variant] = JSON.parse(execFileSync(process.execPath, ["-e",
      "const plugins = require('@expo/require-utils').loadModuleSync(require('node:path').resolve('app.config.ts')).default.plugins; const exp = require('@expo/config').getConfig(process.cwd(), {skipPlugins:true}).exp; process.stdout.write(JSON.stringify({...exp, plugins}))",
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
  }
  const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
  return checkAndroidConfig({
    configs,
    gradle: read("android/app/build.gradle"),
    manifest: read("android/app/src/main/AndroidManifest.xml"),
    properties: read("android/gradle.properties"),
    strings: read("android/app/src/main/res/values/strings.xml"),
    styles: read("android/app/src/main/res/values/styles.xml"),
    splashBrand: read("android/app/src/main/res/drawable/splashscreen_brand.xml"),
    wordmarkAssetsValid: require("./wordmark-assets").verifyWordmarkAssets(projectRoot).length === 0,
    splashColors: Object.fromEntries(["main", "dev"].flatMap((sourceSet) => ["values", "values-night"].map((mode) => [
      `${sourceSet}/${mode}`, read(`android/app/src/${sourceSet}/res/${mode}/colors.xml`),
    ]))),
    exists: (file) => fs.existsSync(path.join(projectRoot, file)),
  });
}

module.exports = { checkAndroidConfig, verifyAndroidConfig };
