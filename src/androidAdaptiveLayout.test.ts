import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("Android adaptive layout configuration", () => {
  it("does not regenerate a portrait lock from Expo config", () => {
    const config = JSON.parse(read("app.base.json"));
    expect(config.expo.orientation).toBe("default");
  });

  it("allows MainActivity rotation and resizing without compatibility opt-outs", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const activity = manifest.match(/<activity\s+android:name="\.MainActivity"[^>]*>/)?.[0];
    expect(activity).toBeDefined();
    expect(activity).not.toContain("screenOrientation");
    expect(activity).toContain('android:resizeableActivity="true"');
    expect(activity).toContain("orientation|screenSize|screenLayout");
    expect(manifest).not.toMatch(/android:(minAspectRatio|maxAspectRatio)/);
    expect(manifest).not.toContain("PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY");
  });

  it("keeps native set editing inline in landscape", () => {
    const nativeRows = read("android/app/src/main/java/com/kjeehwan/lastrep/workoutnative/WorkoutSetListView.kt");
    expect(nativeRows).toContain("EditorInfo.IME_FLAG_NO_EXTRACT_UI");
    expect(nativeRows).toContain("EditorInfo.IME_FLAG_NO_FULLSCREEN");
    const fallback = read("src/components/WorkoutGestureTextInput.android.tsx");
    expect(fallback).toContain("disableFullscreenUI");
  });
});
