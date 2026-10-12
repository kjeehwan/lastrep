import { describe, expect, it } from "vitest";
import { cloudPhotoPath, cloudPhotoReference, profilePhotoReference, snapshotWithPhoto } from "./profilePhotoReference";
import { canCommitPhoto, canDeletePhoto, decodePhotoInput, isOwnPhotoPath, MAX_PHOTO_INPUT_BYTES, PHOTO_MAX_AGE_MS, photoObjectPath } from "../../functions/src/profilePhotoPolicy";

describe("profile photo references and lifecycle policy", () => {
  const path = photoObjectPath("alice", "12345678-1234-1234-1234-123456789abc");
  it("prefers a cloud reference over a legacy local URI", () => {
    expect(profilePhotoReference({ profilePhotoPath: path, profilePhotoUri: "file:///old.jpg" })).toBe(cloudPhotoReference(path));
    expect(cloudPhotoPath(cloudPhotoReference(path))).toBe(path);
  });
  it("retains legacy photos until migrated and handles removed photos", () => {
    expect(profilePhotoReference({ profilePhotoUri: "file:///local.jpg" })).toBe("file:///local.jpg");
    expect(profilePhotoReference({ profilePhotoPath: null, profilePhotoUri: "" })).toBe("");
    expect(profilePhotoReference(null)).toBe("");
  });
  it("rebases the saved snapshot without changing unrelated draft fields", () => {
    const snapshot = JSON.stringify({ nickname: "A", profilePhotoUri: "file:///draft.jpg" });
    expect(JSON.parse(snapshotWithPhoto(snapshot, cloudPhotoReference(path)))).toEqual({ nickname: "A", profilePhotoUri: cloudPhotoReference(path) });
  });
  it("rejects another user's photo and traversal", () => {
    expect(isOwnPhotoPath("alice", path)).toBe(true);
    expect(isOwnPhotoPath("bob", path)).toBe(false);
    expect(isOwnPhotoPath("alice", "users/alice/profile-photos/../secret.jpg")).toBe(false);
  });
  it("accepts only canonical, bounded base64", () => {
    expect(decodePhotoInput(Buffer.from("image").toString("base64"))).toEqual(Buffer.from("image"));
    for (const input of [null, "", "data:image/jpeg;base64,aGVsbG8=", "!!!!", "a===", "aGVsbG9="]) {
      expect(() => decodePhotoInput(input)).toThrow();
    }
    expect(() => decodePhotoInput(Buffer.alloc(MAX_PHOTO_INPUT_BYTES + 1).toString("base64"))).toThrow();
  });
  it("prevents expired or cleanup-claimed uploads from being committed", () => {
    expect(canCommitPhoto("staged", 100, 200)).toBe(true);
    expect(canCommitPhoto("staged", 100, PHOTO_MAX_AGE_MS + 100)).toBe(false);
    expect(canCommitPhoto("deleting", 100, 200)).toBe(false);
    expect(canCommitPhoto("uploading", 100, 200)).toBe(false);
    expect(canDeletePhoto(path, path)).toBe(false);
    expect(canDeletePhoto(path, null)).toBe(true);
  });
});
