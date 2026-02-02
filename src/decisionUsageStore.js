import { doc, runTransaction } from "firebase/firestore";
import { db } from "./config/firebaseConfig";
import { applyDecisionUsage, canUseDecision, normalizeDecisionUsage } from "./decisionGate";
import { buildDefaultEntitlement, getDecisionUsage } from "./userData";

const stripUndefined = (obj = {}) =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

export const gateAndConsumeDecision = async (userId, now = new Date()) => {
  const userRef = doc(db, "users", userId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const exists = snap.exists();
    const data = snap.exists() ? snap.data() : {};

    const entitlement = data.entitlement ?? buildDefaultEntitlement();
    const decisionsBase = getDecisionUsage(data, now, data?.usage?.decisions?.tzOffsetMinutes ?? now.getTimezoneOffset());
    const tzOffsetMinutes = decisionsBase.tzOffsetMinutes ?? now.getTimezoneOffset();
    const decisions = normalizeDecisionUsage(decisionsBase, now, tzOffsetMinutes);
    const usage = { ...data.usage, decisions };

    const gate = canUseDecision(entitlement, usage, now, tzOffsetMinutes);
    if (!gate.allowed) {
      return { ...gate, currentUsage: decisions };
    }

    const nextUsage = applyDecisionUsage(entitlement, usage, now, tzOffsetMinutes);
    const cleanedDecisions = stripUndefined(nextUsage.decisions);
    if (exists) {
      tx.update(userRef, {
        "usage.decisions.freeRemaining": cleanedDecisions.freeRemaining,
        "usage.decisions.dailyCount": cleanedDecisions.dailyCount,
        "usage.decisions.dailyDate": cleanedDecisions.dailyDate,
        "usage.decisions.tzOffsetMinutes": cleanedDecisions.tzOffsetMinutes,
        "usage.decisions.lastDecisionAt": cleanedDecisions.lastDecisionAt,
        ...(cleanedDecisions.lastInputsHash !== undefined
          ? { "usage.decisions.lastInputsHash": cleanedDecisions.lastInputsHash }
          : {}),
      });
    } else {
      tx.set(
        userRef,
        { usage: { decisions: cleanedDecisions } },
        { merge: true }
      );
    }

    return { allowed: true, reason: "OK", updatedUsage: nextUsage.decisions, currentUsage: nextUsage.decisions };
  });
};
