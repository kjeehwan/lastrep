import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import { z } from "zod";
import { hashDecisionInputs } from "./decisionHash";
import { heuristicDecision } from "./decisionHeuristic";
import { parseAndSanitizeDecisionOutputText, sanitizeDecisionOutput } from "./decisionPipeline";
import type { DecisionInputs, DecisionOutput, DecisionPathUsed } from "./decisionTypes";

if (!admin.apps.length) {
  admin.initializeApp();
}

const decisionInputsSchema: z.ZodType<DecisionInputs> = z.object({
  sleepHours: z.number(),
  sleepSource: z.enum(["manual", "health"]),
  sleepSampleAgeHours: z.number().min(0).nullable(),
  soreness: z.number(),
  fatigue: z.number(),
  motivation: z.number(),
  trainingPhase: z.enum(["Hypertrophy", "Strength", "Power"]),
  dietPhase: z.enum(["Cut", "Maintain", "Bulk"]),
  nutrition: z
    .object({
      caloriesConsumedToday: z.number().int().min(0),
      proteinGramsToday: z.number().int().min(0).nullable(),
      calorieTarget: z.number().int().min(0).nullable(),
      yesterdayCalories: z.number().int().min(0).nullable(),
      yesterdayAdherence: z.enum(["below_target", "on_target", "above_target"]).nullable(),
      recentAdherence: z.enum(["below_target", "on_target", "above_target"]).nullable(),
      recentCompletedDaysTracked: z.number().int().min(0),
    })
    .strict()
    .nullable()
    .optional(),
});

const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join("; ");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const REVENUECAT_WEBHOOK_AUTH = defineSecret("REVENUECAT_WEBHOOK_AUTH");
const DEV_UID_ALLOWLIST_SECRET = defineSecret("DEV_UID_ALLOWLIST");
const DECISION_PROMPT_VERSION = "v6";
const OPENAI_DECISION_MODEL = "gpt-5-nano";
const OPENAI_TIMEOUT_MS = 12000;
const OPENAI_FIRST_ATTEMPT_MS = 8000;
const OPENAI_RETRY_MS = 7000;
const OPENAI_RETRY_ENABLED = true;
const OPENAI_MAX_OUTPUT_TOKENS_FIRST = 900;
const OPENAI_MAX_OUTPUT_TOKENS_RETRY = 1200;
const FALLBACK_REASON_MAX_LEN = 80;
const INPUT_HASH_PREFIX_LEN = 8;
const SERVER_RATE_LIMIT_MAX_COUNT = 12;
const SERVER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const FREE_MAX_PER_30_DAYS = 3;
const ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PREMIUM_ENTITLEMENT_ID = "premium";
const DEV_OVERRIDE_ENABLED = process.env.FUNCTIONS_EMULATOR === "true";

const ENABLE_OPENAI_DECISION = (() => {
  if (typeof process.env.ENABLE_OPENAI_DECISION === "string") {
    return process.env.ENABLE_OPENAI_DECISION.toLowerCase() === "true";
  }
  // Default off for emulator/local, on for deployed environments.
  return process.env.FUNCTIONS_EMULATOR !== "true";
})();

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
      explanation: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: { type: "string", minLength: 12, maxLength: 140 },
      },
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

const callOpenAIWithTimeout = async (
  input: string,
  timeoutMs: number,
  maxOutputTokens: number
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await getOpenAIClient().responses.create(
      {
        model: OPENAI_DECISION_MODEL,
        input,
        store: false,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: "low" },
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

const callOpenAIPingWithTimeout = async (timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await getOpenAIClient().responses.create(
      {
        model: OPENAI_DECISION_MODEL,
        input: "Reply with exactly: OK",
        store: false,
        max_output_tokens: 8,
        reasoning: { effort: "low" },
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
  const message = ((err as { message?: string })?.message ?? "").toLowerCase();
  if (status && (status === 429 || status >= 500)) return true;
  if (
    name === "AbortError" ||
    name === "APIUserAbortError" ||
    name === "APIConnectionTimeoutError" ||
    name === "APIConnectionError"
  ) {
    return true;
  }
  if (code && ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "ECONNABORTED"].includes(code)) {
    return true;
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("aborted")) {
    return true;
  }
  return false;
};

const summarizeOpenAiError = (err: unknown) => {
  const name = (err as { name?: string })?.name ?? "UnknownError";
  const code = (err as { code?: string })?.code ?? "";
  const status = (err as { status?: number })?.status;
  const message = ((err as { message?: string })?.message ?? "").replace(/\s+/g, " ").trim();
  if (typeof status === "number") {
    const base = `${name}:${status}${code ? `:${code}` : ""}`;
    return message ? `${base}:${message.slice(0, 40)}` : base;
  }
  const base = `${name}${code ? `:${code}` : ""}`;
  return message ? `${base}:${message.slice(0, 40)}` : base;
};

const extractOutputText = (response: OpenAI.Responses.Response) => {
  const direct = response.output_text?.trim();
  if (direct) return direct;
  const outputs = response.output ?? [];
  for (const item of outputs) {
    const content = (item as { content?: Array<{ text?: string; json?: unknown; parsed?: unknown }> })
      .content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) return part.text;
      if (typeof part?.json === "string" && part.json.trim()) return part.json;
      if (part?.json && typeof part.json === "object") return JSON.stringify(part.json);
      if (part?.parsed && typeof part.parsed === "object") return JSON.stringify(part.parsed);
    }
  }
  return "";
};

const extractRefusalText = (response: OpenAI.Responses.Response) => {
  const outputs = response.output ?? [];
  for (const item of outputs) {
    const content = (
      item as { content?: Array<{ type?: string; refusal?: string; text?: string }> }
    ).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === "refusal" && typeof part.refusal === "string" && part.refusal.trim()) {
        return part.refusal.trim();
      }
      if (part?.type === "refusal" && typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }
  return "";
};

const extractOutputObject = (response: OpenAI.Responses.Response): unknown | null => {
  const parsedTopLevel = (response as { output_parsed?: unknown }).output_parsed;
  if (parsedTopLevel && typeof parsedTopLevel === "object") return parsedTopLevel;

  const outputs = response.output ?? [];
  for (const item of outputs) {
    const content = (item as { content?: Array<{ json?: unknown; parsed?: unknown }> }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.parsed && typeof part.parsed === "object") return part.parsed;
      if (part?.json && typeof part.json === "object") return part.json;
    }
  }
  return null;
};

