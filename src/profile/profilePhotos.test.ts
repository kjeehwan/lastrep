import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearProfilePhotoCache, commitProfilePhoto, resolveProfilePhoto, stageProfilePhoto } from "./profilePhotos";
import { cloudPhotoReference } from "./profilePhotoReference";

const fake = vi.hoisted(() => ({
  auth: { currentUser: { uid: "alice" } as { uid: string } | null },
  files: new Map<string, string>(),
  calls: [] as { name: string; data: unknown }[],
  path: "users/alice/profile-photos/12345678-1234-1234-1234-123456789abc.jpg",
  beforeRead: null as (() => void) | null,
}));
vi.mock("../config/firebaseConfig", () => ({ auth: fake.auth }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("firebase/app", () => ({ getApp: () => ({}) }));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: (_functions: unknown, name: string) => async (data: unknown) => {
    fake.calls.push({ name, data });
    if (name === "getProfilePhoto") return { data: { path: fake.path, base64: "aW1hZ2U=" } };
    return { data: { path: fake.path } };
  },
}));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
  getInfoAsync: async (uri: string) => ({ exists: fake.files.has(uri), size: 5 }),
  readAsStringAsync: async (uri: string) => { fake.beforeRead?.(); return fake.files.get(uri); },
  writeAsStringAsync: async (uri: string, data: string) => { fake.files.set(uri, data); },
  makeDirectoryAsync: async (uri: string) => { fake.files.set(uri, "directory"); },
  readDirectoryAsync: async () => [...fake.files.keys()].filter((uri) => uri.startsWith("file:///cache/profile-photos/"))
    .map((uri) => uri.split("/").pop()),
  deleteAsync: async (uri: string) => { fake.files.delete(uri); },
}));

describe("cloud photo client", () => {
  beforeEach(async () => {
    fake.auth.currentUser = { uid: "alice" };
    await clearProfilePhotoCache("alice");
    fake.files.clear(); fake.calls.length = 0; fake.beforeRead = null;
    fake.files.set("file:///draft.jpg", "aW1hZ2U=");
  });
  it("uploads only a readable local photo for the current account", async () => {
    expect(await stageProfilePhoto("alice", "file:///draft.jpg")).toBe(fake.path);
    expect(fake.calls).toEqual([{ name: "stageProfilePhoto", data: { base64: "aW1hZ2U=" } }]);
    await expect(stageProfilePhoto("alice", "file:///missing.jpg")).rejects.toThrow();
  });
  it("does not send a previous account's selected image after an account switch", async () => {
    fake.beforeRead = () => { fake.auth.currentUser = { uid: "bob" }; };
    await expect(stageProfilePhoto("alice", "file:///draft.jpg")).rejects.toThrow("Sign in again");
    expect(fake.calls).toHaveLength(0);
  });
  it("restores from the cloud once and reuses the local cache", async () => {
    const reference = cloudPhotoReference(fake.path);
    const [first, second] = await Promise.all([resolveProfilePhoto("alice", reference), resolveProfilePhoto("alice", reference)]);
    expect(first).toBe(second);
    expect(first).toMatch(/^file:\/\/\/cache\/profile-photos\/alice-/);
    expect(await resolveProfilePhoto("alice", reference)).toBe(first);
    expect(fake.calls.filter((call) => call.name === "getProfilePhoto")).toHaveLength(1);
  });
  it("does not mislabel a newer cloud photo as an older cached image", async () => {
    await expect(resolveProfilePhoto("alice", cloudPhotoReference(fake.path.replace("12345678", "99999999")))).rejects.toThrow("Photo changed");
  });
  it("clears both the memory and on-device cache after sign-out/deletion", async () => {
    const reference = cloudPhotoReference(fake.path);
    const cached = await resolveProfilePhoto("alice", reference);
    expect(fake.files.has(cached)).toBe(true);
    await clearProfilePhotoCache("alice");
    expect(fake.files.has(cached)).toBe(false);
    await resolveProfilePhoto("alice", reference);
    expect(fake.calls.filter((call) => call.name === "getProfilePhoto")).toHaveLength(2);
  });
  it("commits references or removal, never permanent public URLs", async () => {
    expect(await commitProfilePhoto("alice", fake.path)).toBe(cloudPhotoReference(fake.path));
    expect(await commitProfilePhoto("alice", null)).toBe("");
    expect(fake.calls.map((call) => call.name)).toEqual(["commitProfilePhoto", "commitProfilePhoto"]);
  });
});
