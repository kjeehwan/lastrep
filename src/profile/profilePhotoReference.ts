export const CLOUD_PHOTO_PREFIX = "lastrep-photo:";

export function cloudPhotoReference(path: string): string {
  return `${CLOUD_PHOTO_PREFIX}${path}`;
}

export function cloudPhotoPath(reference: string): string | null {
  return reference.startsWith(CLOUD_PHOTO_PREFIX) ? reference.slice(CLOUD_PHOTO_PREFIX.length) : null;
}

export function profilePhotoReference(profile: Record<string, unknown> | null | undefined): string {
  return typeof profile?.profilePhotoPath === "string" && profile.profilePhotoPath
    ? cloudPhotoReference(profile.profilePhotoPath)
    : typeof profile?.profilePhotoUri === "string" ? profile.profilePhotoUri.trim() : "";
}

export function snapshotWithPhoto(snapshot: string, reference: string): string {
  return JSON.stringify({ ...JSON.parse(snapshot), profilePhotoUri: reference });
}
