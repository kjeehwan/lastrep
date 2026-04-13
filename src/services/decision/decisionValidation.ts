import { z } from "zod";
import type { DecisionInputs, DecisionOutput } from "../../types/decision";

const nutritionSummarySchema = z
  .object({
    caloriesConsumedToday: z.number().int().min(0),
    proteinGramsToday: z.number().int().min(0).nullable(),
    calorieTarget: z.number().int().min(0).nullable(),
    yesterdayCalories: z.number().int().min(0).nullable(),
    yesterdayAdherence: z.enum(["below_target", "on_target", "above_target"]).nullable(),
    recentAdherence: z.enum(["below_target", "on_target", "above_target"]).nullable(),
    recentCompletedDaysTracked: z.number().int().min(0),
  })
  .strict();

const decisionInputsSchema: z.ZodType<DecisionInputs> = z.object({
  sleepHours: z.number(),
  sleepSource: z.enum(["manual", "health"]),
  sleepSampleAgeHours: z.number().min(0).nullable(),
  soreness: z.number(),
  fatigue: z.number(),
  motivation: z.number(),
  trainingPhase: z.enum(["Hypertrophy", "Strength", "Power"]),
  dietPhase: z.enum(["Cut", "Maintain", "Bulk"]),
  nutrition: nutritionSummarySchema.nullable().optional(),
});

const adjustmentsSchema = z
  .object({
    intensityPct: z.union([z.literal(20), z.literal(10), z.literal(-10), z.literal(-20)]).optional(),
    volumePct: z.never().optional(),
  })
  .strict();

const decisionOutputSchema: z.ZodType<DecisionOutput> = z.object({
  decision: z.enum(["PUSH", "MAINTAIN", "PULL_BACK"]),
  explanation: z.array(z.string()),
  adjustments: adjustmentsSchema.optional(),
});

export const safeParseDecisionInputs = (inputs: DecisionInputs) =>
  decisionInputsSchema.safeParse(inputs);

export const safeParseDecisionOutput = (output: DecisionOutput) =>
  decisionOutputSchema.safeParse(output);

export const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join("; ");
