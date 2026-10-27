import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";
const host = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!host)("sharing security rules", () => {
  let environment: RulesTestEnvironment;
  beforeAll(async () => {
    const [address, port] = host!.split(":");
    environment = await initializeTestEnvironment({
      projectId: "demo-lastrep-sharing-rules",
      firestore: {
        host: address,
        port: Number(port),
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
    await environment.withSecurityRulesDisabled(async (context) => {
      for (const path of [
        "users/owner/sharing/settings",
        "users/owner/sharingInbox/delivery",
        "users/owner/sharingSent/send",
        "users/owner/sharingLinks/link",
        "workoutShareSnapshots/snapshot",
        "sharingDirectory/owner",
        "sharingUsernames/example",
        "workoutShareLinks/token",
      ])
        await setDoc(doc(context.firestore(), path), { fixture: true });
    });
  });
  afterAll(async () => {
    await environment?.cleanup();
  });
  it("lets only the owner read private preferences and delivery metadata", async () => {
    for (const path of [
      "users/owner/sharing/settings",
      "users/owner/sharingInbox/delivery",
      "users/owner/sharingSent/send",
    ]) {
      await assertSucceeds(
        getDoc(
          doc(environment.authenticatedContext("owner").firestore(), path),
        ),
      );
      await assertFails(
        getDoc(
          doc(environment.authenticatedContext("stranger").firestore(), path),
        ),
      );
      await assertFails(
        setDoc(
          doc(environment.authenticatedContext("owner").firestore(), path),
          { unreadCount: 100, enabled: true },
        ),
      );
    }
  });
  it("requires the callable authorization boundary for snapshots, search, claims and bearer tokens", async () => {
    for (const path of [
      "users/owner/sharingLinks/link",
      "workoutShareSnapshots/snapshot",
      "sharingDirectory/owner",
      "sharingUsernames/example",
      "workoutShareLinks/token",
    ]) {
      await assertFails(
        getDoc(
          doc(environment.authenticatedContext("owner").firestore(), path),
        ),
      );
      await assertFails(
        getDoc(doc(environment.unauthenticatedContext().firestore(), path)),
      );
      await assertFails(
        setDoc(
          doc(environment.authenticatedContext("owner").firestore(), path),
          { fixture: false },
        ),
      );
    }
  });
});