type OpenAiResponseDebug = {
  responseId?: string;
  status?: string;
  incompleteReason?: string;
  outputItemTypes: string[];
  outputContentTypes: string[];
  outputTextLength: number;
  hasRefusal: boolean;
  refusalPreview?: string;
};

const buildOpenAiResponseDebug = (response: OpenAI.Responses.Response): OpenAiResponseDebug => {
  const outputItemTypes: string[] = [];
  const outputContentTypes: string[] = [];
  const outputs = response.output ?? [];
  for (const item of outputs) {
    const itemType = (item as { type?: string })?.type;
    if (typeof itemType === "string") outputItemTypes.push(itemType);
    const content = (item as { content?: Array<{ type?: string }> })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part?.type === "string") outputContentTypes.push(part.type);
    }
  }

  const refusalText = extractRefusalText(response);
  const incompleteReason = (
    response as { incomplete_details?: { reason?: string } | null }
  )?.incomplete_details?.reason;
  const status = (response as { status?: string })?.status;
  const outputText = extractOutputText(response);

  return {
    responseId: response.id,
    status,
    incompleteReason: typeof incompleteReason === "string" ? incompleteReason : undefined,
    outputItemTypes,
    outputContentTypes,
    outputTextLength: outputText.length,
    hasRefusal: refusalText.length > 0 || outputContentTypes.includes("refusal"),
    refusalPreview: refusalText ? refusalText.slice(0, 80) : undefined,
  };
};

const summarizeOpenAiResponseFailure = (
  response: OpenAI.Responses.Response,
  parseReason?: string
) => {
  const debug = buildOpenAiResponseDebug(response);
  if (debug.hasRefusal) {
    return `refusal${debug.refusalPreview ? `:${debug.refusalPreview}` : ""}`;
  }
  if (debug.incompleteReason) {
    return `incomplete:${debug.incompleteReason}`;
  }
  if (debug.status && debug.status !== "completed") {
    return `status:${debug.status}`;
  }
  if (parseReason) {
    return parseReason;
  }
  return "empty_response";
};

