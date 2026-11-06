import { beforeEach, expect, it, vi } from "vitest";
import { executeSleepCommand } from "./sleepJournal";

const fake = vi.hoisted(() => ({ changed: false, transactions: 0, writes: vi.fn() }));
vi.mock("../config/firebaseConfig", () => ({ db: {} }));
vi.mock("./sleepMutationScope", () => ({ prepareSleepCommand: async () => ({
  stored: [], next: [], days: [], summary: { latestSleepHours: null, recentNightlyHours: [] },
}) }));
vi.mock("firebase/firestore", async original => ({
  ...await original<typeof import("firebase/firestore")>(),
  doc: () => ({}), collection: () => ({}),
  getDocFromServer: async () => ({ data: () => ({ sleepProfile: {
    journalRevision: 2, journalSummary: { latestSleepHours: 8, source: "health", recentNightlyHours: [] },
  } }) }),
  runTransaction: async (_db: unknown, update: (tx: unknown) => Promise<unknown>) => {
    fake.transactions++;
    return update({ get: async () => ({ data: () => ({ sleepProfile: {
      journalRevision: 2, journalSummary: { recentNightlyHours: [], source: "health", latestSleepHours: fake.changed ? 7 : 8 },
    } }) }), set: fake.writes, delete: vi.fn() });
  },
}));
beforeEach(() => { fake.changed = false; fake.transactions = 0; fake.writes.mockClear(); });
const command = { kind: "health" as const, incoming: [], deletedIds: [], device: "test" };
it("commits a sync when the server and transaction return the same maps in different orders", async () => {
  await expect(executeSleepCommand("test", command)).resolves.toMatchObject({ revision: 3 });
  expect(fake.transactions).toBe(1);
  expect(fake.writes).toHaveBeenCalledOnce();
});
it("continues to reject a genuinely changed summary even without a revision increment", async () => {
  fake.changed = true;
  await expect(executeSleepCommand("test", command)).rejects.toThrow("changed on another device");
  expect(fake.transactions).toBe(4);
  expect(fake.writes).not.toHaveBeenCalled();
});
