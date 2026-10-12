export const MAX_PHOTO_INPUT_BYTES = 6 * 1024 * 1024;
export const PHOTO_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function photoObjectPath(uid: string, id: string): string {
  return `users/${uid}/profile-photos/${id}.jpg`;
}

export function isOwnPhotoPath(uid: string, path: unknown): path is string {
  if (typeof path !== "string") return false;
  const filename = path.split("/").pop() ?? "";
  return /^[a-f0-9-]{36}\.jpg$/.test(filename) &&
    path === photoObjectPath(uid, filename.replace(".jpg", ""));
}

export function decodePhotoInput(base64: unknown): Buffer {
  if (typeof base64 !== "string" || !base64.length ||
      base64.length > Math.ceil(MAX_PHOTO_INPUT_BYTES / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) {
    throw new Error("Choose an image smaller than 6 MB.");
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_PHOTO_INPUT_BYTES || bytes.toString("base64") !== base64) {
    throw new Error("Invalid image data.");
  }
  return bytes;
}

export function canCommitPhoto(status: unknown, createdAtMs: number, nowMs: number): boolean {
  return status === "staged" && nowMs - createdAtMs < PHOTO_MAX_AGE_MS;
}

export function canDeletePhoto(path: string, activePath: unknown): boolean {
  return path !== activePath;
}