const logOpenAiFailureDebug = (stage: string, response: OpenAI.Responses.Response, parseReason?: string) => {
  const debug = buildOpenAiResponseDebug(response);
  console.log(
    JSON.stringify({
      openAiDebug: true,
      stage,
      parseReason: parseReason ?? null,
      ...debug,
    })
  );
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

type DecisionLogEvent = {
  uid: string;
  pathUsed: DecisionPathUsed;
  sleepSource: DecisionInputs["sleepSource"];
  sleepSampleAgeHours: DecisionInputs["sleepSampleAgeHours"];
  openAiAttempted: boolean;
  openAiRetried: boolean;
  latencyMsTotal: number;
  latencyMsOpenAI: number;
  inputHashPrefix: string;
  fallbackReason?: string;
  rateLimited?: boolean;
};

const logDecisionEvent = (event: DecisionLogEvent) => {
  const payload: {
    uid: string;
    pathUsed: DecisionPathUsed;
    sleepSource: DecisionInputs["sleepSource"];
    sleepSampleAgeHours: DecisionInputs["sleepSampleAgeHours"];
    openAiAttempted: boolean;
    openAiRetried: boolean;
    latencyMsTotal: number;
    latencyMsOpenAI: number;
    promptVersion: string;
    cacheHit: boolean;
    inputHashPrefix: string;
    rateLimited: boolean;
    fallbackReason?: string;
  } = {
    uid: event.uid,
    pathUsed: event.pathUsed,
    sleepSource: event.sleepSource,
    sleepSampleAgeHours: event.sleepSampleAgeHours,
    openAiAttempted: event.openAiAttempted,
    openAiRetried: event.openAiRetried,
    latencyMsTotal: event.latencyMsTotal,
    latencyMsOpenAI: event.latencyMsOpenAI,
    promptVersion: DECISION_PROMPT_VERSION,
    cacheHit: event.pathUsed === "CACHE_HIT",
    inputHashPrefix: event.inputHashPrefix,
    rateLimited: event.rateLimited === true,
  };
  if (event.fallbackReason) {
    payload.fallbackReason = event.fallbackReason.slice(0, FALLBACK_REASON_MAX_LEN);
  }
  console.log(JSON.stringify(payload));
};

type RateLimitResult = {
  allowed: boolean;
  userData: FirebaseFirestore.DocumentData | undefined;
};

type DecisionGateReasonCode =
  | "FREE_WINDOW_EXHAUSTED"
  | "DAILY_LIMIT"
  | "COOLDOWN_ACTIVE";

type DecisionGateResult =
  | {
      allowed: true;
      userData: FirebaseFirestore.DocumentData | undefined;
    }
  | {
      allowed: false;
      reasonCode: DecisionGateReasonCode;
      retryAfterSeconds?: number;
    };

const checkAndConsumeServerRateLimit = async (uid: string, now: Date): Promise<RateLimitResult> => {
  const userRef = admin.firestore().doc(`users/${uid}`);
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const userData = snap.data();
    const decisions = userData?.usage?.decisions ?? {};
    const serverRateLimit = decisions.serverRateLimit ?? {};
    const currentWindowStart = coerceToDate(serverRateLimit.windowStart) ?? now;
    const currentCount = typeof serverRateLimit.count === "number" ? serverRateLimit.count : 0;
    const inWindow = now.getTime() - currentWindowStart.getTime() < SERVER_RATE_LIMIT_WINDOW_MS;
    const nextWindowStart = inWindow ? currentWindowStart : now;
    const nextCountBase = inWindow ? currentCount : 0;

    if (nextCountBase >= SERVER_RATE_LIMIT_MAX_COUNT) {
      return { allowed: false, userData };
    }

    tx.set(
      userRef,
      {
        usage: {
          decisions: {
            serverRateLimit: {
              windowStart: admin.firestore.Timestamp.fromDate(nextWindowStart),
              count: nextCountBase + 1,
            },
          },
        },
      },
      { merge: true }
    );

    return { allowed: true, userData };
  });
};

const getDateStringForOffset = (date: Date, tzOffsetMinutes: number) => {
  const effective = new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);
  const year = effective.getUTCFullYear();
  const month = String(effective.getUTCMonth() + 1).padStart(2, "0");
  const day = String(effective.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const coerceTimestampArray = (value: unknown): Date[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => coerceToDate(item))
    .filter((item): item is Date => Boolean(item))
    .sort((a, b) => a.getTime() - b.getTime());
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  return null;
};

const assertDevUidAllowed = (uid: string) => {
  const allowlist = (DEV_UID_ALLOWLIST_SECRET.value() ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowlist.includes(uid)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "This callable is restricted to development allowlisted users."
    );
  }
};

const checkAndConsumeServerDecisionGate = async (uid: string, now: Date): Promise<DecisionGateResult> => {
  const userRef = admin.firestore().doc(`users/${uid}`);
  return admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const userData = snap.data();
    const entitlement = userData?.entitlement ?? {};
    const decisions = userData?.usage?.decisions ?? {};
    const tzOffsetMinutes =
      typeof decisions.tzOffsetMinutes === "number" ? decisions.tzOffsetMinutes : 0;
    const nowMs = now.getTime();
    const rollingStartMs = nowMs - ROLLING_WINDOW_MS;
    const decisionTimestamps = coerceTimestampArray(decisions.decisionTimestamps).filter(
      (date) => date.getTime() >= rollingStartMs
    );
    const today = getDateStringForOffset(now, tzOffsetMinutes);
    const dailyCount = decisionTimestamps.filter(
      (date) => getDateStringForOffset(date, tzOffsetMinutes) === today
    ).length;
    const cooldownUntil = coerceToDate(decisions.cooldownUntil);

    const override = DEV_OVERRIDE_ENABLED ? parseBoolean(entitlement.devOverrideIsSubscribed) : null;
    const hasPermanentGrant = hasPermanentPremiumGrant(entitlement);
    const isSubscribed = hasPermanentGrant ? true : (override ?? Boolean(entitlement.isSubscribed));

    if (!isSubscribed) {
      if (decisionTimestamps.length >= FREE_MAX_PER_30_DAYS) {
        return { allowed: false, reasonCode: "FREE_WINDOW_EXHAUSTED" };
      }
    }

    const updatedTimestamps = [
      ...decisionTimestamps,
      now,
    ].map((date) => admin.firestore.Timestamp.fromDate(date));

    tx.set(
      userRef,
      {
        usage: {
          decisions: {
            decisionTimestamps: updatedTimestamps,
            cooldownUntil: null,
          },
        },
      },
      { merge: true }
    );

    return { allowed: true, userData };
  });
};

