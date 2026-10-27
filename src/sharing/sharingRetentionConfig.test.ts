import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("keeps counter-sensitive Inbox cleanup transactional while enabling TTL for other expiring data", () => {
  const config = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
  const inbox = config.fieldOverrides.find(
    (field: any) =>
      field.collectionGroup === "sharingInbox" &&
      field.fieldPath === "expiresAt",
  );
  expect(inbox.ttl).not.toBe(true);
  expect(inbox.indexes.map((index: any) => index.queryScope).sort()).toEqual([
    "COLLECTION",
    "COLLECTION_GROUP",
  ]);
  for (const group of [
    "workoutShareSnapshots",
    "sharingSent",
    "sharingLinks",
    "sharingReceipts",
    "workoutShareLinks",
  ])
    expect(
      config.fieldOverrides.find(
        (field: any) =>
          field.collectionGroup === group && field.fieldPath === "expiresAt",
      )?.ttl,
    ).toBe(true);
});
it("keeps the native and deployed-server payload contracts identical", () => {
  const native = readFileSync(
    "src/sharing/sharingContract.ts",
    "utf8",
  ).replaceAll("\r\n", "\n");
  const backend = readFileSync(
    "functions/src/workoutSharingContract.ts",
    "utf8",
  ).replaceAll("\r\n", "\n");
  expect(backend).toBe(
    "// Generated from src/sharing/sharingContract.ts. Run npm --prefix functions run build.\n" +
      native,
  );
});
