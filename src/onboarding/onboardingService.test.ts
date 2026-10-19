import { beforeEach, expect, it, vi } from "vitest";
import { createOnboardingUser, loadOnboardingCache, resolveOnboardingDestination, saveOnboardingStep } from "./onboardingService";
import { emptyDraft, initialProgress } from "./onboardingState";
const mocks = vi.hoisted(() => ({ uid: "fixture-a", exists: true, data: {} as Record<string, unknown>, set: vi.fn(), transaction: vi.fn(), getItem: vi.fn(), setItem: vi.fn() }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: mocks.getItem, setItem: mocks.setItem } }));
vi.mock("../config/firebaseConfig", () => ({ auth: { get currentUser() { return { uid: mocks.uid }; } }, db: {} }));
vi.mock("firebase/firestore", () => ({ doc: (_db: unknown, _collection: string, uid: string) => uid, getDoc: async () => ({ data: () => mocks.data }), runTransaction: mocks.transaction }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.uid = "fixture-a"; mocks.exists = true; mocks.data = {};
  mocks.setItem.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (_db, fn) => fn({ get: async () => ({ exists: () => mocks.exists, data: () => mocks.data }), set: mocks.set }));
});
it("rejects a failed transaction without marking local completion or mutating the draft", async () => {
  mocks.transaction.mockRejectedValue(Error("offline"));
  const draft = { ...emptyDraft, nickname: "Unsent" };
  await expect(saveOnboardingStep("fixture-a", "health", draft, false)).rejects.toThrow("offline");
  expect(draft.nickname).toBe("Unsent");
  expect(mocks.setItem).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
});
it("does not reset a profile or reopen completed onboarding on a retry", async () => {
  mocks.data = { onboarding: { ...initialProgress, completed: true }, nickname: "Saved" };
  await createOnboardingUser("fixture-a", { nickname: "replacement" });
  expect(mocks.set).not.toHaveBeenCalled();
  expect(JSON.parse(mocks.setItem.mock.calls[0][1])).toMatchObject({ progress: { completed: true }, draft: { nickname: "Saved" } });
  await expect(saveOnboardingStep("fixture-a", "experience", emptyDraft, false)).resolves.toMatchObject({ destination: "/(tabs)/home" });
  expect(mocks.set).not.toHaveBeenCalled();
});
it("merges only the current step and rejects another account", async () => {
  await saveOnboardingStep("fixture-a", "nickname", { ...emptyDraft, nickname: "  Fixture  " }, false);
  expect(mocks.set).toHaveBeenCalledWith("fixture-a", { nickname: "Fixture", onboarding: { version: 1, completed: false, step: "health" } }, { merge: true });
  mocks.set.mockClear(); mocks.uid = "fixture-b";
  await expect(saveOnboardingStep("fixture-a", "health", emptyDraft, false)).rejects.toThrow("Account changed");
  expect(mocks.set).not.toHaveBeenCalled();
});

it("keeps an account-scoped pending draft usable without a cloud read", async () => {
  const cache = { progress: { ...initialProgress, step: "nickname" }, draft: { ...emptyDraft, nickname: "Unsent" } };
  mocks.getItem.mockImplementation(async key => key.endsWith("fixture-a") ? JSON.stringify(cache) : null);
  expect(await loadOnboardingCache("fixture-a")).toEqual(cache);
  expect(await resolveOnboardingDestination("fixture-a")).toBe("/onboarding/nickname");
  expect(await resolveOnboardingDestination("fixture-b", {})).toBe("/(tabs)/home");
});
it("creates an explicit checkpoint for a new account and surfaces registration write failure", async () => {
  mocks.exists = false;
  await expect(createOnboardingUser("fixture-a", { name: "Fixture" })).resolves.toBe("/onboarding/experience");
  expect(mocks.set).toHaveBeenCalledWith("fixture-a", { name: "Fixture", onboarding: initialProgress });
  mocks.setItem.mockClear(); mocks.transaction.mockRejectedValue(Error("write denied"));
  await expect(createOnboardingUser("fixture-a", {})).rejects.toThrow("write denied");
  expect(mocks.setItem).not.toHaveBeenCalled();
});