const isRevenueCatWebhookAuthorized = (authorizationHeader: string | undefined): boolean => {
  const secret = REVENUECAT_WEBHOOK_AUTH.value()?.trim();
  if (!secret) return false;
  if (!authorizationHeader) return false;
  const normalized = authorizationHeader.trim();
  return normalized === secret || normalized === `Bearer ${secret}`;
};

const touchesPremiumEntitlement = (event: Record<string, unknown>): boolean => {
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids.filter((value): value is string => typeof value === "string")
    : [];
  const entitlementId =
    typeof event.entitlement_id === "string" ? event.entitlement_id : null;
  return (
    entitlementIds.includes(PREMIUM_ENTITLEMENT_ID) ||
    entitlementId === PREMIUM_ENTITLEMENT_ID
  );
};

const toMsNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.floor(parsed);
    }
  }
  return null;
};

type RevenueCatLifecycleLogEvent =
  | "RC_EVENT"
  | "entitlement_activated"
  | "entitlement_expired"
  | "duplicate_event_skipped"
  | "stale_event_skipped"
  | "manual_grant_locked_skipped";

type RevenueCatLifecycleLogPayload = {
  app_user_id: string;
  event_id?: string;
  event_type?: string;
  product_id?: string | null;
  expiration_at_ms?: number | null;
  processed_at: string;
  is_subscribed?: boolean;
};

const logRevenueCatLifecycleEvent = (
  event: RevenueCatLifecycleLogEvent,
  payload: RevenueCatLifecycleLogPayload
) => {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
  console.log(event, sanitizedPayload);
};

const mapRevenueCatEventToSubscriptionStatus = (
  eventType: string,
  currentIsSubscribed: boolean
): { shouldMutate: boolean; isSubscribed: boolean } => {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
    case "TEMPORARY_ENTITLEMENT_GRANT":
      return { shouldMutate: true, isSubscribed: true };
    case "EXPIRATION":
      return { shouldMutate: true, isSubscribed: false };
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED":
    case "CANCELLATION":
    case "BILLING_ISSUE":
    case "SUBSCRIPTION_PAUSED":
      return { shouldMutate: true, isSubscribed: currentIsSubscribed };
    default:
      return { shouldMutate: true, isSubscribed: currentIsSubscribed };
  }
};

const hasPermanentPremiumGrant = (entitlement: Record<string, unknown>): boolean =>
  parseBoolean(entitlement.manualGrantPermanent) === true;

