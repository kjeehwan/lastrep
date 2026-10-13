import { describe, expect, it } from "vitest";
import checks from "../scripts/check-android-config.js";

function fixture() {
  return {
    configs: {
      dev: {
        name: "Lastrep Dev", scheme: "lastrep-dev", orientation: "default",
        userInterfaceStyle: "automatic", icon: "icon.png",
        android: { package: "com.kjeehwan.lastrep.dev", permissions: ["android.permission.health.READ_SLEEP"], adaptiveIcon: { foregroundImage: "foreground.png" } },
        plugins: [["expo-build-properties", { android: { minSdkVersion: 29, enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } }]],
      },
    },
    gradle: 'dev {\n applicationId "com.kjeehwan.lastrep.dev"\n appAuthScheme: "lastrep-dev",\n expoAppAuthScheme: "exp+lastrep-dev",\n resValue "string", "app_name", "Lastrep Dev"\n}',
    manifest: '<uses-permission android:name="android.permission.health.READ_SLEEP"/><activity android:resizeableActivity="true"><data android:scheme="${appAuthScheme}"/><data android:scheme="${expoAppAuthScheme}"/></activity>',
    properties: "android.minSdkVersion=29\nandroid.enableMinifyInReleaseBuilds=true\nandroid.enableShrinkResourcesInReleaseBuilds=true\n",
    strings: '<string name="expo_system_ui_user_interface_style">automatic</string>',
    styles: "@drawable/splashscreen_logo",
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
});
