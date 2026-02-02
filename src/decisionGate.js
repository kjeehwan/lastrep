const MS_IN_MINUTE = 60 * 1000;

export const getDateStringFromOffset = (now, tzOffsetMinutes) => {
  const effective = new Date(now.getTime() - tzOffsetMinutes * 60 * 1000);
  const year = effective.getUTCFullYear();
  const month = String(effective.getUTCMonth() + 1).padStart(2, "0");
  const day = String(effective.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const normalizeDecisionUsage = (decisions = {}, now, tzOffsetMinutes) => {
  const today = getDateStringFromOffset(now, tzOffsetMinutes);
  const dailyDate = decisions.dailyDate || today;
  const freeRemaining =
    typeof decisions.freeRemaining === "number" ? decisions.freeRemaining : 3;
  const dailyCount =
    typeof decisions.dailyCount === "number" ? decisions.dailyCount : 0;
  if (!decisions.dailyDate || dailyDate !== today) {
    return {
      ...decisions,
      dailyDate: today,
      dailyCount: 0,
      freeRemaining,
      tzOffsetMinutes,
    };
  }
  return {
    ...decisions,
    dailyDate,
    dailyCount,
    freeRemaining,
    tzOffsetMinutes,
  };
};

export const canUseDecision = (entitlement = {}, usage = {}, now, tzOffsetMinutes) => {
  const isSubscribed = Boolean(entitlement.isSubscribed);
  const decisions = normalizeDecisionUsage(usage.decisions || {}, now, tzOffsetMinutes);
  const dailyCount = typeof decisions.dailyCount === "number" ? decisions.dailyCount : 0;
  const freeRemaining = typeof decisions.freeRemaining === "number" ? decisions.freeRemaining : 0;
  const today = getDateStringFromOffset(now, tzOffsetMinutes);

  if (!isSubscribed && freeRemaining <= 0) {
    return { allowed: false, reason: "FREE_EXHAUSTED" };
  }

  const maxPerDay = isSubscribed ? 3 : 1;
  if (dailyCount >= maxPerDay) {
    const [year, month, day] = today.split("-").map(Number);
    const nextLocalMidnightUtcMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0);
    const nextAvailableAt = new Date(nextLocalMidnightUtcMs + tzOffsetMinutes * 60 * 1000);
    return {
      allowed: false,
      reason: isSubscribed ? "PAID_DAILY_LIMIT" : "FREE_DAILY_LIMIT",
      nextAvailableAt,
    };
  }

  if (isSubscribed && decisions.lastDecisionAt) {
    const last = decisions.lastDecisionAt.toDate
      ? decisions.lastDecisionAt.toDate()
      : new Date(decisions.lastDecisionAt);
    const elapsed = now.getTime() - last.getTime();
    const cooldownMs = 30 * MS_IN_MINUTE;
    if (elapsed < cooldownMs) {
      return {
        allowed: false,
        reason: "COOLDOWN",
        cooldownRemainingMs: cooldownMs - elapsed,
        nextAvailableAt: new Date(last.getTime() + cooldownMs),
      };
    }
  }

  return { allowed: true, reason: "OK" };
};

export const applyDecisionUsage = (entitlement = {}, usage = {}, now, tzOffsetMinutes) => {
  const isSubscribed = Boolean(entitlement.isSubscribed);
  const decisions = normalizeDecisionUsage(usage.decisions || {}, now, tzOffsetMinutes);
  const next = { ...decisions };

  next.dailyCount = (typeof next.dailyCount === "number" ? next.dailyCount : 0) + 1;
  next.lastDecisionAt = now;
  next.tzOffsetMinutes = tzOffsetMinutes;

  if (!isSubscribed) {
    const freeRemaining = typeof next.freeRemaining === "number" ? next.freeRemaining : 0;
    next.freeRemaining = Math.max(0, freeRemaining - 1);
  }

  return { ...usage, decisions: next };
};
