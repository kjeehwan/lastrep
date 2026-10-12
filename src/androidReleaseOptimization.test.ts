import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Android release optimization configuration', () => {
  it('enables code and resource shrinking in the tracked native project', () => {
    const properties = read('android/gradle.properties');
    expect(properties).toMatch(/^android\.enableMinifyInReleaseBuilds=true$/m);
    expect(properties).toMatch(/^android\.enableShrinkResourcesInReleaseBuilds=true$/m);
    expect(properties).not.toMatch(/^android\.enableR8\.fullMode=false$/m);
    expect(properties).toMatch(/^org\.gradle\.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m$/m);
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain('minifyEnabled enableMinifyInReleaseBuilds');
    expect(gradle).toContain('shrinkResources enableShrinkResources.toBoolean()');
    expect(gradle).toContain('getDefaultProguardFile("proguard-android-optimize.txt")');
    expect(gradle).not.toContain('getDefaultProguardFile("proguard-android.txt")');
    const debug = gradle.match(/debug\s*\{([^}]+)\}/)?.[1];
    expect(debug).toBeDefined();
    expect(debug).not.toMatch(/minifyEnabled|shrinkResources/);
  });

  it('mirrors the settings in Expo config without regenerating native projects', () => {
    const config = JSON.parse(read('app.base.json'));
    const buildProperties = config.expo.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    );
    expect(buildProperties[1].android).toMatchObject({
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
    });
  });

  it('does not globally disable optimization or duplicate broad library keep rules', () => {
    const rules = read('android/app/proguard-rules.pro');
    expect(rules).not.toMatch(/^\s*-(dontobfuscate|dontoptimize|dontshrink|ignorewarnings)\b/m);
    expect(rules).not.toMatch(/^-keep class com\.(swmansion\.reanimated|facebook\.react\.turbomodule)\.\*\*/m);
  });

  it('excludes the unused Amazon store that globally disables R8 optimization', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toMatch(/configurations\.configureEach\s*\{\s*exclude group: "com\.revenuecat\.purchases", module: "purchases-store-amazon"\s*\}/);
  });
});
