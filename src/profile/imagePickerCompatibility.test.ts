import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const { patchCropContract } = createRequire(import.meta.url)("../../scripts/patch-image-picker.js") as { patchCropContract: (source: string) => string };

const original = `import android.os.Build
import androidx.core.net.toUri
    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent?.getParcelableExtra(CropImage.CROP_IMAGE_EXTRA_RESULT, CropImage.ActivityResult::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent?.getParcelableExtra(CropImage.CROP_IMAGE_EXTRA_RESULT)
    }
    if (resultCode == Activity.RESULT_CANCELED || result == null) return Cancelled
    return result.uriContent
`;

it("routes crop result decoding through AndroidX without changing cancellation or photo handling", () => {
  const patched = patchCropContract(original);
  expect(patched).toContain("IntentCompat.getParcelableExtra(it, CropImage.CROP_IMAGE_EXTRA_RESULT, CropImage.ActivityResult::class.java)");
  expect(patched).toContain("import androidx.core.content.IntentCompat\n");
  expect(patched).not.toContain("Build.VERSION_CODES.TIRAMISU");
  expect(patched).toContain("if (resultCode == Activity.RESULT_CANCELED || result == null) return Cancelled");
  expect(patched).toContain("return result.uriContent");
});
it("is idempotent across repeated installs", () => {
  const patched = patchCropContract(original);
  expect(patchCropContract(patched)).toBe(patched);
});
it("accepts Windows line endings", () => {
  expect(patchCropContract(original.replace(/\n/g, "\r\n"))).toBe(patchCropContract(original));
});
it("fails explicitly if an upstream SDK update changes the native contract", () => {
  expect(() => patchCropContract(original.replace("TIRAMISU", "UPSIDE_DOWN_CAKE"))).toThrow("Unexpected expo-image-picker");
});
it("runs as an npm install lifecycle script for cloud builds", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(pkg.scripts.postinstall).toContain("node scripts/patch-image-picker.js");
  expect(pkg.postinstall).toBeUndefined();
});

it("compiles the patched image picker instead of using Expo prebuilt binaries", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  expect(pkg.expo.autolinking.android.buildFromSource).toContain("expo-image-picker");
});
