import { describe, expect, it } from "vitest";
import { foodAddedEvent, mealGuideTip, sleepGuideTip, sleepSavedEvent } from "./activityTips";
import { emptyGuide, guideReducer } from "./guideState";

describe("guide acknowledgements", () => {
  it("acknowledges food only for its saved date and meal, with an observed record", () => {
    const events = [foodAddedEvent("2026-11-25", "Breakfast")];
    expect(mealGuideTip("2026-11-25", "Breakfast", true, events).title).toBe("Food added");
    expect(mealGuideTip("2026-11-24", "Breakfast", true, events).title).toBe("Review your meal");
    expect(mealGuideTip("2026-11-25", "Lunch", true, events).title).toBe("Review your meal");
    expect(mealGuideTip("2026-11-25", "Breakfast", false, events).title).toBe("Add to this meal");
  });
  it("does not mistake existing records or opening/cancelling a form for a successful save", () => {
    expect(mealGuideTip("2026-11-25", "Breakfast", true, []).title).toBe("Review your meal");
    expect(sleepGuideTip("2026-11-25", true, []).title).toBe("Review your sleep");
    expect(sleepGuideTip("2026-11-25", false, []).title).toBe("Record sleep and see your trends");
  });
  it("acknowledges the saved sleep date, without claiming deleted records still exist", () => {
    const events = [sleepSavedEvent("2026-11-25")];
    expect(sleepGuideTip("2026-11-25", true, events).title).toBe("Sleep saved");
    expect(sleepGuideTip("2026-11-24", true, events).title).toBe("Review your sleep");
    expect(sleepGuideTip("2026-11-25", false, events).title).toBe("Record sleep and see your trends");
  });
  it("ignores late successful saves after finishing or changing accounts", () => {
    let state = guideReducer(emptyGuide(), { type: "start", owner: "a", topic: "nutrition" });
    state = guideReducer(state, { type: "end" });
    expect(guideReducer(state, { type: "event", owner: "a", id: foodAddedEvent("2026-11-25", "Breakfast") })).toBe(state);
    state = guideReducer(state, { type: "start", owner: "b", topic: "nutrition" });
    expect(guideReducer(state, { type: "event", owner: "a", id: foodAddedEvent("2026-11-25", "Breakfast") })).toBe(state);
  });
});
