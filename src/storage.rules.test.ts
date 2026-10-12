import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails } from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes } from "firebase/storage";
import { describe, it } from "vitest";

const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const describeWithStorage = host ? describe : describe.skip;

describeWithStorage("private photo storage rules", () => {
  it("denies direct photo uploads/downloads even to a signed-in owner", async () => {
    const [hostname, port] = (host ?? "127.0.0.1:9199").split(":");
    const environment = await initializeTestEnvironment({ projectId: "demo-lastrep-photos", storage: {
      host: hostname, port: Number(port), rules: readFileSync("storage.rules", "utf8"),
    } });
    try {
      const owner = environment.authenticatedContext("alice").storage();
      const path = "users/alice/profile-photos/example.jpg";
      await environment.withSecurityRulesDisabled(async (context) => {
        await uploadBytes(ref(context.storage(), path), new Uint8Array([1, 2, 3]));
      });
      await assertFails(uploadBytes(ref(owner, path), new Uint8Array([1])));
      await assertFails(getBytes(ref(owner, path)));
      await assertFails(getBytes(ref(environment.unauthenticatedContext().storage(), path)));
    } finally {
      await environment.cleanup();
    }
  });
});
