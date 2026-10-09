import { z } from "zod";
import type { DecisionOutput } from "./decisionTypes";

const MAX_BULLETS = 4;
const MIN_BULLETS = 2;
const MAX_BULLET_CHARS = 140;
const MAX_TOTAL_CHARS = 600;

const allowedIntensityValues = new Set([-20, -10, 10, 20]);
const nutritionBulletPattern = /\b(nutrition|calorie|calories|protein|target|underfuel|fuel|intake|adherence)\b/i;

const rawDecisionOutputSchema = z
  .object({
    decision: z.enum(["PUSH", "MAINTAIN", "PULL_BACK"]),
    headline: z.string().optional(),
    todayAction: z.string().optional(),
    explanation: z.array(z.string()),
    caution: z.union([z.string(), z.null()]).optional(),
    adjustments: z
      .union([
        z
          .object({
            intensityPct: z.number().optional(),
            volumePct: z.number().optional(),
          })
          .strict(),
        z.null(),
      ])
      .optional(),
  })
  .strict();

const adjustmentsSchema = z
  .object({
    intensityPct: z.union([z.literal(20), z.literal(10), z.literal(-10), z.literal(-20)]).optional(),
    volumePct: z.never().optional(),
  })
  .strict();

export const decisionOutputSchema: z.ZodType<DecisionOutput> = z
  .object({
    decision: z.enum(["PUSH", "MAINTAIN", "PULL_BACK"]),
    headline: z.string().min(1).max(100).optional(),
    todayAction: z.string().min(1).max(180).optional(),
    explanation: z.array(z.string()),
    caution: z.string().min(1).max(180).optional(),
    adjustments: adjustmentsSchema.optional(),
  })
  .strict();

const sentenceEndingPattern = /[.!?]["')\]]?$/;

const preserveCompleteSentence = (value: string, limit: number): string | null => {
  if (value.length <= limit) {
    return sentenceEndingPattern.test(value) ? value : null;
  }

  const withinLimit = value.slice(0, limit + 1);
  let sentenceEnd = -1;
  for (const match of withinLimit.matchAll(/[.!?]["')\]]?(?=\s|$)/g)) {
    sentenceEnd = (match.index ?? -1) + match[0].length;
  }

  if (sentenceEnd < 0) return null;
  return withinLimit.slice(0, sentenceEnd).trim();
};

const humanizeExplanationText = (value: string) =>
  value
    .replace(/\bbelow_target\b/g, "below target")
    .replace(/\bon_target\b/g, "on target")
    .replace(/\babove_target\b/g, "above target")
    .replace(/\bage\s*~\s*([0-9]+(?:\.[0-9]+)?)\s*h\b/gi, "recorded about $1h ago");

const collapseNutritionBullets = (items: string[]) => {
  let sawNutrition = false;
  const collapsed = items.filter((item) => {
    if (!nutritionBulletPattern.test(item)) return true;
    if (sawNutrition) return false;
    sawNutrition = true;
    return true;
  });

  return collapsed.length >= MIN_BULLETS ? collapsed : items;
};

const normalizeExplanation = (explanation: string[]) => {
  const humanized = collapseNutritionBullets(
    explanation
      .map((item) => humanizeExplanationText(item.trim()))
      .filter((item) => item.length > 0)
  )
    .filter((item) => item.length > 0)
    .slice(0, MAX_BULLETS);
  const normalized: string[] = [];

  for (const item of humanized) {
    const complete = preserveCompleteSentence(item, MAX_BULLET_CHARS);
    if (!complete) return null;
    normalized.push(complete);
  }

  const totalChars = normalized.reduce((sum, item) => sum + item.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) return null;

  return normalized;
};

const defaultHeadline = (decision: DecisionOutput["decision"]) => {
  if (decision === "PUSH") return "You are ready to progress.";
  if (decision === "PULL_BACK") return "Reduce today's training stress.";
  return "Train at a steady effort.";
};

const defaultAction = (decision: DecisionOutput["decision"]) => {
  if (decision === "PUSH") return "Progress conservatively while keeping your prescribed form and effort targets.";
  if (decision === "PULL_BACK") return "Reduce the load or working sets and avoid training to failure today.";
  return "Follow the planned session without forcing additional weight, reps, or sets.";
};

const normalizeCompleteText = (value: string | null | undefined, limit: number) => {
  if (!value) return null;
  const normalized = humanizeExplanationText(value.trim());
  return preserveCompleteSentence(normalized, limit);
};

export const sanitizeDecisionOutput = (
  raw: unknown
): { ok: true; data: DecisionOutput } | { ok: false; reason: string } => {
  const parsedRaw = rawDecisionOutputSchema.safeParse(raw);
  if (!parsedRaw.success) {
    return { ok: false, reason: "invalid_output" };
  }

  const explanation = normalizeExplanation(parsedRaw.data.explanation);
  if (!explanation) {
    return { ok: false, reason: "incomplete_explanation" };
  }
  if (explanation.length < MIN_BULLETS || explanation.length > MAX_BULLETS) {
    return { ok: false, reason: "invalid_explanation_count" };
  }

  const decision = parsedRaw.data.decision;
  const headline = normalizeCompleteText(parsedRaw.data.headline, 100) ?? defaultHeadline(decision);
  const todayAction = normalizeCompleteText(parsedRaw.data.todayAction, 180) ?? defaultAction(decision);
  const caution = normalizeCompleteText(parsedRaw.data.caution, 180) ?? undefined;
  let adjustments: DecisionOutput["adjustments"];
  if (decision !== "MAINTAIN") {
    const maybeIntensity = parsedRaw.data.adjustments?.intensityPct;
    if (typeof maybeIntensity === "number" && allowedIntensityValues.has(maybeIntensity)) {
      adjustments = { intensityPct: maybeIntensity as -20 | -10 | 10 | 20 };
    }
  }

  const candidate: DecisionOutput = {
    decision,
    headline,
    todayAction,
    explanation,
    ...(caution ? { caution } : {}),
    ...(adjustments ? { adjustments } : {}),
  };
  const parsedFinal = decisionOutputSchema.safeParse(candidate);
  if (!parsedFinal.success) {
    return { ok: false, reason: "invalid_output" };
  }
  return { ok: true, data: parsedFinal.data };
};

export const parseAndSanitizeDecisionOutputText = (
  outputText: string
): { ok: true; data: DecisionOutput } | { ok: false; reason: string } => {
  try {
    const parsed = JSON.parse(outputText) as unknown;
    return sanitizeDecisionOutput(parsed);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
};
