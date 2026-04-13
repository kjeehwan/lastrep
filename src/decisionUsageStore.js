import { doc, getDoc } from "firebase/firestore";
import { db } from "./config/firebaseConfig";
import { canUseDecision, normalizeDecisionUsage } from "./decisionGate";
import { buildDefaultEntitlement, getDecisionUsage } from "./userData";

export const gateAndConsumeDecision = async (userId, now = new Date()) => {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};

  const entitlement = data.entitlement ?? buildDefaultEntitlement();
  const decisionsBase = getDecisionUsage(
    data,
    now,
    data?.usage?.decisions?.tzOffsetMinutes ?? now.getTimezoneOffset()
  );
  const tzOffsetMinutes = decisionsBase.tzOffsetMinutes ?? now.getTimezoneOffset();
  const decisions = normalizeDecisionUsage(decisionsBase, now, tzOffsetMinutes);
  const usage = { ...data.usage, decisions };

  // Client-side check is only a UX pre-check. Server callables are authoritative.
  const gate = canUseDecision(entitlement, usage, now, tzOffsetMinutes);
  if (!gate.allowed) {
    return { ...gate, currentUsage: decisions };
  }

  return { allowed: true, reason: "OK", currentUsage: decisions };
};
