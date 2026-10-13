import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { CRC32C } from "@google-cloud/storage";

const fake = vi.hoisted(() => {
  const records = new Map<string, Record<string, unknown>>();
  const files = new Map<string, Buffer>();
  const writes: { path: string; bytes: Buffer; options: Record<string, unknown> }[] = [];
  let failWrite = false;
  let failDelete = false;
  let afterWrite: (() => void) | null = null;
  const snap = (path: string) => ({ exists: records.has(path), data: () => records.get(path) });
  const ref = (path: string) => ({
    path,
    get: async () => snap(path),
    set: async (data: Record<string, unknown>) => { records.set(path, data); },
    delete: async () => { records.delete(path); },
  });
  const db = {
    doc: ref,
    collection: (path: string) => ({ doc: (id: string) => ref(`${path}/${id}`), limit: () => ({ get: async () => ({ empty: ![...records.keys()].some((key) => key.startsWith(`${path}/`)) }) }) }),
    runTransaction: async (callback: (tx: unknown) => unknown) => {
      const pending: (() => void)[] = [];
      let wrote = false;
      const result = await callback({
        get: async (r: { path: string }) => { if (wrote) throw new Error("Read after write"); return snap(r.path); },
        set: (r: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => {
          wrote = true;
          pending.push(() => records.set(r.path, options?.merge ? { ...records.get(r.path), ...data } : data));
        },
        update: (r: { path: string }, data: Record<string, unknown>) => {
          wrote = true;
          pending.push(() => records.set(r.path, { ...records.get(r.path), ...data }));
        },
      });
      pending.forEach((apply) => apply());
      return result;
    },
  };
  const bucket = {
    getMetadata: async () => [{ iamConfiguration: { uniformBucketLevelAccess: { enabled: false } } }],
    file: (path: string) => ({
      save: async (bytes: Buffer, options: Record<string, unknown>) => {
        if (failWrite) throw new Error("Upload failed");
        files.set(path, bytes); writes.push({ path, bytes, options }); afterWrite?.();
      },
      download: async () => {
        if (!files.has(path)) throw new Error("Not found");
        return [files.get(path)];
      },
      delete: async () => { if (failDelete) throw new Error("Delete failed"); files.delete(path); },
    }),
    deleteFiles: async ({ prefix }: { prefix: string }) => { for (const path of files.keys()) if (path.startsWith(prefix)) files.delete(path); },
  };
  return { records, files, writes, db, bucket,
    reset: () => { records.clear(); files.clear(); writes.length = 0; failWrite = false; failDelete = false; afterWrite = null; },
    failWrite: () => { failWrite = true; },
    failDelete: () => { failDelete = true; },
    afterWrite: (fn: () => void) => { afterWrite = fn; },
  };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => fake.db,
  Timestamp: { now: () => ({ toMillis: () => Date.now() }), fromMillis: (ms: number) => ({ toMillis: () => ms }) },
}));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => fake.bucket }) }));

import { commitProfilePhoto, deleteProfilePhotosForAccount, discardProfilePhotoUpload, getProfilePhoto, stageProfilePhoto } from "./profilePhotos";

const context = { auth: { uid: "alice", token: {} } };
const call = (fn: unknown, data: unknown, ctx: unknown = context): Promise<Record<string, unknown>> =>
  (fn as { run: (data: unknown, context: unknown) => Promise<Record<string, unknown>> }).run(data, ctx);

async function stage() {
  const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: "red" } }).jpeg().withMetadata().toBuffer();
  return (await call(stageProfilePhoto, { base64: bytes.toString("base64") })).path as string;
}

