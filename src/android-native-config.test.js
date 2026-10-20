import { describe, expect, it } from "vitest";
import checks from "../scripts/check-android-config.js";

function fixture() {
  return {
    configs: {
      dev: {
        name: "Lastrep Dev", scheme: "lastrep-dev", orientation: "default",
        userInterfaceStyle: "automatic", icon: "icon.png",
        android: { package: "com.kjeehwan.lastrep.dev", permissions: ["android.permission.health.READ_SLEEP"], adaptiveIcon: { foregroundImage: "foreground.png" } },
        plugins: [["expo-build-properties", { android: { minSdkVersion: 29, enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } }], ["expo-splash-screen", { image: "./assets/images/wordmark-splash-dev.png", imageWidth: 288, backgroundColor: "#000000", dark: { backgroundColor: "#000000" } }]],
      },
    },
    gradle: 'dev {\n applicationId "com.kjeehwan.lastrep.dev"\n appAuthScheme: "lastrep-dev",\n expoAppAuthScheme: "exp+lastrep-dev",\n resValue "string", "app_name", "Lastrep Dev"\n}',
    manifest: '<uses-permission android:name="android.permission.health.READ_SLEEP"/><activity android:resizeableActivity="true"><data android:scheme="${appAuthScheme}"/><data android:scheme="${expoAppAuthScheme}"/></activity>',
    properties: "android.minSdkVersion=29\nandroid.enableMinifyInReleaseBuilds=true\nandroid.enableShrinkResourcesInReleaseBuilds=true\n",
    strings: '<string name="expo_system_ui_user_interface_style">automatic</string>',
    styles: '@drawable/splashscreen_brand <item name="android:windowBackground">@color/splashscreen_background</item>',
    splashBrand: '<vector android:viewportWidth="288"',
    wordmarkAssetsValid: true,
    splashColors: Object.fromEntries(["main/values", "main/values-night", "dev/values", "dev/values-night"].map((key) => [key, '<color name="splashscreen_background">#000000</color>'])),
    exists: () => true,
  };
}

describe("tracked Android config guards", () => {
  it("accepts matching configuration", () => {
    expect(checks.checkAndroidConfig(fixture())).toEqual([]);
  });
  it.each([
    ["package", "gradle", "com.kjeehwan.lastrep.dev", "wrong.package"],
    ["scheme", "gradle", 'appAuthScheme: "lastrep-dev"', 'appAuthScheme: "wrong"'],
    ["permission", "manifest", "android.permission.health.READ_SLEEP", "wrong.permission"],
    ["resizing", "manifest", 'resizeableActivity="true"', 'resizeableActivity="false"'],
    ["optimization", "properties", "enableMinifyInReleaseBuilds=true", "enableMinifyInReleaseBuilds=false"],
  ])("rejects %s drift", (_label, field, before, after) => {
    const input = fixture();
    input[field] = input[field].replace(before, after);
    expect(checks.checkAndroidConfig(input).length).toBeGreaterThan(0);
  });
  it("rejects portrait restrictions", () => {
    const input = fixture();
    input.manifest += '<activity android:screenOrientation="portrait"/>';
    expect(checks.checkAndroidConfig(input)).toContain("dev: orientation must remain unrestricted");
  });
  it("rejects missing branding resources", () => {
    const input = fixture();
    input.exists = () => false;
    expect(checks.checkAndroidConfig(input)).toContain("dev: missing branding source icon.png");
  });
  it.each(["main/values", "main/values-night", "dev/values", "dev/values-night"])("rejects splash color drift in %s", (key) => {
    const input = fixture();
    input.splashColors[key] = input.splashColors[key].replace("#000000", "#1F130B");
    expect(checks.checkAndroidConfig(input)).toContain(`${key}: native splash background must be black`);
  });
  it("rejects Expo splash drift", () => {
    const input = fixture();
    input.configs.dev.plugins[1][1].dark.backgroundColor = "#0d0d1a";
    expect(checks.checkAndroidConfig(input)).toContain("dev: Expo splash background must be black in both modes");
  });
  it("rejects splash artwork drift", () => {
    const input = fixture();
    input.wordmarkAssetsValid = false;
    expect(checks.checkAndroidConfig(input)).toContain("Home wordmark splash assets must match shared geometry");
  });
  it("rejects the other flavor's splash colors", () => {
    const input = fixture();
    input.configs.dev.plugins[1][1].image = "./assets/images/wordmark-splash-prod.png";
    expect(checks.checkAndroidConfig(input)).toContain("dev: splash must use its own Home wordmark colors");
  });
});
