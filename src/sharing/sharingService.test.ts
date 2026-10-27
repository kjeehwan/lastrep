import { sendWorkoutInLastrep, sharingError } from "./sharingService";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SharedWorkoutPlan } from "./sharingContract";
const fake = vi.hoisted(() => ({
  uid: "local-test-user",
  store: new Map<string, string>(),
  dispatch: vi.fn(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => fake.store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      fake.store.set(key, value);
    },
    removeItem: async (key: string) => {
      fake.store.delete(key);
    },
  },
}));
vi.mock("firebase/app", () => ({ getApp: () => ({}) }));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ currentUser: { uid: fake.uid } }),
}));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: () => fake.dispatch,
}));
const plan: SharedWorkoutPlan = {
  version: 1,
  title: "Local example",
  effortScale: "rpe",
  exercises: [
    {
      name: "Squat",
      mode: "resistance",
      unit: "kg",
      restSec: 90,
      tempo: "",
      instructions: "",
      sets: [
        {
          weightKg: 40,
          reps: "8",
          targetRpe: null,
          setType: "normal",
          durationSec: null,
          distanceKm: null,
        },
      ],
    },
  ],
};
describe("persistent send intent", () => {
  beforeEach(() => {
    fake.store.clear();
    fake.dispatch.mockReset();
    fake.uid = "local-test-user";
  });
  it("asks for a new sharing link after expiry or revocation rather than suggesting a network retry", () => {
    expect(
      sharingError({
        code: "functions/not-found",
        message: "This sharing link is unavailable.",
      }),
    ).toContain("Ask the sender");
    expect(sharingError({ code: "functions/unavailable" })).toContain(
      "try again later",
    );
  });
  it("reuses the original ID after an uncertain response, including a later reopening", async () => {
    fake.dispatch
      .mockRejectedValueOnce(Error("Connection lost"))
      .mockResolvedValueOnce({ data: { recipients: [] } });
    await expect(
      sendWorkoutInLastrep(fake.uid, plan, ["recipient"]),
    ).rejects.toThrow("Connection lost");
    const first = fake.dispatch.mock.calls[0][0];
    expect(fake.store.size).toBe(1);
    await sendWorkoutInLastrep(fake.uid, plan, ["recipient"]);
    expect(fake.dispatch.mock.calls[1][0].requestId).toBe(first.requestId);
    expect(fake.dispatch.mock.calls[1][0].intentCreatedAtMs).toBe(
      first.intentCreatedAtMs,
    );
    expect(fake.store.size).toBe(0);
  });
  it("allows intentional repeated sends after a confirmed result", async () => {
    fake.dispatch.mockResolvedValue({ data: { recipients: [] } });
    await sendWorkoutInLastrep(fake.uid, plan, ["recipient"]);
    await sendWorkoutInLastrep(fake.uid, plan, ["recipient"]);
    expect(fake.dispatch.mock.calls[0][0].requestId).not.toBe(
      fake.dispatch.mock.calls[1][0].requestId,
    );
  });
  it("prevents a draft from being sent by another account", async () => {
    await expect(
      sendWorkoutInLastrep("different-user", plan, ["recipient"]),
    ).rejects.toThrow("Sign in");
    expect(fake.dispatch).not.toHaveBeenCalled();
  });
  it("starts a fresh intent when the user deliberately sends after the old retry window", async () => {
    fake.store.set(
      `workout-sharing-send-v1:${fake.uid}`,
      JSON.stringify({
        signature: JSON.stringify({ plan, recipients: ["recipient"] }),
        id: "expired-old-request",
        createdAtMs: Date.now() - 31 * 86400_000,
      }),
    );
    fake.dispatch.mockResolvedValue({ data: { recipients: [] } });
    await sendWorkoutInLastrep(fake.uid, plan, ["recipient"]);
    expect(fake.dispatch.mock.calls[0][0].requestId).not.toBe(
      "expired-old-request",
    );
    expect(fake.dispatch.mock.calls[0][0].intentCreatedAtMs).toBeGreaterThan(
      Date.now() - 10_000,
    );
  });
});
