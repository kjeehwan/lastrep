import { expect, it } from "vitest";
import { emptyDraft, initialProgress, onboardingDestination, onboardingKey, parseCache, parseDraft, stepSubmission } from "./onboardingState";
it("does not infer onboarding requirements from optional legacy answers", () => {
  for (const data of [null, {}, { nickname: "", goal: "existing goal", availability: "4" }]) expect(onboardingDestination(data, null)).toBe("/(tabs)/home");
  expect(onboardingDestination({ onboarding: initialProgress }, null)).toBe("/onboarding/experience");
});
it("resumes an explicit checkpoint and honors completion without a nickname", () => {
  const cache = { progress: { ...initialProgress, step: "nickname" as const }, draft: emptyDraft };
  expect(onboardingDestination(null, cache)).toBe("/onboarding/nickname");
  expect(onboardingDestination({ onboarding: { ...initialProgress, completed: true } }, cache)).toBe("/(tabs)/home");
  expect(onboardingDestination({ onboarding: { ...initialProgress, step: "health" } }, cache)).toBe("/onboarding/health");
  expect(onboardingKey("fixture-a")).not.toBe(onboardingKey("fixture-b"));
});
it("skips without overwriting answers, goals, phases or completion prematurely", () => {
  const draft = { experience: "advanced" as const, availabilityDays: 2, nickname: "  Fixture  " };
  for (const step of ["experience", "availability", "nickname"] as const) {
    const result = stepSubmission(step, draft, true);
    expect(Object.keys(result.fields)).toEqual(["onboarding"]);
    expect(result.progress.completed).toBe(false);
  }
  expect(stepSubmission("experience", draft, false).fields).toHaveProperty("experience", "advanced");
  expect(stepSubmission("availability", draft, false).fields).toMatchObject({ availability: "2", availabilityDays: 2 });
  expect(stepSubmission("nickname", draft, false).fields).toHaveProperty("nickname", "Fixture");
  expect(stepSubmission("nickname", emptyDraft, false).fields).not.toHaveProperty("nickname");
  for (const skip of [false, true]) expect(stepSubmission("health", draft, skip)).toMatchObject({ progress: { completed: true }, destination: "/(tabs)/home" });
});
it("rejects corrupt checkpoints and normalizes restored draft values", () => {
  expect(parseCache("not-json")).toBeNull();
  expect(parseCache(JSON.stringify({ progress: { ...initialProgress, step: "preview" } }))).toBeNull();
  expect(parseDraft({ availabilityDays: 99, nickname: 7, experience: "unknown" })).toEqual({ ...emptyDraft, availabilityDays: 7 });
  expect(parseDraft({ availabilityDays: NaN })).toEqual(emptyDraft);
});
