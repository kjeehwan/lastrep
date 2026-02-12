import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import crypto from "crypto";
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

if (!admin.apps.length) {
  admin.initializeApp();
}

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

const cachedAdjustmentsSchema = z.union([
  z
    .object({
      intensityPct: z.number().optional(),
      volumePct: z.number().optional(),
    })
    .strict(),
  z.null(),
]);

const decisionOutputCacheSchema = z.object({
  decision: z.enum(["PUSH", "MAINTAIN", "PULL_BACK"]),
  explanation: z.array(z.string()),
  adjustments: cachedAdjustmentsSchema.optional(),
});

const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join("; ");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
let openaiClient: OpenAI | null = null;

const OPENAI_TIMEOUT_MS = 12000;
const OPENAI_FIRST_ATTEMPT_MS = 9000;
const OPENAI_RETRY_MS = 3000;

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

const callOpenAIWithTimeout = async (input: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await getOpenAIClient().responses.create(
      {
        model: "gpt-5-nano",
        input,
        store: false,
        text: {
          format: {
            type: "json_schema",
            ...decisionOutputJsonSchema,
          },
        },
      },
      { signal: controller.signal }
    );
  } finally {
    clearTimeout(timer);
  }
};

const isTransientOpenAiError = (err: unknown) => {
  const status = (err as { status?: number })?.status;
  const code = (err as { code?: string })?.code;
  const name = (err as { name?: string })?.name;
  if (status && (status === 429 || status >= 500)) return true;
  if (name === "AbortError") return true;
  if (code && ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ECONNABORTED"].includes(code)) {
    return true;
  }
  return false;
};

const extractOutputText = (response: OpenAI.Responses.Response) => {
  const direct = response.output_text?.trim();
  if (direct) return direct;
  const outputs = response.output ?? [];
  for (const item of outputs) {
    const content = (item as { content?: Array<{ text?: string; json?: unknown }> }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) return part.text;
      if (typeof part?.json === "string" && part.json.trim()) return part.json;
      if (part?.json && typeof part.json === "object") return JSON.stringify(part.json);
    }
  }
  return "";
};

const parseDecisionOutput = (outputText: string) => {
  try {
    const parsedJson = JSON.parse(outputText) as DecisionOutput & {
      adjustments?: { intensityPct?: number } | null;
    };
    if (parsedJson.adjustments === null) {
      delete parsedJson.adjustments;
    }
    const parsedOutput = decisionOutputSchema.safeParse(parsedJson);
    if (!parsedOutput.success) {
      return { ok: false as const, reason: "invalid_output" as const };
    }
    if (
      parsedOutput.data.decision === "MAINTAIN" &&
      parsedOutput.data.adjustments?.intensityPct !== undefined
    ) {
      return { ok: false as const, reason: "maintain_adjustments" as const };
    }
    return { ok: true as const, data: parsedOutput.data };
  } catch {
    return { ok: false as const, reason: "invalid_json" as const };
  }
};

const hashDecisionInputs = (inputs: DecisionInputs): string => {
  const normalized = {
    sleepHours: inputs.sleepHours,
    soreness: inputs.soreness,
    fatigue: inputs.fatigue,
    motivation: inputs.motivation,
    trainingPhase: inputs.trainingPhase,
    dietPhase: inputs.dietPhase,
  };
  const json = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(json).digest("hex");
};

