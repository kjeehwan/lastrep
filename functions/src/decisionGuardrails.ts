import type { DecisionInputs, DecisionOutput } from "./decisionTypes";

export const applyDecisionGuardrails = (
  output: DecisionOutput,
  inputs: DecisionInputs
): DecisionOutput => {
  const plan = inputs.plannedWorkout;
  const pain = inputs.dailyContext?.pain;
  const activity = inputs.dailyContext?.additionalActivity;

  if (plan?.source === "rest_day") {
    return {
      decision: "MAINTAIN",
      headline: "Keep today focused on recovery.",
      todayAction: "Use the rest day for easy movement, nutrition, and sleep rather than adding a hard session.",
      explanation: output.explanation.slice(0, 3),
    };
  }

  if (pain?.affectsPlannedWorkout) {
    const severityText =
      pain.severity === "severe" ? "Severe" : pain.severity === "moderate" ? "Moderate" : "Reported";
    const explanation = [
      `${severityText} discomfort overlaps with the planned workout.`,
      ...output.explanation.filter((item) => !/discomfort|pain/i.test(item)),
    ].slice(0, 3);
    while (explanation.length < 2) {
      explanation.push("Protecting movement quality is more important than progression today.");
    }
    return {
      decision: "PULL_BACK",
      headline: "Modify the session around your discomfort.",
      todayAction: "Avoid movements that reproduce the discomfort and reduce the session load or working sets.",
      explanation,
      caution: "Stop any movement that causes sharp, worsening, or unusual pain.",
      adjustments: { intensityPct: pain.severity === "severe" ? -20 : -10 },
    };
  }

  const hardOverlappingActivity = Boolean(
    activity?.overlapsPlannedWorkout &&
      activity.effort === "hard" &&
      activity.timing !== "two_days_ago"
  );
  if (hardOverlappingActivity && output.decision === "PUSH") {
    return {
      ...output,
      decision: "MAINTAIN",
      headline: "Keep today's session controlled.",
      todayAction: "Hold load and volume steady because recent activity already stressed the planned muscles.",
      explanation: [
        "Recent hard activity overlaps with the planned workout.",
        ...output.explanation.filter((item) => !/activity|workload/i.test(item)),
      ].slice(0, 3),
      adjustments: undefined,
    };
  }

  if (plan?.source === "none") {
    return {
      ...output,
      headline: output.headline ?? "Review your readiness before choosing a session.",
      todayAction: "Choose today's workout, then update this plan for session-specific guidance.",
    };
  }

  return output;
};
