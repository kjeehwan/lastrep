import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearProfilePhotoCache, commitProfilePhoto, resolveProfilePhoto, saveProfilePhotoOnly, stageProfilePhoto } from "./profilePhotos";
import { cloudPhotoReference } from "./profilePhotoReference";

const fake = vi.hoisted(() => ({
  auth: { currentUser: { uid: "alice" } as { uid: string } | null },
  files: new Map<string, string>(),
  calls: [] as { name: string; data: unknown }[],
  path: "users/alice/profile-photos/12345678-1234-1234-1234-123456789abc.jpg",
  beforeRead: null as (() => void) | null,
  failCommit: false,
  stageResponse: null as Promise<unknown> | null,
}));
vi.mock("../config/firebaseConfig", () => ({ auth: fake.auth }));
vi.mock("./prepareProfilePhoto", async () => ({
  prepareProfilePhotoUpload: async (uri: string) => {
    const files = await import("expo-file-system/legacy");
    return files.readAsStringAsync(uri, { encoding: files.EncodingType.Base64 });
  },
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("firebase/app", () => ({ getApp: () => ({}) }));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: (_functions: unknown, name: string) => async (data: unknown) => {
    fake.calls.push({ name, data });
    if (name === "stageProfilePhoto" && fake.stageResponse) return fake.stageResponse;
    if (name === "getProfilePhoto") return { data: { path: fake.path, base64: "aW1hZ2U=" } };
    if (name === "commitProfilePhoto" && fake.failCommit) throw new Error("Commit failed");
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
    fake.files.clear(); fake.calls.length = 0; fake.beforeRead = null; fake.failCommit = false;
    fake.stageResponse = null;
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
  it("commits a staged photo-only save using the deployed two-call flow", async () => {
    expect(await saveProfilePhotoOnly("alice", "file:///draft.jpg")).toBe(cloudPhotoReference(fake.path));
    expect(fake.calls.map((call) => call.name)).toEqual(["stageProfilePhoto", "commitProfilePhoto"]);
  });
  it("does not commit an interrupted upload and can retry the same selected file", async () => {
    let interrupt!: (error: Error) => void;
    fake.stageResponse = new Promise((_resolve, reject) => { interrupt = reject; });
    const save = saveProfilePhotoOnly("alice", "file:///draft.jpg");
    const failed = expect(save).rejects.toThrow("Network request failed");
    await vi.waitFor(() => expect(fake.calls.map((call) => call.name)).toEqual(["stageProfilePhoto"]));
    interrupt(new Error("Network request failed"));
    await failed;
    expect(fake.calls.map((call) => call.name)).toEqual(["stageProfilePhoto"]);
    expect(fake.files.get("file:///draft.jpg")).toBe("aW1hZ2U=");
    fake.stageResponse = null;
    expect(await saveProfilePhotoOnly("alice", "file:///draft.jpg")).toBe(cloudPhotoReference(fake.path));
    expect(fake.calls.map((call) => call.name)).toEqual(["stageProfilePhoto", "stageProfilePhoto", "commitProfilePhoto"]);
  });
  it("discards the staged upload when commit fails", async () => {
    fake.failCommit = true;
    await expect(saveProfilePhotoOnly("alice", "file:///draft.jpg")).rejects.toThrow("Commit failed");
    expect(fake.calls.map((call) => call.name)).toEqual(["stageProfilePhoto", "commitProfilePhoto", "discardProfilePhotoUpload"]);
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
