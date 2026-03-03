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
  soreness: z.number(),
  fatigue: z.number(),
  motivation: z.number(),
  trainingPhase: z.enum(["Hypertrophy", "Strength", "Power"]),
  dietPhase: z.enum(["Cut", "Maintain", "Bulk"]),
});

const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => issue.message).join("; ");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const REVENUECAT_WEBHOOK_AUTH = defineSecret("REVENUECAT_WEBHOOK_AUTH");
const DEV_UID_ALLOWLIST_SECRET = defineSecret("DEV_UID_ALLOWLIST");
const DECISION_PROMPT_VERSION = "v3";
const OPENAI_TIMEOUT_MS = 12000;
const OPENAI_FIRST_ATTEMPT_MS = 9500;
const OPENAI_RETRY_MS = 2500;
const FALLBACK_REASON_MAX_LEN = 80;
const INPUT_HASH_PREFIX_LEN = 8;
const SERVER_RATE_LIMIT_MAX_COUNT = 12;
const SERVER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const FREE_MAX_PER_DAY = 1;
const FREE_MAX_PER_30_DAYS = 3;
const PAID_MAX_PER_DAY = 3;
const PAID_COOLDOWN_MS = 30 * 60 * 1000;
const ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const PREMIUM_ENTITLEMENT_ID = "premium";

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
  | "PAYWALL_REQUIRED"
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

    const override = parseBoolean(entitlement.devOverrideIsSubscribed);
    const isSubscribed = override ?? Boolean(entitlement.isSubscribed);

    if (!isSubscribed) {
      if (dailyCount >= FREE_MAX_PER_DAY) {
        return { allowed: false, reasonCode: "DAILY_LIMIT" };
      }
      if (decisionTimestamps.length >= FREE_MAX_PER_30_DAYS) {
        return { allowed: false, reasonCode: "FREE_WINDOW_EXHAUSTED" };
      }
    } else {
      if (dailyCount >= PAID_MAX_PER_DAY) {
        return { allowed: false, reasonCode: "DAILY_LIMIT" };
      }
      if (cooldownUntil && cooldownUntil.getTime() > nowMs) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((cooldownUntil.getTime() - nowMs) / 1000)
        );
        return { allowed: false, reasonCode: "COOLDOWN_ACTIVE", retryAfterSeconds };
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
            cooldownUntil: isSubscribed
              ? admin.firestore.Timestamp.fromDate(new Date(nowMs + PAID_COOLDOWN_MS))
              : null,
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

const premiumStatusFromWebhookEvent = (event: Record<string, unknown>): boolean | null => {
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids.filter((value): value is string => typeof value === "string")
    : [];
  const entitlementId =
    typeof event.entitlement_id === "string" ? event.entitlement_id : null;
  const touchesPremium =
    entitlementIds.includes(PREMIUM_ENTITLEMENT_ID) ||
    entitlementId === PREMIUM_ENTITLEMENT_ID;
  if (!touchesPremium) return null;

  const eventType = typeof event.type === "string" ? event.type.toUpperCase() : "";
  if (eventType === "EXPIRATION") {
    return false;
  }

  const expirationAtMs =
    typeof event.expiration_at_ms === "number" ? event.expiration_at_ms : null;
  if (expirationAtMs && expirationAtMs <= Date.now()) {
    return false;
  }

  return entitlementIds.includes(PREMIUM_ENTITLEMENT_ID) || entitlementId === PREMIUM_ENTITLEMENT_ID;
};

const getBoundedHeuristicDecision = (inputs: DecisionInputs): DecisionOutput => {
  const heuristic = heuristicDecision(inputs);
  const sanitized = sanitizeDecisionOutput(heuristic);
  return sanitized.ok ? sanitized.data : heuristic;
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

    let openAiAttempted = false;
    let openAiRetried = false;
    let latencyMsOpenAI = 0;
    let fallbackReason = "";

    const rateLimitResult = await checkAndConsumeServerRateLimit(uid, now);
    if (!rateLimitResult.allowed) {
      logDecisionEvent({
        uid,
        pathUsed: "RATE_LIMITED",
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
      "You are a strength training decision engine.",
      "Return ONLY a JSON object that matches the schema.",
      "Use the provided inputs to choose the best decision: PUSH, MAINTAIN, or PULL_BACK.",
      "Prefer MAINTAIN when signals are mixed or unclear.",
      "Output rules:",
      "- Always include decision and explanation.",
      "- Explanation should have 2-4 short bullets.",
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
        const parsed = parseAndSanitizeDecisionOutputText(outputText);
        if (parsed.ok) {
          logDecisionEvent({
            uid,
            pathUsed: "OPENAI",
            openAiAttempted,
            openAiRetried,
            latencyMsTotal: Date.now() - startMs,
            latencyMsOpenAI,
            inputHashPrefix,
          });
          return parsed.data;
        }
        fallbackReason = parsed.reason;
      } else {
        fallbackReason = "empty_response";
      }
    } else if (isTransientOpenAiError(firstAttempt.error)) {
      openAiRetried = true;
      const retryAttempt = await attemptOpenAI(OPENAI_RETRY_MS);
      if (retryAttempt.ok) {
        const outputText = extractOutputText(retryAttempt.response);
        if (outputText) {
          const parsed = parseAndSanitizeDecisionOutputText(outputText);
          if (parsed.ok) {
            logDecisionEvent({
              uid,
              pathUsed: "OPENAI",
              openAiAttempted,
              openAiRetried,
              latencyMsTotal: Date.now() - startMs,
              latencyMsOpenAI,
              inputHashPrefix,
            });
            return parsed.data;
          }
          fallbackReason = parsed.reason;
        } else {
          fallbackReason = "empty_response";
        }
      } else {
        fallbackReason = "exception";
      }
    } else {
      fallbackReason = "exception";
    }

    const fallback = getBoundedHeuristicDecision(inputs);
    logDecisionEvent({
      uid,
      pathUsed: "FALLBACK_HEURISTIC",
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    return { ok: true };
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

    const isSubscribed = premiumStatusFromWebhookEvent(event);
    if (isSubscribed === null) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    await admin
      .firestore()
      .doc(`users/${appUserId}`)
      .set(
        {
          entitlement: {
            isSubscribed,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    res.status(200).json({ ok: true });
  });