const getBoundedHeuristicDecision = (inputs: DecisionInputs): DecisionOutput => {
  const heuristic = heuristicDecision(inputs);
  const sanitized = sanitizeDecisionOutput(heuristic);
  return sanitized.ok ? sanitized.data : heuristic;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

const computeRecoveryReadinessScore = (inputs: DecisionInputs): number => {
  const sleepScore = clampScore((inputs.sleepHours / 8) * 100);
  const sorenessScore = clampScore((10 - inputs.soreness) * 10);
  const fatigueScore = clampScore((10 - inputs.fatigue) * 10);
  const motivationScore = clampScore(inputs.motivation * 10);
  const weighted =
    sleepScore * 0.3 +
    sorenessScore * 0.3 +
    fatigueScore * 0.3 +
    motivationScore * 0.1;
  return Math.round(clampScore(weighted));
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
    const now = new Date();
    const inputs = parsedInputs.data;
    const uid = context.auth.uid;
    const inputHash = hashDecisionInputs(inputs);
    const inputHashPrefix = inputHash.slice(0, INPUT_HASH_PREFIX_LEN);
    const sleepLogContext = {
      sleepSource: inputs.sleepSource,
      sleepSampleAgeHours: inputs.sleepSampleAgeHours,
    } as const;

    let openAiAttempted = false;
    let openAiRetried = false;
    let latencyMsOpenAI = 0;
    let fallbackReason = "";

    const rateLimitResult = await checkAndConsumeServerRateLimit(uid, now);
    if (!rateLimitResult.allowed) {
      logDecisionEvent({
        uid,
        pathUsed: "RATE_LIMITED",
        ...sleepLogContext,
        openAiAttempted: false,
        openAiRetried: false,
        latencyMsTotal: Date.now() - startMs,
        latencyMsOpenAI: 0,
        inputHashPrefix,
        fallbackReason: "rate_limited",
        rateLimited: true,
      });
      throw new functions.https.HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const decisionGateResult = await checkAndConsumeServerDecisionGate(uid, now);
    if (!decisionGateResult.allowed) {
      const details =
        typeof decisionGateResult.retryAfterSeconds === "number"
          ? {
              reasonCode: decisionGateResult.reasonCode,
              retryAfterSeconds: decisionGateResult.retryAfterSeconds,
            }
          : { reasonCode: decisionGateResult.reasonCode };
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Decision gate blocked this request.",
        details
      );
    }

    const decisions = decisionGateResult.userData?.usage?.decisions;
    const tzOffsetMinutes = decisions?.tzOffsetMinutes;
    const lastInputHash = decisions?.lastInputHash;
    const lastResultCreatedAt = decisions?.lastResult?.createdAt;
    const lastResultOutput = decisions?.lastResult?.result;

    if (
      typeof tzOffsetMinutes === "number" &&
      typeof lastInputHash === "string" &&
      lastResultCreatedAt &&
      lastResultOutput
    ) {
      const lastResultDate = coerceToDate(lastResultCreatedAt);
      if (lastResultDate) {
        const today = getDateStringFromOffset(now, tzOffsetMinutes);
        const lastDay = getDateStringFromOffset(lastResultDate, tzOffsetMinutes);
        if (today === lastDay && lastInputHash === inputHash) {
          const parsedCache = sanitizeDecisionOutput(lastResultOutput);
          if (parsedCache.ok) {
            logDecisionEvent({
              uid,
              pathUsed: "CACHE_HIT",
              ...sleepLogContext,
              openAiAttempted: false,
              openAiRetried: false,
              latencyMsTotal: Date.now() - startMs,
              latencyMsOpenAI: 0,
              inputHashPrefix,
            });
            return parsedCache.data;
          }
          fallbackReason = parsedCache.reason;
        }
      }
    }

    if (!ENABLE_OPENAI_DECISION) {
      const fallback = getBoundedHeuristicDecision(inputs);
      logDecisionEvent({
        uid,
        pathUsed: "FALLBACK_HEURISTIC",
        ...sleepLogContext,
        openAiAttempted: false,
        openAiRetried: false,
        latencyMsTotal: Date.now() - startMs,
        latencyMsOpenAI: 0,
        inputHashPrefix,
        fallbackReason: "openai_disabled",
      });
      return fallback;
    }

    const prompt = [
      "Return ONLY valid JSON matching the schema.",
      "Task: choose one decision: PUSH, MAINTAIN, PULL_BACK.",
      "Base the decision on concrete factors: sleep, soreness, fatigue, motivation, and nutrition.",
      "Use weighted recovery emphasis aligned with app logic: sleep 30%, soreness 30%, fatigue 30%, motivation 10%.",
      "Recovery rule: very high soreness/fatigue should generally favor PULL_BACK unless other evidence is exceptionally strong.",
      "Readiness rule: strong recovery (good sleep, low soreness/fatigue, solid motivation) can justify PUSH.",
      "When signals are mixed without a clear edge, prefer MAINTAIN.",
      "If readiness is clearly strong (sleepHours >= 6, soreness <= 2, fatigue <= 2, motivation >= 7), prefer PUSH unless another risk is strong.",
      "Use sleep/fatigue/soreness/motivation as primary signals; nutrition is secondary.",
      "Nutrition rule: do not over-penalize calories logged so far today.",
      "Use yesterday/recent adherence for nutrition signal.",
      "Use nutrition, trainingPhase, and dietPhase as tie-break/modifier context, not as sole drivers.",
      "Explanation rules: 2-3 concise user-facing bullets, one point per bullet.",
      "Each bullet must be a complete sentence with plain language.",
      "Do not use shorthand like slashes or clipped endings.",
      "Do not mention readiness score or scoring bands.",
      "Cite at least two concrete factors among sleep, soreness, fatigue, motivation.",
      "Mention nutrition in at most one bullet and only if material.",
      "If phase context materially affects the call, mention trainingPhase or dietPhase in one bullet.",
      "Adjustments rule: MAINTAIN->null, PUSH->{10 or 20}, PULL_BACK->{-10 or -20}.",
      `Inputs: ${JSON.stringify(inputs)}`,
    ].join("\n");

    const attemptOpenAI = async (timeoutMs: number, maxOutputTokens: number) => {
      const attemptStart = Date.now();
      try {
      const response = await callOpenAIWithTimeout(
        prompt,
        Math.min(timeoutMs, OPENAI_TIMEOUT_MS),
        maxOutputTokens
      );
        latencyMsOpenAI += Date.now() - attemptStart;
        return { ok: true as const, response };
      } catch (err) {
        latencyMsOpenAI += Date.now() - attemptStart;
        return { ok: false as const, error: err };
      }
    };

    openAiAttempted = true;
    const firstAttempt = await attemptOpenAI(
      OPENAI_FIRST_ATTEMPT_MS,
      OPENAI_MAX_OUTPUT_TOKENS_FIRST
    );
    if (firstAttempt.ok) {
      let parseFailureReason = "";
      const outputObject = extractOutputObject(firstAttempt.response);
      if (outputObject) {
        const parsed = sanitizeDecisionOutput(outputObject);
        if (parsed.ok) {
          logDecisionEvent({
            uid,
            pathUsed: "OPENAI",
            ...sleepLogContext,
            openAiAttempted,
            openAiRetried,
            latencyMsTotal: Date.now() - startMs,
            latencyMsOpenAI,
            inputHashPrefix,
          });
          return parsed.data;
        }
        parseFailureReason = parsed.reason;
      }

      const outputText = extractOutputText(firstAttempt.response);
      if (outputText) {
        const parsed = parseAndSanitizeDecisionOutputText(outputText);
        if (parsed.ok) {
          logDecisionEvent({
            uid,
            pathUsed: "OPENAI",
            ...sleepLogContext,
            openAiAttempted,
            openAiRetried,
            latencyMsTotal: Date.now() - startMs,
            latencyMsOpenAI,
            inputHashPrefix,
          });
          return parsed.data;
        }
        parseFailureReason = parsed.reason;
      }
      logOpenAiFailureDebug("first_attempt_parse_failed", firstAttempt.response, parseFailureReason || undefined);
      fallbackReason = summarizeOpenAiResponseFailure(
        firstAttempt.response,
        parseFailureReason || undefined
      );
      if (OPENAI_RETRY_ENABLED && fallbackReason === "incomplete:max_output_tokens") {
        openAiRetried = true;
        const retryAttempt = await attemptOpenAI(
          OPENAI_RETRY_MS,
          OPENAI_MAX_OUTPUT_TOKENS_RETRY
        );
        if (retryAttempt.ok) {
          let retryParseFailureReason = "";
          const retryOutputObject = extractOutputObject(retryAttempt.response);
          if (retryOutputObject) {
            const parsed = sanitizeDecisionOutput(retryOutputObject);
            if (parsed.ok) {
              logDecisionEvent({
                uid,
                pathUsed: "OPENAI",
                ...sleepLogContext,
                openAiAttempted,
                openAiRetried,
                latencyMsTotal: Date.now() - startMs,
                latencyMsOpenAI,
                inputHashPrefix,
              });
              return parsed.data;
            }
            retryParseFailureReason = parsed.reason;
          }
          const retryOutputText = extractOutputText(retryAttempt.response);
          if (retryOutputText) {
            const parsed = parseAndSanitizeDecisionOutputText(retryOutputText);
            if (parsed.ok) {
              logDecisionEvent({
                uid,
                pathUsed: "OPENAI",
                ...sleepLogContext,
                openAiAttempted,
                openAiRetried,
                latencyMsTotal: Date.now() - startMs,
                latencyMsOpenAI,
                inputHashPrefix,
              });
              return parsed.data;
            }
            retryParseFailureReason = parsed.reason;
          }
          logOpenAiFailureDebug(
            "retry_after_incomplete",
            retryAttempt.response,
            retryParseFailureReason || undefined
          );
          fallbackReason = summarizeOpenAiResponseFailure(
            retryAttempt.response,
            retryParseFailureReason || undefined
          );
        } else {
          fallbackReason = summarizeOpenAiError(retryAttempt.error);
        }
      }
    } else if (OPENAI_RETRY_ENABLED && isTransientOpenAiError(firstAttempt.error)) {
      openAiRetried = true;
      const retryAttempt = await attemptOpenAI(
        OPENAI_RETRY_MS,
        OPENAI_MAX_OUTPUT_TOKENS_RETRY
      );
      if (retryAttempt.ok) {
        let parseFailureReason = "";
        const outputObject = extractOutputObject(retryAttempt.response);
        if (outputObject) {
          const parsed = sanitizeDecisionOutput(outputObject);
          if (parsed.ok) {
            logDecisionEvent({
              uid,
              pathUsed: "OPENAI",
              ...sleepLogContext,
              openAiAttempted,
              openAiRetried,
              latencyMsTotal: Date.now() - startMs,
              latencyMsOpenAI,
              inputHashPrefix,
            });
            return parsed.data;
          }
          parseFailureReason = parsed.reason;
        }

        const outputText = extractOutputText(retryAttempt.response);
        if (outputText) {
          const parsed = parseAndSanitizeDecisionOutputText(outputText);
          if (parsed.ok) {
            logDecisionEvent({
              uid,
              pathUsed: "OPENAI",
              ...sleepLogContext,
              openAiAttempted,
              openAiRetried,
              latencyMsTotal: Date.now() - startMs,
              latencyMsOpenAI,
              inputHashPrefix,
            });
            return parsed.data;
          }
          parseFailureReason = parsed.reason;
        }
        logOpenAiFailureDebug("retry_attempt_parse_failed", retryAttempt.response, parseFailureReason || undefined);
        fallbackReason = summarizeOpenAiResponseFailure(
          retryAttempt.response,
          parseFailureReason || undefined
        );
      } else {
        fallbackReason = summarizeOpenAiError(retryAttempt.error);
      }
    } else {
      fallbackReason = summarizeOpenAiError(firstAttempt.error);
    }

    const fallback = getBoundedHeuristicDecision(inputs);
    logDecisionEvent({
      uid,
      pathUsed: "FALLBACK_HEURISTIC",
      ...sleepLogContext,
      openAiAttempted,
      openAiRetried,
      latencyMsTotal: Date.now() - startMs,
      latencyMsOpenAI,
      inputHashPrefix,
      fallbackReason: fallbackReason || "openai_failed",
    });
    return fallback;
  });

