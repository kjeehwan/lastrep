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
    explanation: z.array(z.string()),
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
    explanation: z.array(z.string()),
    adjustments: adjustmentsSchema.optional(),
  })
  .strict();

const truncateBullet = (value: string, limit: number) => {
  if (value.length <= limit) return value;
  const sliced = value.slice(0, limit).trim();

  const sentenceEnd = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("! "), sliced.lastIndexOf("? "));
  if (sentenceEnd >= Math.floor(limit * 0.6)) {
    return sliced.slice(0, sentenceEnd + 1).trim();
  }

  const clauseEnd = Math.max(sliced.lastIndexOf("; "), sliced.lastIndexOf(", "));
  if (clauseEnd >= Math.floor(limit * 0.7)) {
    return sliced.slice(0, clauseEnd).trim();
  }

  const wordBoundary = sliced.lastIndexOf(" ");
  if (wordBoundary >= Math.floor(limit * 0.75)) {
    return sliced.slice(0, wordBoundary).trim();
  }

  return sliced;
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
  const normalized = collapseNutritionBullets(
    explanation
      .map((item) => humanizeExplanationText(item.trim()))
      .filter((item) => item.length > 0)
  )
    .filter((item) => item.length > 0)
    .slice(0, MAX_BULLETS)
    .map((item) => truncateBullet(item, MAX_BULLET_CHARS));

  let totalChars = normalized.reduce((sum, item) => sum + item.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    for (let i = normalized.length - 1; i >= 0 && totalChars > MAX_TOTAL_CHARS; i -= 1) {
      const current = normalized[i];
      const excess = totalChars - MAX_TOTAL_CHARS;
      const nextLimit = Math.max(1, current.length - excess);
      const next = truncateBullet(current, nextLimit);
      normalized[i] = next;
      totalChars = totalChars - current.length + next.length;
    }
  }

  return normalized;
};

export const sanitizeDecisionOutput = (
  raw: unknown
): { ok: true; data: DecisionOutput } | { ok: false; reason: string } => {
  const parsedRaw = rawDecisionOutputSchema.safeParse(raw);
  if (!parsedRaw.success) {
    return { ok: false, reason: "invalid_output" };
  }

  const explanation = normalizeExplanation(parsedRaw.data.explanation);
  if (explanation.length < MIN_BULLETS || explanation.length > MAX_BULLETS) {
    return { ok: false, reason: "invalid_explanation_count" };
  }

  const decision = parsedRaw.data.decision;
  let adjustments: DecisionOutput["adjustments"];
  if (decision !== "MAINTAIN") {
    const maybeIntensity = parsedRaw.data.adjustments?.intensityPct;
    if (typeof maybeIntensity === "number" && allowedIntensityValues.has(maybeIntensity)) {
      adjustments = { intensityPct: maybeIntensity as -20 | -10 | 10 | 20 };
    }
  }

  const candidate: DecisionOutput = adjustments
    ? { decision, explanation, adjustments }
    : { decision, explanation };
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
