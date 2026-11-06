import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashDecisionInputs } from "./decisionHash";
import { sanitizeDecisionOutput } from "./decisionPipeline";

const mocks = vi.hoisted(() => ({
  user: {} as Record<string, unknown>,
  write: vi.fn(),
  transaction: vi.fn(),
  provider: vi.fn(function (): unknown { throw new Error("Provider must not be initialized"); }),
}));

// No credentials, network, or real account records are used by these handler tests.
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: vi.fn() }));
vi.mock("firebase-admin/firestore", async (original) => ({
  ...await original<typeof import("firebase-admin/firestore")>(),
  getFirestore: () => ({ doc: (path: string) => ({ path }), runTransaction: mocks.transaction }),
}));
vi.mock("openai", () => ({ default: mocks.provider }));
vi.mock("./profilePhotos", () => ({}));
vi.mock("./workoutSharing", () => ({}));
vi.mock("./sharingPage", () => ({}));
vi.mock("./sharingRetention", () => ({}));

const inputs = {
  sleepHours: 7, sleepSource: "manual" as const, sleepSampleAgeHours: null,
  soreness: 4, fatigue: 4, motivation: 7,
  trainingPhase: "Hypertrophy" as const, dietPhase: "Maintain" as const,
};
const context = { auth: { uid: "synthetic-legacy-client" } };
const handler = async () => {
  const module = await import("./index");
  return module.getDailyDecision.run;
};
const lastEvent = () => JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0]);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("ENABLE_OPENAI_DECISION", undefined);
  vi.stubEnv("FUNCTIONS_EMULATOR", undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  mocks.user = {};
  mocks.transaction.mockImplementation(async (body) => body({
    get: async () => ({ data: () => mocks.user }), set: mocks.write,
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("legacy callable with provider opt-in disabled", () => {
  it.each([undefined, "false", "FALSE", "invalid", ""])("uses the compatible fallback with flag %s", async (flag) => {
    vi.stubEnv("ENABLE_OPENAI_DECISION", flag);
    const result = await (await handler())(inputs, context as never);
    expect(sanitizeDecisionOutput(result).ok).toBe(true);
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.write).toHaveBeenCalledTimes(2);
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(lastEvent()).toMatchObject({
      pathUsed: "FALLBACK_HEURISTIC", fallbackReason: "openai_disabled",
      openAiAttempted: false, openAiRetried: false,
    });
  });

  it("rejects unauthenticated requests without reading or writing records", async () => {
    await expect((await handler())(inputs, {} as never)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("rejects malformed input before consuming a quota", async () => {
    await expect((await handler())({}, context as never)).rejects.toMatchObject({ code: "invalid-argument" });
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it("preserves valid same-day cached responses", async () => {
    const cached = { decision: "MAINTAIN", explanation: ["Keep a steady session today.", "Recovery signals are mixed."] };
    mocks.user = { usage: { decisions: {
      tzOffsetMinutes: 0, lastInputHash: hashDecisionInputs(inputs),
      lastResult: { createdAt: new Date(), result: cached },
    } } };
    const result = await (await handler())(inputs, context as never);
    expect(result.decision).toBe("MAINTAIN");
    expect(lastEvent()).toMatchObject({ pathUsed: "CACHE_HIT", openAiAttempted: false });
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("preserves the hourly rate gate", async () => {
    mocks.user = { usage: { decisions: { serverRateLimit: { windowStart: new Date(), count: 12 } } } };
    await expect((await handler())(inputs, context as never)).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("preserves the free-window gate before cache or fallback", async () => {
    mocks.user = { usage: { decisions: { decisionTimestamps: [new Date(), new Date(), new Date()] } } };
    await expect((await handler())(inputs, context as never)).rejects.toMatchObject({
      code: "failed-precondition", details: { reasonCode: "FREE_WINDOW_EXHAUSTED" },
    });
    expect(mocks.write).toHaveBeenCalledTimes(1);
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("surfaces storage failure and permits a later retry", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("synthetic storage failure"));
    const run = await handler();
    await expect(run(inputs, context as never)).rejects.toThrow("synthetic storage failure");
    expect(sanitizeDecisionOutput(await run(inputs, context as never)).ok).toBe(true);
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("does not export the retired provider debug callables", async () => {
    const exports = await import("./index");
    expect(exports).not.toHaveProperty("debugOpenAiPing");
    expect(exports).not.toHaveProperty("debugOpenAiDecision");
  });

  it("retains the provider integration for a future explicitly enabled feature", async () => {
    vi.stubEnv("ENABLE_OPENAI_DECISION", "true");
    vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
    const create = vi.fn().mockResolvedValue({ output_parsed: {
      decision: "MAINTAIN", explanation: ["Keep a steady session today.", "Recovery signals are mixed."],
    } });
    mocks.provider.mockImplementationOnce(function () { return { responses: { create } }; });
    const result = await (await handler())(inputs, context as never);
    expect(sanitizeDecisionOutput(result).ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ store: false });
    expect(lastEvent()).toMatchObject({ pathUsed: "OPENAI", openAiAttempted: true });
  });
});