export const setDevEntitlementOverride = functions
  .region("asia-northeast3")
  .runWith({ secrets: [DEV_UID_ALLOWLIST_SECRET] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    assertDevUidAllowed(context.auth.uid);

    if (!DEV_OVERRIDE_ENABLED) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "devOverrideIsSubscribed is only honored in the Functions emulator."
      );
    }

    const schema = z.object({ isSubscribed: z.boolean() });
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid override payload: ${formatZodError(parsed.error)}`
      );
    }

    await admin
      .firestore()
      .doc(`users/${context.auth.uid}`)
      .set(
        {
          entitlement: {
            devOverrideIsSubscribed: parsed.data.isSubscribed,
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    return { ok: true };
  });

export const debugOpenAiPing = functions
  .region("asia-northeast3")
  .runWith({ secrets: [OPENAI_API_KEY, DEV_UID_ALLOWLIST_SECRET] })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    assertDevUidAllowed(context.auth.uid);

    const startedAt = Date.now();
    try {
      const response = await callOpenAIPingWithTimeout(3000);
      const outputText = extractOutputText(response);
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        outputPreview: outputText.slice(0, 20),
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: summarizeOpenAiError(error),
      };
    }
  });

export const debugOpenAiDecision = functions
  .region("asia-northeast3")
  .runWith({ secrets: [OPENAI_API_KEY, DEV_UID_ALLOWLIST_SECRET] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    assertDevUidAllowed(context.auth.uid);

    const schema = z
      .object({
        prompt: z.string().min(1).max(8000).optional(),
        timeoutMs: z.number().int().min(1000).max(20000).optional(),
        maxOutputTokens: z.number().int().min(32).max(1200).optional(),
      })
      .strict();
    const parsed = schema.safeParse(data ?? {});
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid debug payload: ${formatZodError(parsed.error)}`
      );
    }

    const prompt =
      parsed.data.prompt ??
      "Return a JSON object with keys decision, explanation, adjustments using allowed values.";
    const timeoutMs = parsed.data.timeoutMs ?? 5000;
    const maxOutputTokens = parsed.data.maxOutputTokens ?? 260;
    const startedAt = Date.now();
    try {
      const response = await callOpenAIWithTimeout(prompt, timeoutMs, maxOutputTokens);
      const debug = buildOpenAiResponseDebug(response);
      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        debug,
        outputPreview: extractOutputText(response).slice(0, 300),
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: summarizeOpenAiError(error),
      };
    }
  });

