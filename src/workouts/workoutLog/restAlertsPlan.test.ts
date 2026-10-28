import { describe, expect, it } from "vitest";
import { restAlertsPlan, shouldPlayForegroundRest } from "./restAlertsPlan";

describe("native rest alert plan", () => {
  it("uses absolute deadlines and excludes paused, reset and deleted exercises", () => {
    expect(restAlertsPlan({ a: { running: true, remainingSec: 10, endsAtMs: 20000 }, b: { running: false, remainingSec: 10 }, deleted: { running: true, remainingSec: 5, endsAtMs: 15000 }, invalid: { running: true, remainingSec: 5, endsAtMs: NaN } }, [{ id: "a", name: "Bench Press" }, { id: "b", name: "Row" }, { id: "invalid", name: "Invalid" }])).toEqual([{ id: "a", name: "Bench Press", deadline: 20000 }]);
  });
  it("does not move the alert deadline when the visible countdown refreshes", () => {
    const exercises = [{ id: "a", name: "Bench Press" }];
    expect(restAlertsPlan({ a: { running: true, remainingSec: 9, endsAtMs: 20000 } }, exercises)).toEqual(restAlertsPlan({ a: { running: true, remainingSec: 10, endsAtMs: 20000 } }, exercises));
  });
  it("reschedules a resumed timer and removes skipped timers", () => {
    const exercises = [{ id: "a", name: "Bench Press" }];
    expect(restAlertsPlan({ a: { running: false, remainingSec: 9 } }, exercises)).toEqual([]);
    expect(restAlertsPlan({ a: { running: true, remainingSec: 9, endsAtMs: 30000 } }, exercises)[0].deadline).toBe(30000);
    expect(restAlertsPlan({}, exercises)).toEqual([]);
  });
  it("never rings the foreground fallback late or while backgrounded", () => {
    expect(shouldPlayForegroundRest(10000, 10010, true)).toBe(true);
    expect(shouldPlayForegroundRest(10000, 13000, true)).toBe(false);
    expect(shouldPlayForegroundRest(10000, 10010, false)).toBe(false);
    expect(shouldPlayForegroundRest(undefined, 10000, true)).toBe(false);
    expect(shouldPlayForegroundRest(11000, 10000, true)).toBe(false);
  });
});
