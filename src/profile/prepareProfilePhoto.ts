import * as FileSystem from "expo-file-system/legacy";
import { ImageManipulator, SaveFormat, type ImageRef } from "expo-image-manipulator";
import { Image } from "react-native";

export function profilePhotoPreparation(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 40_000_000) {
    throw new Error("Choose a photo smaller than 40 megapixels.");
  }
  const side = Math.min(width, height);
  return {
    crop: { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side },
    size: Math.min(side, 512),
  };
}

/** Match the server's center crop without sending a full-resolution image. */
export async function prepareProfilePhotoUpload(uri: string): Promise<string> {
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
  const plan = profilePhotoPreparation(dimensions.width, dimensions.height);
  const context = ImageManipulator.manipulate(uri);
  let image: ImageRef | undefined;
  let temporaryUri: string | undefined;
  try {
    context.crop(plan.crop).resize({ width: plan.size, height: plan.size });
    image = await context.renderAsync();
    const prepared = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
    temporaryUri = prepared.uri;
    if (!prepared.base64) throw new Error("Couldn't prepare this photo. Try another image.");
    return prepared.base64;
  } finally {
    image?.release();
    context.release();
    // Keep the selected source intact so failed uploads can retry the same draft.
    if (temporaryUri && temporaryUri !== uri) await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
  }
}
