import { z } from "zod";
import type { DecisionInputs, DecisionOutput } from "../../types/decision";
import { availableWeightsSchema } from "../../workouts/availableWeights";

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

const plannedWorkoutSchema = z
  .object({
    source: z.enum(["draft", "program", "rest_day", "none"]),
    title: z.string().max(120).nullable(),
    exerciseNames: z.array(z.string().min(1).max(100)).max(12),
    exercises: z.array(z.object({
      name: z.string().min(1).max(100),
      mode: z.enum(["resistance", "cardio"]),
      availableWeights: availableWeightsSchema.optional(),
      sets: z.array(z.object({
        weightKg: z.number().min(0).nullable(),
        reps: z.number().min(0).nullable(),
        setType: z.enum(["warmup", "normal", "failure", "drop"]),
        done: z.boolean(),
      }).strict()).max(20),
    }).strict()).max(12).optional(),
  })
  .strict();

const recentTrainingSchema = z
  .object({
    lastWorkoutHoursAgo: z.number().min(0).nullable(),
    lastWorkoutTitle: z.string().max(120).nullable(),
    workoutsLast7Days: z.number().int().min(0).max(30),
    exercisePerformance: z
      .array(
        z
          .object({
            exerciseName: z.string().min(1).max(100),
            sessions: z.number().int().min(0).max(3),
            daysSinceLast: z.number().int().min(0).nullable(),
            lastTopWeightKg: z.number().min(0).nullable(),
            lastTopReps: z.number().int().min(0).nullable(),
            lastAverageRpe: z.number().min(0).max(10).nullable(),
            estimated1RmKg: z.number().min(0).nullable(),
            trend: z.enum(["improving", "stable", "declining", "insufficient"]),
          })
          .strict()
      )
      .max(12),
  })
  .strict();

const dailyContextSchema = z
  .object({
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pain: z
      .object({
        area: z.enum(["shoulder", "elbow", "wrist_hand", "upper_back", "lower_back", "hip", "knee", "ankle_foot", "other"]),
        side: z.enum(["left", "right", "both", "not_applicable"]),
        severity: z.enum(["mild", "moderate", "severe"]),
        trigger: z.enum(["at_rest", "pressing", "pulling", "overhead", "squatting", "hinging", "running_impact", "other"]),
        note: z.string().max(240).nullable(),
        affectsPlannedWorkout: z.boolean(),
      })
      .strict()
      .nullable(),
    additionalActivity: z
      .object({
        type: z.enum(["long_walk_hike", "running", "cycling", "sport", "physical_work", "travel", "other"]),
        timing: z.enum(["today", "yesterday", "two_days_ago"]),
        effort: z.enum(["light", "moderate", "hard"]),
        duration: z.enum(["under_1h", "1_to_2h", "over_2h"]),
        overlapsPlannedWorkout: z.boolean(),
      })
      .strict()
      .nullable(),
    note: z.string().max(300).nullable(),
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
  plannedWorkout: plannedWorkoutSchema.nullable().optional(),
  recentTraining: recentTrainingSchema.nullable().optional(),
  dailyContext: dailyContextSchema.nullable().optional(),
});

const adjustmentsSchema = z
  .object({
    intensityPct: z.union([z.literal(20), z.literal(10), z.literal(-10), z.literal(-20)]).optional(),
    volumePct: z.never().optional(),
  })
  .strict();

const exerciseAdjustmentSchema = z
  .object({
    exerciseName: z.string().trim().min(1).max(100),
    action: z.enum(["as_planned", "progress", "reduce", "avoid"]),
    loadPct: z.number().min(-50).max(50),
    setDelta: z.number().int().min(-3).max(3),
    repsDelta: z.number().int().min(-5).max(5),
    targetRpe: z.number().min(1).max(10).nullable(),
    reason: z.string().trim().min(1).max(240),
    availableWeights: availableWeightsSchema.optional(),
    plannedPrescription: z.object({
      weightKg: z.number().min(0).nullable(),
      reps: z.number().min(0).nullable(),
      sets: z.number().int().min(0).max(20),
    }).strict().optional(),
    recommendedPrescription: z.object({
      weightKg: z.number().min(0).nullable(),
      reps: z.number().min(0).nullable(),
      sets: z.number().int().min(0).max(20),
    }).strict().optional(),
  })
  .strict();

const completeExplanationSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/[.!?]["')\]]?$/, "Explanation must end with a complete sentence.");

const decisionOutputSchema = z
  .object({
    decision: z.enum(["PUSH", "MAINTAIN", "PULL_BACK"]),
    headline: z.string().trim().min(1).max(180).optional(),
    todayAction: z.string().trim().min(1).max(180).optional(),
    explanation: z.array(completeExplanationSchema).min(2).max(4),
    caution: z.string().trim().min(1).max(180).nullable().optional(),
    adjustments: adjustmentsSchema.nullable().optional(),
    exerciseAdjustments: z.array(exerciseAdjustmentSchema).max(12).optional(),
  })
  .transform(({ caution, adjustments, ...output }): DecisionOutput => ({
    ...output,
    ...(caution ? { caution } : {}),
    ...(adjustments ? { adjustments } : {}),
  }));

export const safeParseDecisionInputs = (inputs: DecisionInputs) =>
  decisionInputsSchema.safeParse(inputs);

export const safeParseDecisionOutput = (output: unknown) =>
  decisionOutputSchema.safeParse(output);

export const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join("; ");
