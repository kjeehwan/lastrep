import { doc, runTransaction } from "firebase/firestore";
import { db } from "./config/firebaseConfig";
import { applyDecisionUsage, canUseDecision, normalizeDecisionUsage } from "./decisionGate";
import { buildDefaultEntitlement, getDecisionUsage } from "./userData";

export const gateAndConsumeDecision = async (userId, now = new Date()) => {
  const userRef = doc(db, "users", userId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists() ? snap.data() : {};

    const entitlement = data.entitlement ?? buildDefaultEntitlement();
    const decisionsBase = getDecisionUsage(data, now, data?.usage?.decisions?.tzOffsetMinutes ?? now.getTimezoneOffset());
    const tzOffsetMinutes = decisionsBase.tzOffsetMinutes ?? now.getTimezoneOffset();
    const decisions = normalizeDecisionUsage(decisionsBase, now, tzOffsetMinutes);
    const usage = { ...data.usage, decisions };

    const gate = canUseDecision(entitlement, usage, now, tzOffsetMinutes);
    if (!gate.allowed) {
      return gate;
    }

    const nextUsage = applyDecisionUsage(entitlement, usage, now, tzOffsetMinutes);
    tx.set(
      userRef,
      {
        usage: { decisions: nextUsage.decisions },
      },
      { merge: true }
    );

    return { allowed: true, reason: "OK", updatedUsage: nextUsage.decisions };
  });
};
