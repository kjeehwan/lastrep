import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";
import { loadWorkoutPlanContext } from "./loadWorkoutPlanContext";
import { getNutritionProfile, parseNutritionProfile } from "../../nutrition/meals";
import { getSleepProfile, parseSleepProfile } from "../../sleep/sleep";
import { toLocalDateKey } from "./todayPlanContext";

const fake = vi.hoisted(() => ({ users: {} as Record<string, any>, reads: vi.fn() }));
vi.mock("../../config/firebaseConfig", () => ({ db: {}, auth: {} }));
vi.mock("react-native", () => ({ Platform: { OS: "web" }, Linking: {} }));
vi.mock("expo-application", () => ({ applicationId: "test" }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("../../ui/appDialog", () => ({ confirmAppDialog: vi.fn() }));
vi.mock("firebase/firestore", async original => ({
  ...await original<typeof import("firebase/firestore")>(),
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  collection: (_db: unknown, ...path: string[]) => path.join("/"),
  query: (ref: unknown) => ref, where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
  getDoc: async (path: string) => {
    fake.reads(path);
    return { exists: () => path in fake.users, data: () => fake.users[path] };
  },
  getDocs: async () => ({ docs: [], forEach: () => {} }),
}));
const planned = { source: "draft" as const, title: "Synthetic bench", exerciseNames: ["Bench press"] };
beforeEach(() => {
  fake.users = {}; fake.reads.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-06T10:00Z"));
});
afterEach(() => vi.useRealTimers());

it("derives nutrition, sleep and recovery from one profile read", async () => {
  const now = Timestamp.now();
  fake.users["users/alice"] = {
    trainingPhase: "Strength", dietPhase: "Maintain",
    nutritionProfile: { calorieTargetsByDietPhase: { Cut: 2400, Maintain: 2900, Bulk: 3200 }, proteinTargetGrams: 150 },
    sleepSettings: { targetHours: 9 },
    sleepProfile: { latestSleepHours: 2, source: "manual", journalSummary: {
      latestSleepHours: 8, source: "health", sampleRecordedAt: now, recentNightlyHours: [],
    } },
    recoveryCheckIn: { dateKey: toLocalDateKey(new Date()), ratings: { soreness: 2, fatigue: 3, motivation: 8 }, painAnswered: true },
  };
  const result = await loadWorkoutPlanContext("alice", planned);
  expect(fake.reads.mock.calls).toEqual([["users/alice"]]);
  expect(result.inputs).toMatchObject({ trainingPhase: "Strength", sleepHours: 8, sleepSource: "health",
    soreness: 2, fatigue: 3, motivation: 8, nutrition: { calorieTarget: 2900 } });
  expect(result.sleepTargetHours).toBe(9);
});

it("preserves standalone loader parsing, including journal-summary precedence", async () => {
  const user = { nutritionProfile: { proteinTargetGrams: 150.6, mealSections: ["Lunch", "", 1] },
    sleepProfile: { latestSleepHours: 2, journalSummary: { latestSleepHours: 8, source: "manual" } } };
  fake.users["users/alice"] = user;
  expect(await getNutritionProfile("alice")).toEqual(parseNutritionProfile(user.nutritionProfile));
  expect(await getSleepProfile("alice")).toEqual(parseSleepProfile(user.sleepProfile));
  expect(parseSleepProfile(user.sleepProfile).latestSleepHours).toBe(8);
  expect(parseNutritionProfile(user.nutritionProfile)).toMatchObject({ proteinTargetGrams: 151, mealSections: ["Lunch"] });
});

it("retains defaults without carrying another account's targets", async () => {
  fake.users["users/alice"] = { sleepSettings: { targetHours: 9 } };
  fake.users["users/bob"] = {};
  expect((await loadWorkoutPlanContext("alice", planned)).sleepTargetHours).toBe(9);
  const bob = await loadWorkoutPlanContext("bob", planned);
  expect(bob.sleepTargetHours).toBe(7);
  expect(bob.inputs.sleepHours).toBe(7);
  expect(bob.inputs.nutrition?.calorieTarget).toBeNull();
  expect(fake.reads.mock.calls).toEqual([["users/alice"], ["users/bob"]]);
});

it("rejects missing accounts rather than deriving a fabricated profile", async () => {
  await expect(loadWorkoutPlanContext("missing", planned)).rejects.toThrow("profile is unavailable");
});
