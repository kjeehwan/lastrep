import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import type { NutritionMeal, NutritionSavedMeal } from "../contracts";
import { createMeal, saveNutritionProfile, saveSectionMealTime, updateMeal } from "./meals";
import { addSavedMealToDate, copyPreviousMealToDate } from "./quickLog";

const mocks = vi.hoisted(() => ({
  addDoc: vi.fn(), setDoc: vi.fn(), getDocs: vi.fn(),
  batch: { set: vi.fn(), update: vi.fn(), commit: vi.fn() },
}));
vi.mock("../config/firebaseConfig", () => ({ db: {} }));
vi.mock("firebase/firestore", async (original) => ({
  ...await original<typeof import("firebase/firestore")>(),
  collection: vi.fn(() => ({})), doc: vi.fn((...args) => ({ path: args.slice(1).join("/") })),
  query: vi.fn(() => ({})), where: vi.fn(), orderBy: vi.fn(),
  addDoc: mocks.addDoc, setDoc: mocks.setDoc, getDocs: mocks.getDocs,
  writeBatch: vi.fn(() => mocks.batch),
}));

const date = new Date(2026, 9, 15, 18, 32);
function meal(minutes: number | null = 480, day = 15): NutritionMeal {
  const timestamp = Timestamp.fromDate(new Date(2026, 9, day, 8));
  return { id: "meal-id", name: "Oats", calories: 190, proteinGrams: 5, mealSection: "Breakfast",
    loggedAt: timestamp, updatedAt: timestamp, mealTimeMinutes: minutes };
}
function snapshot(meals: NutritionMeal[]) {
  return { docs: meals.map(({ id, ...data }) => ({ id, data: () => data })) };
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(date); vi.clearAllMocks();
  mocks.getDocs.mockResolvedValue(snapshot([]));
  mocks.batch.commit.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("meal organization persistence", () => {
  it("does not clear meal sections when Profile only saves nutrition targets", async () => {
    await saveNutritionProfile("uid", { Cut: 1800, Maintain: 2200, Bulk: 2500 }, 150);
    expect(mocks.setDoc.mock.calls[0][1].nutritionProfile).not.toHaveProperty("mealSections");
    expect(mocks.setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });
  it("still saves explicit meal ordering changes from Nutrition", async () => {
    await saveNutritionProfile("uid", { Cut: 1800, Maintain: 2200, Bulk: 2500 }, 150, ["Lunch", "Breakfast"]);
    expect(mocks.setDoc.mock.calls[0][1].nutritionProfile.mealSections).toEqual(["Lunch", "Breakfast"]);
  });
  it("gives new items creation metadata and current meal time without altering their date", async () => {
    const { id: _id, ...payload } = meal();
    await createMeal("uid", payload, []);
    expect(mocks.addDoc.mock.calls[0][1]).toMatchObject({ loggedAt: payload.loggedAt, mealTimeMinutes: 1112, createdAt: Timestamp.now() });
    expect(mocks.getDocs).not.toHaveBeenCalled();
  });
  it("inherits edited time when adding food and leaves legacy meals unset", async () => {
    const { id: _id, ...payload } = meal();
    await createMeal("uid", payload, [meal(720)]);
    expect(mocks.addDoc.mock.calls[0][1].mealTimeMinutes).toBe(720);
    await createMeal("uid", payload, [meal(null)]);
    expect(mocks.addDoc.mock.calls[1][1].mealTimeMinutes).toBeNull();
  });
  it("edits every existing item's meal time atomically without rewriting nutrition, dates or creation time", async () => {
    await saveSectionMealTime("uid", [meal(), { ...meal(), id: "second" }], 0);
    expect(mocks.batch.update).toHaveBeenCalledTimes(2);
    expect(mocks.batch.update.mock.calls[0][1]).toEqual({ mealTimeMinutes: 0, updatedAt: Timestamp.now() });
    expect(mocks.batch.commit).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid meal times without writes", async () => {
    await expect(saveSectionMealTime("uid", [meal()], 1440)).rejects.toThrow();
    await expect(saveSectionMealTime("uid", [], 480)).rejects.toThrow();
    expect(mocks.batch.commit).not.toHaveBeenCalled();
  });
  it("quantity edits merge without replacing meal-time or creation metadata", async () => {
    const { id: _id, mealTimeMinutes: _time, ...payload } = meal();
    await updateMeal("uid", "meal-id", { ...payload, calories: 300 });
    expect(mocks.setDoc.mock.calls[0][1]).not.toHaveProperty("mealTimeMinutes");
    expect(mocks.setDoc.mock.calls[0][2]).toEqual({ merge: true });
  });
  it("saved meals use insertion time rather than the source's old meal time", async () => {
    const saved: NutritionSavedMeal = { id: "saved", name: "Oats", items: [{ name: "Oats", calories: 190, proteinGrams: 5, carbGrams: 30, fatGrams: 3, source: null }], createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    await addSavedMealToDate("uid", saved, "Breakfast", new Date(2026, 9, 12));
    const payload = mocks.batch.set.mock.calls[0][1];
    expect(payload.mealTimeMinutes).toBe(1112);
    expect(payload.loggedAt.toDate().getDate()).toBe(12);
    expect(payload.createdAt).toEqual(Timestamp.now());
  });
  it("copying a prior meal uses copy time for an empty destination", async () => {
    mocks.getDocs.mockResolvedValue(snapshot([meal(480, 14)]));
    await copyPreviousMealToDate("uid", "Breakfast", date);
    const payload = mocks.batch.set.mock.calls[0][1];
    expect(payload.mealTimeMinutes).toBe(1112);
    expect(payload.loggedAt.toDate().getDate()).toBe(15);
  });
  it("copying into a meal with an edited time preserves that time", async () => {
    mocks.getDocs.mockResolvedValue(snapshot([meal(480, 14), meal(900)]));
    await copyPreviousMealToDate("uid", "Breakfast", date);
    expect(mocks.batch.set.mock.calls[0][1].mealTimeMinutes).toBe(900);
  });
});