const getDateStringFromOffset = (date: Date, tzOffsetMinutes: number) => {
  const effective = new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);
  const year = effective.getUTCFullYear();
  const month = String(effective.getUTCMonth() + 1).padStart(2, "0");
  const day = String(effective.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const coerceToDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  const maybeToDate = value as { toDate?: () => Date };
  if (maybeToDate?.toDate) return maybeToDate.toDate();
  const maybeSeconds = value as { seconds?: number };
  if (typeof maybeSeconds?.seconds === "number") {
    return new Date(maybeSeconds.seconds * 1000);
  }
  return null;
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
      const startMs = Date.now();
      const inputs = parsedInputs.data;
      const uid = context.auth.uid;
      let openAiAttempted = false;
      let openAiRetried = false;
        let latencyMsOpenAI = 0;
        let pathUsed: "OPENAI" | "FALLBACK_HEURISTIC" | "CACHE_HIT" = "FALLBACK_HEURISTIC";
        let fallbackReason = "";

        const inputHash = hashDecisionInputs(inputs);
        const userSnap = await admin.firestore().doc(`users/${uid}`).get();
        const userData = userSnap.data();
        const decisions = userData?.usage?.decisions;
        const tzOffsetMinutes = decisions?.tzOffsetMinutes;
        const lastInputHash = decisions?.lastInputHash;
        const lastResult = decisions?.lastResult;
        const lastResultCreatedAt = lastResult?.createdAt;
        const lastResultOutput = lastResult?.result;

        if (
          typeof tzOffsetMinutes === "number" &&
          typeof lastInputHash === "string" &&
          lastResultCreatedAt &&
          lastResultOutput
        ) {
          const lastResultDate = coerceToDate(lastResultCreatedAt);
          if (lastResultDate) {
            const today = getDateStringFromOffset(new Date(), tzOffsetMinutes);
            const lastDay = getDateStringFromOffset(lastResultDate, tzOffsetMinutes);
            if (today === lastDay && lastInputHash === inputHash) {
              const parsedCache = decisionOutputCacheSchema.safeParse(lastResultOutput);
              if (parsedCache.success) {
                pathUsed = "CACHE_HIT";
                const latencyMsTotal = Date.now() - startMs;
              const cachedResult = parsedCache.data as DecisionOutput & {
                adjustments?: { intensityPct?: number; volumePct?: number } | null;
              };
              if (cachedResult.adjustments === null) {
                delete cachedResult.adjustments;
              }
              if (cachedResult.adjustments && "volumePct" in cachedResult.adjustments) {
                delete cachedResult.adjustments.volumePct;
              }
              if (
                cachedResult.adjustments &&
                cachedResult.adjustments.intensityPct === undefined
              ) {
                delete cachedResult.adjustments;
              }
              if (cachedResult.decision === "MAINTAIN") {
                delete cachedResult.adjustments;
              }
                console.log(
                  JSON.stringify({
                    uid,
                    pathUsed,
                    openAiAttempted: false,
                    openAiRetried: false,
                    latencyMsTotal,
                    latencyMsOpenAI: 0,
                  })
                );
                return cachedResult;
              }
            }
          }
        }

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

      const attemptOpenAI = async (timeoutMs: number) => {
        const attemptStart = Date.now();
        try {
          const response = await callOpenAIWithTimeout(prompt, timeoutMs);
          latencyMsOpenAI += Date.now() - attemptStart;
          return { ok: true as const, response };
        } catch (err) {
          latencyMsOpenAI += Date.now() - attemptStart;
          return { ok: false as const, error: err };
        }
      };

      openAiAttempted = true;
      const firstAttempt = await attemptOpenAI(OPENAI_FIRST_ATTEMPT_MS);
      if (firstAttempt.ok) {
        const outputText = extractOutputText(firstAttempt.response);
        if (outputText) {
          const parsed = parseDecisionOutput(outputText);
          if (parsed.ok) {
            pathUsed = "OPENAI";
            const latencyMsTotal = Date.now() - startMs;
            console.log(
              JSON.stringify({
                uid,
                pathUsed,
                openAiAttempted,
                openAiRetried,
                latencyMsTotal,
                latencyMsOpenAI,
              })
            );
            return parsed.data;
          }
          fallbackReason = parsed.reason ?? "invalid_output";
        } else {
          fallbackReason = "empty_response";
        }
      } else if (isTransientOpenAiError(firstAttempt.error)) {
        openAiRetried = true;
        const retryAttempt = await attemptOpenAI(OPENAI_RETRY_MS);
        if (retryAttempt.ok) {
          const outputText = extractOutputText(retryAttempt.response);
          if (outputText) {
            const parsed = parseDecisionOutput(outputText);
            if (parsed.ok) {
              pathUsed = "OPENAI";
              const latencyMsTotal = Date.now() - startMs;
              console.log(
                JSON.stringify({
                  uid,
                  pathUsed,
                  openAiAttempted,
                  openAiRetried,
                  latencyMsTotal,
                  latencyMsOpenAI,
                })
              );
              return parsed.data;
            }
            fallbackReason = parsed.reason ?? "invalid_output";
          } else {
            fallbackReason = "empty_response";
          }
        } else {
          fallbackReason = "exception";
        }
      } else {
        fallbackReason = "exception";
      }

      const fallback = heuristicDecision(inputs);
      const latencyMsTotal = Date.now() - startMs;
      console.log(
        JSON.stringify({
          uid,
          pathUsed,
          openAiAttempted,
          openAiRetried,
          latencyMsTotal,
          latencyMsOpenAI,
          fallbackReason: fallbackReason.slice(0, 80),
        })
      );
      return fallback;
    });
