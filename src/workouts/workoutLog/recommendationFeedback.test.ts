import { expect, it } from "vitest";
import { parseRecommendationUsage, recommendationFeedback, recommendationQuestions } from "./recommendationFeedback";
import { serializeWorkoutDraft } from "./workoutDraft";

it("does not ask for feedback for manual, repeated or legacy workouts", () => {
  for (const value of [undefined, null, {}, { recommendedWorkout: "yes" }]) {
    expect(recommendationQuestions(parseRecommendationUsage(value))).toEqual([]);
  }
});
it("names each used feature separately, including when both were used", () => {
  expect(recommendationQuestions({ recommendedWorkout: true, todayPlanReviewed: false }).map(q => q.id)).toEqual(["followedRecommendation", "helpful"]);
  expect(recommendationQuestions({ recommendedWorkout: false, todayPlanReviewed: true }).map(q => q.id)).toEqual(["todayPlanHelpful"]);
  expect(recommendationQuestions({ recommendedWorkout: true, todayPlanReviewed: true }).map(q => q.label)).toEqual([
    "Followed the recommended workout?", "Was the recommended workout helpful?", "Was Today's Plan review helpful?",
  ]);
});
it("never attributes a stale answer to an unused feature", () => {
  expect(recommendationFeedback(parseRecommendationUsage(), { followedRecommendation: "yes", helpful: "yes", todayPlanHelpful: "no" })).toMatchObject({ followedRecommendation: "unknown", helpful: "unknown", todayPlanHelpful: "unknown" });
  expect(recommendationFeedback({ recommendedWorkout: true, todayPlanReviewed: true }, { followedRecommendation: "partial", helpful: "yes", todayPlanHelpful: "no" })).toMatchObject({ followedRecommendation: "partial", helpful: "yes", todayPlanHelpful: "no" });
});
it("retains feature use in a reopened draft without inferring it from a title", () => {
  const usage = { recommendedWorkout: true, todayPlanReviewed: true };
  const raw = serializeWorkoutDraft({ exercises: [], exerciseUnits: {}, sessionTitle: "Custom", sessionDateText: "2026-10-22", elapsedSeconds: 0, workoutTimerRunning: false, recommendationUsage: usage });
  expect(parseRecommendationUsage(JSON.parse(raw).recommendationUsage)).toEqual(usage);
});
