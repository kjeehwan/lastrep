export type RecommendationUsage = { recommendedWorkout: boolean; todayPlanReviewed: boolean };
export type FeedbackAnswers = {
  followedRecommendation: "yes" | "partial" | "no" | null;
  helpful: "yes" | "neutral" | "no" | null;
  todayPlanHelpful: "yes" | "neutral" | "no" | null;
};
export function parseRecommendationUsage(value?: unknown): RecommendationUsage {
  const usage = value as Partial<RecommendationUsage> | null;
  return { recommendedWorkout: usage?.recommendedWorkout === true, todayPlanReviewed: usage?.todayPlanReviewed === true };
}
export function recommendationQuestions(usage: RecommendationUsage) {
  const helpfulOptions = [{ value: "yes", label: "Yes" }, { value: "neutral", label: "Neutral" }, { value: "no", label: "No" }] as const;
  const questions: { id: keyof FeedbackAnswers; label: string; options: readonly { value: string; label: string }[] }[] = [];
  if (usage.recommendedWorkout) {
    questions.push({ id: "followedRecommendation", label: "Followed the recommended workout?", options: [{ value: "yes", label: "Yes" }, { value: "partial", label: "Partial" }, { value: "no", label: "No" }] });
    questions.push({ id: "helpful", label: "Was the recommended workout helpful?", options: helpfulOptions });
  }
  if (usage.todayPlanReviewed) questions.push({ id: "todayPlanHelpful", label: "Was Today's Plan review helpful?", options: helpfulOptions });
  return questions;
}
export function recommendationFeedback(usage: RecommendationUsage, answers: FeedbackAnswers) {
  return {
    recommendationUsage: usage,
    followedRecommendation: usage.recommendedWorkout ? answers.followedRecommendation ?? "unknown" : "unknown",
    helpful: usage.recommendedWorkout ? answers.helpful ?? "unknown" : "unknown",
    todayPlanHelpful: usage.todayPlanReviewed ? answers.todayPlanHelpful ?? "unknown" : "unknown",
  };
}