describe("private cloud photo backend", () => {
  beforeEach(() => {
    fake.reset();
    fake.records.set("users/alice", { nickname: "Alice", profilePhotoUri: "file:///legacy.jpg" });
  });
  it("rejects unauthenticated requests on every callable", async () => {
    for (const fn of [stageProfilePhoto, commitProfilePhoto, discardProfilePhotoUpload, getProfilePhoto]) {
      await expect(call(fn, {}, {})).rejects.toMatchObject({ code: "unauthenticated" });
    }
  });
  it("omits object ACLs when uniform bucket-level access is enabled", async () => {
    vi.spyOn(fake.bucket, "getMetadata").mockResolvedValueOnce([
      { iamConfiguration: { uniformBucketLevelAccess: { enabled: true } } },
    ]);
    await stage();
    expect(fake.writes[0].options).not.toHaveProperty("predefinedAcl");
    expect(fake.writes[0].options.validation).toBe("crc32c");
  });
  it("normalizes to a small JPEG without EXIF and provides the correct CRC32C", async () => {
    await stage();
    const upload = fake.writes[0];
    const metadata = await sharp(upload.bytes).metadata();
    expect(metadata).toMatchObject({ width: 512, height: 512, format: "jpeg" });
    expect(metadata.exif).toBeUndefined();
    expect(upload.options.validation).toBe("crc32c");
    expect(upload.options.predefinedAcl).toBe("private");
    const crc = new CRC32C(); crc.update(upload.bytes);
    expect((upload.options.metadata as Record<string, unknown>).crc32c).toBe(crc.toString());
    expect(fake.records.get("users/alice")?.profilePhotoUri).toBe("file:///legacy.jpg");
  });
  it("commits only after staging, supports authenticated restoration, and retries idempotently", async () => {
    const path = await stage();
    await call(commitProfilePhoto, { path });
    expect(fake.records.get("users/alice")?.profilePhotoPath).toBe(path);
    expect(fake.records.get("users/alice")?.profilePhotoUri).toBe("");
    expect((await call(getProfilePhoto, {})).base64).toBe(fake.files.get(path)!.toString("base64"));
    await call(commitProfilePhoto, { path });
    expect(fake.files.has(path)).toBe(true);
  });
  it("discard deletes a staged image but never an active image", async () => {
    const discarded = await stage();
    await call(discardProfilePhotoUpload, { path: discarded });
    expect(fake.files.has(discarded)).toBe(false);
    const active = await stage();
    await call(commitProfilePhoto, { path: active });
    await call(discardProfilePhotoUpload, { path: active });
    expect(fake.files.has(active)).toBe(true);
  });
  it("replaces/removes photos and also clears a legacy-only photo", async () => {
    await call(commitProfilePhoto, { path: null });
    expect(fake.records.get("users/alice")?.profilePhotoUri).toBe("");
    const first = await stage(); await call(commitProfilePhoto, { path: first });
    const second = await stage(); await call(commitProfilePhoto, { path: second });
    expect(fake.files.has(first)).toBe(false);
    expect(fake.files.has(second)).toBe(true);
    await call(commitProfilePhoto, { path: null });
    expect(fake.files.has(second)).toBe(false);
  });
  it("rejects another account's paths, traversal, and unregistered uploads", async () => {
    const path = await stage();
    await expect(call(commitProfilePhoto, { path }, { auth: { uid: "bob" } })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(call(discardProfilePhotoUpload, { path: path.replace("profile-photos/", "profile-photos/../") })).rejects.toMatchObject({ code: "invalid-argument" });
    await expect(call(commitProfilePhoto, { path: path.replace(/[^/]+$/, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg") })).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("rejects invalid images and upload floods", async () => {
    await expect(call(stageProfilePhoto, { base64: Buffer.from("not a photo").toString("base64") })).rejects.toMatchObject({ code: "invalid-argument" });
    fake.records.set("users/alice/private/profilePhotoRateLimit", { startedAtMs: Date.now(), count: 12 });
    await expect(stage()).rejects.toMatchObject({ code: "resource-exhausted" });
  });
  it("failed uploads do not change the active reference", async () => {
    const first = await stage(); await call(commitProfilePhoto, { path: first });
    fake.failWrite();
    await expect(stage()).rejects.toThrow("Upload failed");
    expect(fake.records.get("users/alice")?.profilePhotoPath).toBe(first);
    expect(fake.files.has(first)).toBe(true);
  });
  it("cleanup failure does not undo a successful replacement and remains retryable", async () => {
    const first = await stage(); await call(commitProfilePhoto, { path: first });
    const second = await stage(); fake.failDelete();
    await call(commitProfilePhoto, { path: second });
    expect(fake.records.get("users/alice")?.profilePhotoPath).toBe(second);
    const old = [...fake.records.values()].find((entry) => entry.path === first);
    expect(old?.status).toBe("deleting");
  });
  it("blocks commits claimed by cleanup or expired", async () => {
    const path = await stage();
    const entry = [...fake.records.values()].find((record) => record.path === path)!;
    entry.status = "deleting";
    await expect(call(commitProfilePhoto, { path })).rejects.toMatchObject({ code: "failed-precondition" });
    entry.status = "staged"; entry.createdAt = { toMillis: () => 0 };
    await expect(call(commitProfilePhoto, { path })).rejects.toMatchObject({ code: "failed-precondition" });
  });
  it("cleans an in-flight upload when account deletion starts", async () => {
    fake.afterWrite(() => fake.records.set("users/alice", { profilePhotoDeletionStartedAt: true }));
    await expect(stage()).rejects.toMatchObject({ code: "failed-precondition" });
    expect(fake.files.size).toBe(0);
    expect([...fake.records.keys()].some((key) => key.includes("profilePhotoUploads"))).toBe(false);
  });
  it("account cleanup removes active and staged photos only within the owner's prefix", async () => {
    const path = await stage(); await call(commitProfilePhoto, { path }); await stage();
    fake.files.set("users/bob/profile-photos/other.jpg", Buffer.from("other"));
    await deleteProfilePhotosForAccount("alice");
    expect([...fake.files.keys()]).toEqual(["users/bob/profile-photos/other.jpg"]);
  });
});
