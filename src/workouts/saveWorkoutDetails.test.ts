import { beforeEach, expect, it, vi } from "vitest";
import { saveWorkoutDetails } from "./saveWorkoutDetails";
import { detailsDraft } from "./workoutDetails";
const mock = vi.hoisted(() => ({ user: { uid: "test-user" } as { uid: string } | null,
  exists: true, data: {} as Record<string, unknown>, update: vi.fn(), failure: false }));
vi.mock("../config/firebaseConfig", () => ({ auth: { get currentUser() { return mock.user; } }, db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join("/"), serverTimestamp: () => "server-time",
  Timestamp: { fromDate: (date: Date) => ({ toDate: () => date }) },
  runTransaction: async (_db: unknown, callback: (transaction: unknown) => Promise<void>) => {
    if (mock.failure) throw Object.assign(new Error("Offline"), { code: "unavailable" });
    return callback({ get: async () => ({ exists: () => mock.exists, data: () => mock.data }), update: mock.update });
  },
}));
const original = { date: new Date(2026, 8, 12, 8, 45), durationMin: 62 };
beforeEach(() => {
  mock.user = { uid: "test-user" }; mock.exists = true; mock.failure = false; mock.update.mockClear();
  mock.data = { date: { toDate: () => original.date }, durationMin: 62, exercises: [{ name: "Keep these sets" }], createdAt: "original", recommendationHelpful: true };
});
it("patches only changed metadata on the same document", async () => {
  await saveWorkoutDetails("test-user", "workout-1", original, { ...detailsDraft(original), minutes: "20" });
  expect(mock.update).toHaveBeenCalledExactlyOnceWith("users/test-user/workouts/workout-1", { durationMin: 80, updatedAt: "server-time" });
  expect(mock.data.exercises).toEqual([{ name: "Keep these sets" }]);
});
it("refuses stale details and deleted records without recreating them", async () => {
  mock.data.durationMin = 99;
  await expect(saveWorkoutDetails("test-user", "workout-1", original, { ...detailsDraft(original), minutes: "20" })).rejects.toThrow("changed elsewhere");
  mock.exists = false;
  await expect(saveWorkoutDetails("test-user", "workout-1", original, { ...detailsDraft(original), minutes: "20" })).rejects.toThrow("deleted");
  expect(mock.update).not.toHaveBeenCalled();
});
it("refuses an account switch", async () => {
  mock.user = { uid: "different-account" };
  await expect(saveWorkoutDetails("test-user", "workout-1", original, { ...detailsDraft(original), minutes: "20" })).rejects.toThrow("account changed");
  expect(mock.update).not.toHaveBeenCalled();
});
it("allows retry after a failed transaction without a queued overwrite", async () => {
  mock.failure = true; const draft = { ...detailsDraft(original), minutes: "20" };
  await expect(saveWorkoutDetails("test-user", "workout-1", original, draft)).rejects.toThrow("Offline");
  expect(mock.update).not.toHaveBeenCalled(); mock.failure = false;
  await saveWorkoutDetails("test-user", "workout-1", original, draft); expect(mock.update).toHaveBeenCalledTimes(1);
});
