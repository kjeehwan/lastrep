import { describe, expect, test } from "vitest";
import { applyDecisionUsage, canUseDecision, getDateStringFromOffset, normalizeDecisionUsage } from "./decisionGate";

const tzOffsetMinutes = 0;

const makeUsage = (overrides = {}) => ({
  decisions: {
    freeRemaining: 3,
    dailyCount: 0,
    dailyDate: "2026-02-02",
    tzOffsetMinutes,
    ...overrides,
  },
});

describe("decisionGate", () => {
test("free: daily limit 1/day", () => {
  const now = new Date("2026-02-02T10:00:00Z");
  const usage = makeUsage({ dailyCount: 1 });
  const res = canUseDecision({ isSubscribed: false }, usage, now, tzOffsetMinutes);
  expect(res.allowed).toBe(false);
  expect(res.reason).toBe("FREE_DAILY_LIMIT");
});

test("free: exhausted blocks even if dailyCount is 0", () => {
  const now = new Date("2026-02-02T10:00:00Z");
  const usage = makeUsage({ freeRemaining: 0, dailyCount: 0 });
  const res = canUseDecision({ isSubscribed: false }, usage, now, tzOffsetMinutes);
  expect(res.allowed).toBe(false);
  expect(res.reason).toBe("FREE_EXHAUSTED");
});

test("paid: daily limit 3/day", () => {
  const now = new Date("2026-02-02T10:00:00Z");
  const usage = makeUsage({ dailyCount: 3 });
  const res = canUseDecision({ isSubscribed: true }, usage, now, tzOffsetMinutes);
  expect(res.allowed).toBe(false);
  expect(res.reason).toBe("PAID_DAILY_LIMIT");
});

test("paid: cooldown blocks even if dailyCount < 3", () => {
  const now = new Date("2026-02-02T10:00:00Z");
  const last = new Date("2026-02-02T09:45:00Z");
  const usage = makeUsage({ dailyCount: 1, lastDecisionAt: last });
  const res = canUseDecision({ isSubscribed: true }, usage, now, tzOffsetMinutes);
  expect(res.allowed).toBe(false);
  expect(res.reason).toBe("COOLDOWN");
  expect(res.cooldownRemainingMs).toBeGreaterThan(0);
});

test("normalize resets dailyCount when date changes", () => {
  const now = new Date("2026-02-03T01:00:00Z");
  const decisions = { dailyDate: "2026-02-02", dailyCount: 2 };
  const normalized = normalizeDecisionUsage(decisions, now, tzOffsetMinutes);
  expect(normalized.dailyCount).toBe(0);
  expect(normalized.dailyDate).toBe(getDateStringFromOffset(now, tzOffsetMinutes));
});

test("normalize resets when dailyDate is missing", () => {
  const now = new Date("2026-02-02T10:00:00Z");
  const decisions = { dailyCount: 1 };
  const normalized = normalizeDecisionUsage(decisions, now, tzOffsetMinutes);
  expect(normalized.dailyDate).toBe(getDateStringFromOffset(now, tzOffsetMinutes));
  expect(normalized.dailyCount).toBe(0);
});

test("normalize uses non-zero offset for local day", () => {
  const offset = 300; // UTC-5
  const now = new Date("2026-02-02T02:00:00Z");
  const today = getDateStringFromOffset(now, offset);
  const [y, m, d] = today.split("-").map(Number);
  const yesterdayUtc = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0));
  const yesterday = getDateStringFromOffset(yesterdayUtc, 0);
  const decisions = { dailyDate: yesterday, dailyCount: 1 };
  const normalized = normalizeDecisionUsage(decisions, now, offset);
  expect(normalized.dailyDate).toBe(today);
  expect(normalized.dailyCount).toBe(0);
});

test("applyDecisionUsage decrements freeRemaining", () => {
  const now = new Date("2026-02-02T10:00:00Z");
  const usage = makeUsage({ freeRemaining: 2 });
  const next = applyDecisionUsage({ isSubscribed: false }, usage, now, tzOffsetMinutes);
  expect(next.decisions.freeRemaining).toBe(1);
  expect(next.decisions.dailyCount).toBe(1);
});
});
