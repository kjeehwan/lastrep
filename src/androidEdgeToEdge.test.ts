import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Android edge-to-edge configuration', () => {
  it('uses the current React Native edge-to-edge flag without an obsolete Expo override', () => {
    const properties = read('android/gradle.properties');
    expect(properties).toMatch(/^edgeToEdgeEnabled=true$/m);
    expect(properties).not.toMatch(/^expo\.edgeToEdgeEnabled=/m);
  });

  it('draws the background in the app rather than setting a deprecated status-bar color', () => {
    const theme = read('android/app/src/main/res/values/styles.xml');
    expect(theme).not.toMatch(/android:(statusBarColor|navigationBarColor|windowOptOutEdgeToEdgeEnforcement)/);
    expect(theme).toContain('<item name="android:windowBackground">#0d0d1a</item>');
    expect(read('app/_layout.tsx')).toContain('<StatusBar style="light" />');
  });

  it('uses Android 15-aware Material bottom sheets', () => {
    expect(read('android/app/build.gradle')).toContain('implementation("com.google.android.material:material:1.14.0")');
  });
});
