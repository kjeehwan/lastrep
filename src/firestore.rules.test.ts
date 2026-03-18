import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ENTITLEMENT_DEV_OVERRIDE_POLICY,
  ENTITLEMENT_FIELDS,
  USER_ENTITLEMENT_FIELD,
  USERS_COLLECTION,
} from "./contracts";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const describeIfFirestoreEmulator = emulatorHost ? describe : describe.skip;

const [host, portValue] = (emulatorHost ?? "127.0.0.1:8080").split(":");
const port = Number(portValue ?? 8080);
const projectId = "lastrep-firestore-rules";
const rules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

const buildCanonicalEntitlement = () => ({
  [ENTITLEMENT_FIELDS.isSubscribed]: true,
  [ENTITLEMENT_FIELDS.source]: "revenuecat",
  [ENTITLEMENT_FIELDS.productId]: "lastrep_premium_monthly",
  [ENTITLEMENT_FIELDS.expiresAt]: Timestamp.fromMillis(1_700_000_000_000),
  [ENTITLEMENT_FIELDS.lastEventId]: "evt_123",
  [ENTITLEMENT_FIELDS.lastEventTimestampMs]: 1_700_000_000_000,
  [ENTITLEMENT_FIELDS.lastUpdatedAt]: Timestamp.fromMillis(1_700_000_000_500),
});

describeIfFirestoreEmulator("firestore entitlement rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host,
        port,
        rules,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("documents the emulator-only dev override policy", () => {
    expect(ENTITLEMENT_DEV_OVERRIDE_POLICY).toBe("emulator_only");
  });

  it("fails when a client creates a user document with entitlement", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();

    await assertFails(
      setDoc(doc(db, USERS_COLLECTION, "alice"), {
        nickname: "Alice",
        [USER_ENTITLEMENT_FIELD]: buildCanonicalEntitlement(),
      })
    );
  });

  it("passes when a client creates a user document without entitlement", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();

    await assertSucceeds(
      setDoc(doc(db, USERS_COLLECTION, "alice"), {
        nickname: "Alice",
        usage: { decisions: { dailyCount: 0 } },
      })
    );
  });

  it("passes when a client updates only non-entitlement fields and preserves entitlement", async () => {
    const entitlement = buildCanonicalEntitlement();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), USERS_COLLECTION, "alice"), {
        nickname: "Alice",
        [USER_ENTITLEMENT_FIELD]: entitlement,
      });
    });

    const db = testEnv.authenticatedContext("alice").firestore();
    const ref = doc(db, USERS_COLLECTION, "alice");

    await assertSucceeds(
      updateDoc(ref, {
        nickname: "Alice Updated",
      })
    );

    const snap = await getDoc(ref);

    expect(snap.data()?.[USER_ENTITLEMENT_FIELD]).toEqual(entitlement);
  });

  it("fails when a client updates entitlement", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), USERS_COLLECTION, "alice"), {
        nickname: "Alice",
        [USER_ENTITLEMENT_FIELD]: buildCanonicalEntitlement(),
      });
    });

    const db = testEnv.authenticatedContext("alice").firestore();

    await assertFails(
      updateDoc(doc(db, USERS_COLLECTION, "alice"), {
        [`${USER_ENTITLEMENT_FIELD}.${ENTITLEMENT_FIELDS.isSubscribed}`]: false,
      })
    );
  });

  it("allows the owning client to read entitlement", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), USERS_COLLECTION, "alice"), {
        [USER_ENTITLEMENT_FIELD]: buildCanonicalEntitlement(),
      });
    });

    const db = testEnv.authenticatedContext("alice").firestore();
    const snap = await getDoc(doc(db, USERS_COLLECTION, "alice"));

    expect(snap.exists()).toBe(true);
    expect(snap.data()?.[USER_ENTITLEMENT_FIELD]?.[ENTITLEMENT_FIELDS.isSubscribed]).toBe(true);
  });

  it("allows admin writes to entitlement", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await assertSucceeds(
        setDoc(doc(context.firestore(), USERS_COLLECTION, "alice"), {
          [USER_ENTITLEMENT_FIELD]: buildCanonicalEntitlement(),
        })
      );
    });
  });
});
