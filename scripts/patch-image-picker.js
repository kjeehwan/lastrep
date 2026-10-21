const fs = require("node:fs");
const path = require("node:path");

const legacy = `    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      intent?.getParcelableExtra(CropImage.CROP_IMAGE_EXTRA_RESULT, CropImage.ActivityResult::class.java)
    } else {
      @Suppress("DEPRECATION")
      intent?.getParcelableExtra(CropImage.CROP_IMAGE_EXTRA_RESULT)
    }`;
const compatible = `    // AndroidX avoids Android 13's broken typed Parcelable reader (b/232589966).
    val result = intent?.let {
      IntentCompat.getParcelableExtra(it, CropImage.CROP_IMAGE_EXTRA_RESULT, CropImage.ActivityResult::class.java)
    }`;

function patchCropContract(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  if (normalized.includes(compatible) && normalized.includes("import androidx.core.content.IntentCompat\n")) return source;
  if (!normalized.includes(legacy) || !normalized.includes("import android.os.Build\n") || !normalized.includes("import androidx.core.net.toUri\n")) {
    throw new Error("Unexpected expo-image-picker CropImageContract source. Review the Android 13 compatibility patch before building.");
  }
  return normalized.replace("import android.os.Build\n", "")
    .replace("import androidx.core.net.toUri\n", "import androidx.core.content.IntentCompat\nimport androidx.core.net.toUri\n")
    .replace(legacy, compatible);
}

if (require.main === module) {
  const target = path.join(__dirname, "..", "node_modules", "expo-image-picker", "android", "src", "main", "java", "expo", "modules", "imagepicker", "contracts", "CropImageContract.kt");
  try {
    const source = fs.readFileSync(target, "utf8");
    const patched = patchCropContract(source);
    if (patched !== source) fs.writeFileSync(target, patched);
    console.log("Image picker Android 13 compatibility patch ready.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { patchCropContract };