export const resetDailyLimit = functions
  .region("asia-northeast3")
  .runWith({ secrets: [DEV_UID_ALLOWLIST_SECRET] })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    assertDevUidAllowed(context.auth.uid);

    const now = new Date();
    const userRef = admin.firestore().doc(`users/${context.auth.uid}`);
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.data();
      const decisions = data?.usage?.decisions ?? {};
      const tzOffsetMinutes =
        typeof decisions.tzOffsetMinutes === "number" ? decisions.tzOffsetMinutes : 540;
      const today = getDateStringForOffset(now, tzOffsetMinutes);
      const decisionTimestamps = coerceTimestampArray(decisions.decisionTimestamps);
      const filteredTimestamps = decisionTimestamps.filter(
        (timestamp) => getDateStringForOffset(timestamp, tzOffsetMinutes) !== today
      );

      tx.set(
        userRef,
        {
          usage: {
            decisions: {
              decisionTimestamps: filteredTimestamps.map((timestamp) =>
                admin.firestore.Timestamp.fromDate(timestamp)
              ),
            },
          },
        },
        { merge: true }
      );
    });

    return { ok: true };
  });

export const resetCooldown = functions
  .region("asia-northeast3")
  .runWith({ secrets: [DEV_UID_ALLOWLIST_SECRET] })
  .https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    assertDevUidAllowed(context.auth.uid);

    const userRef = admin.firestore().doc(`users/${context.auth.uid}`);
    await admin.firestore().runTransaction(async (tx) => {
      tx.set(
        userRef,
        {
          usage: {
            decisions: {
              cooldownUntil: null,
            },
          },
        },
        { merge: true }
      );
    });

    return { ok: true };
  });

