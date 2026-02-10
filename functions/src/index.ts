import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import { z } from "zod";

type Decision = "PUSH" | "MAINTAIN" | "PULL_BACK";
type TrainingPhase = "Hypertrophy" | "Strength" | "Power";
type DietPhase = "Cut" | "Maintain" | "Bulk";

type DecisionInputs = {
  sleepHours: number;
  soreness: number;
  fatigue: number;
  motivation: number;
  trainingPhase: TrainingPhase;
  dietPhase: DietPhase;
};

type DecisionOutput = {
  decision: Decision;
  explanation: string[];
  adjustments?: { intensityPct?: number; volumePct?: number };
};

const decisionInputsSchema: z.ZodType<DecisionInputs> = z.object({
  sleepHours: z.number(),
  soreness: z.number(),
  fatigue: z.number(),
  motivation: z.number(),
  trainingPhase: z.enum(["Hypertrophy", "Strength", "Power"]),
  dietPhase: z.enum(["Cut", "Maintain", "Bulk"]),
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

const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join("; ");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
let openaiClient: OpenAI | null = null;

const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
  }
  return openaiClient;
};

const decisionOutputJsonSchema = {
  name: "decision_output",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      decision: { type: "string", enum: ["PUSH", "MAINTAIN", "PULL_BACK"] },
      explanation: { type: "array", items: { type: "string" } },
      adjustments: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            properties: {
              intensityPct: { type: "number", enum: [-20, -10, 10, 20] },
            },
            required: ["intensityPct"],
          },
        ],
      },
    },
    required: ["decision", "explanation", "adjustments"],
  },
};

const heuristicDecision = (input: DecisionInputs): DecisionOutput => {
  const { sleepHours, soreness, fatigue, motivation, dietPhase } = input;
  const isLowSleep = sleepHours < 6;
  const isHighFatigue = fatigue >= 7;
  const isHighSoreness = soreness >= 7;
  const isHighMotivation = motivation >= 7;

  let decision: Decision = "MAINTAIN";
  const explanation: string[] = [];
  let intensityPct: number | undefined;

  if (isLowSleep || isHighFatigue || isHighSoreness) {
    decision = "PULL_BACK";
    explanation.push("Recovery signals are low today.");
    if (isLowSleep) explanation.push("Sleep is below 6 hours.");
    if (isHighFatigue || isHighSoreness) explanation.push("Fatigue/soreness is elevated.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    intensityPct = -20;
  } else if (sleepHours >= 7 && fatigue <= 4 && isHighMotivation) {
    decision = "PUSH";
    explanation.push("Recovery looks solid.");
    explanation.push("Motivation is high with manageable fatigue.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
    intensityPct = 20;
  } else {
    decision = "MAINTAIN";
    explanation.push("Keep a steady session today.");
    explanation.push("No strong signal to push or pull back.");
    if (dietPhase === "Cut") explanation.push("Given you're in a cut, keep increases conservative.");
  }

  return intensityPct === undefined
    ? { decision, explanation }
    : { decision, explanation, adjustments: { intensityPct } };
};

export const getDailyDecision = functions
  .region("asia-northeast3")
  .runWith({ secrets: [OPENAI_API_KEY] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    const parsedInputs = decisionInputsSchema.safeParse(data);
    if (!parsedInputs.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid decision inputs: ${formatZodError(parsedInputs.error)}`
      );
    }
    const inputs = parsedInputs.data;
    try {
      const prompt = [
        "You are a strength training decision engine.",
        "Return ONLY a JSON object that matches the schema.",
        "Rules:",
        "- Always include decision and explanation (2-4 short bullets).",
        "- If decision is MAINTAIN, set adjustments to null.",
        "- If decision is PUSH, include adjustments.intensityPct = 10 or 20.",
        "- If decision is PULL_BACK, include adjustments.intensityPct = -10 or -20.",
        "- Never include volumePct.",
        `Inputs: ${JSON.stringify(inputs)}`,
      ].join("\n");

      const response = await getOpenAIClient().responses.create({
        model: "gpt-5-nano",
        input: prompt,
        store: false,
        text: {
          format: {
            type: "json_schema",
            ...decisionOutputJsonSchema,
          },
        },
      });

      const outputText = response.output_text;
      if (!outputText) {
        throw new Error("Empty OpenAI response");
      }
      const parsedJson = JSON.parse(outputText) as DecisionOutput & {
        adjustments?: { intensityPct?: number } | null;
      };
      if (parsedJson.adjustments === null) {
        delete parsedJson.adjustments;
      }
      const parsedOutput = decisionOutputSchema.safeParse(parsedJson);
      if (!parsedOutput.success) {
        console.log("getDailyDecision source=heuristic_fallback reason=invalid_output");
        return heuristicDecision(inputs);
      }
      if (
        parsedOutput.data.decision === "MAINTAIN" &&
        parsedOutput.data.adjustments?.intensityPct !== undefined
      ) {
        console.log("getDailyDecision source=heuristic_fallback reason=maintain_adjustments");
        return heuristicDecision(inputs);
      }
      console.log("getDailyDecision source=openai");
      return parsedOutput.data;
    } catch (err) {
      const errName = (err as { name?: string })?.name;
      const errMessage = (err as { message?: string })?.message;
      console.log(
        "getDailyDecision source=heuristic_fallback reason=exception",
        errName ?? "",
        errMessage ?? ""
      );
      return heuristicDecision(inputs);
    }
  });