export const deleteMyAccount = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const schema = z.object({ confirmDelete: z.literal(true) });
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid delete payload: ${formatZodError(parsed.error)}`
      );
    }

    const uid = context.auth.uid;
    const userRef = admin.firestore().doc(`users/${uid}`);

    await admin.firestore().recursiveDelete(userRef);
    await admin.auth().deleteUser(uid);

    return { ok: true };
  });

export const revenuecatWebhook = functions
  .region("asia-northeast3")
  .runWith({ secrets: [REVENUECAT_WEBHOOK_AUTH] })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const authorizationHeader = req.get("authorization");
    if (!isRevenueCatWebhookAuthorized(authorizationHeader)) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const event =
      req.body && typeof req.body.event === "object" && req.body.event
        ? (req.body.event as Record<string, unknown>)
        : (req.body as Record<string, unknown>);

    const appUserId =
      typeof event?.app_user_id === "string" ? event.app_user_id.trim() : "";
    if (!appUserId) {
      res.status(400).json({ ok: false, error: "missing_app_user_id" });
      return;
    }

    const eventId = typeof event.id === "string" ? event.id : "";
    const eventType =
      typeof event.type === "string" ? event.type.toUpperCase().trim() : "";
    const productId = typeof event.product_id === "string" ? event.product_id : null;
    const expirationAtMs = toMsNumber(event.expiration_at_ms);
    const eventTimestampMs = toMsNumber(event.event_timestamp_ms);
    const hasPremiumEntitlement = touchesPremiumEntitlement(event);
    const processedAt = new Date().toISOString();

    logRevenueCatLifecycleEvent("RC_EVENT", {
      app_user_id: appUserId,
      event_id: eventId,
      event_type: eventType,
      product_id: productId,
      expiration_at_ms: expirationAtMs,
      processed_at: processedAt,
    });

    if (eventType === "TEST") {
      res.status(200).json({ ok: true, ignored: true, reason: "test_event" });
      return;
    }

    if (!hasPremiumEntitlement) {
      res.status(200).json({ ok: true, ignored: true, reason: "non_premium_event" });
      return;
    }

    const expiresAt =
      typeof expirationAtMs === "number"
        ? admin.firestore.Timestamp.fromMillis(expirationAtMs)
        : null;

    const userRef = admin.firestore().doc(`users/${appUserId}`);
    const result = await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const entitlement = snap.data()?.entitlement ?? {};
      const lastEventId =
        typeof entitlement.lastEventId === "string" ? entitlement.lastEventId : "";
      const lastEventTimestampMs =
        typeof entitlement.lastEventTimestampMs === "number"
          ? entitlement.lastEventTimestampMs
          : null;
      const currentIsSubscribed =
        typeof entitlement.isSubscribed === "boolean" ? entitlement.isSubscribed : false;
      const hasPermanentGrant = hasPermanentPremiumGrant(entitlement);

      if (hasPermanentGrant) {
        return {
          skipped: true,
          reason: "manual_grant_locked" as const,
          previousIsSubscribed: currentIsSubscribed,
          nextIsSubscribed: true,
        };
      }

      if (eventId && lastEventId === eventId) {
        return {
          skipped: true,
          reason: "duplicate_event_id" as const,
          previousIsSubscribed: currentIsSubscribed,
          nextIsSubscribed: currentIsSubscribed,
        };
      }

      if (
        typeof eventTimestampMs === "number" &&
        typeof lastEventTimestampMs === "number" &&
        eventTimestampMs < lastEventTimestampMs
      ) {
        return {
          skipped: true,
          reason: "stale_event" as const,
          previousIsSubscribed: currentIsSubscribed,
          nextIsSubscribed: currentIsSubscribed,
        };
      }

      const mapped = mapRevenueCatEventToSubscriptionStatus(eventType, currentIsSubscribed);
      if (!mapped.shouldMutate) {
        return {
          skipped: true,
          reason: "ignored_event" as const,
          previousIsSubscribed: currentIsSubscribed,
          nextIsSubscribed: currentIsSubscribed,
        };
      }

      const nextEventTimestampMs =
        eventTimestampMs ?? lastEventTimestampMs ?? Date.now();

      tx.set(
        userRef,
        {
          entitlement: {
            isSubscribed: mapped.isSubscribed,
            source: "revenuecat",
            productId,
            expiresAt,
            lastEventId: eventId,
            lastEventTimestampMs: nextEventTimestampMs,
            lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

      return {
        skipped: false,
        reason: null as null,
        previousIsSubscribed: currentIsSubscribed,
        nextIsSubscribed: mapped.isSubscribed,
      };
    });

    if (result.skipped && result.reason === "duplicate_event_id") {
      logRevenueCatLifecycleEvent("duplicate_event_skipped", {
        app_user_id: appUserId,
        event_id: eventId,
        event_type: eventType,
        product_id: productId,
        expiration_at_ms: expirationAtMs,
        processed_at: processedAt,
        is_subscribed: result.nextIsSubscribed,
      });
    } else if (result.skipped && result.reason === "stale_event") {
      logRevenueCatLifecycleEvent("stale_event_skipped", {
        app_user_id: appUserId,
        event_id: eventId,
        event_type: eventType,
        product_id: productId,
        expiration_at_ms: expirationAtMs,
        processed_at: processedAt,
        is_subscribed: result.nextIsSubscribed,
      });
    } else if (result.skipped && result.reason === "manual_grant_locked") {
      logRevenueCatLifecycleEvent("manual_grant_locked_skipped", {
        app_user_id: appUserId,
        event_id: eventId,
        event_type: eventType,
        product_id: productId,
        expiration_at_ms: expirationAtMs,
        processed_at: processedAt,
        is_subscribed: result.nextIsSubscribed,
      });
    } else if (!result.skipped) {
      if (!result.previousIsSubscribed && result.nextIsSubscribed) {
        logRevenueCatLifecycleEvent("entitlement_activated", {
          app_user_id: appUserId,
          event_id: eventId,
          event_type: eventType,
          product_id: productId,
          expiration_at_ms: expirationAtMs,
          processed_at: processedAt,
          is_subscribed: result.nextIsSubscribed,
        });
      } else if (result.previousIsSubscribed && !result.nextIsSubscribed) {
        logRevenueCatLifecycleEvent("entitlement_expired", {
          app_user_id: appUserId,
          event_id: eventId,
          event_type: eventType,
          product_id: productId,
          expiration_at_ms: expirationAtMs,
          processed_at: processedAt,
          is_subscribed: result.nextIsSubscribed,
        });
      }
    }

    res.status(200).json({ ok: true, skipped: result.skipped, reason: result.reason });
  });
