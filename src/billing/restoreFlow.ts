import type { RestoreResult } from "../contracts";
import type { CustomerInfo } from "react-native-purchases";
import { ENTITLEMENT_ID, PRODUCT_ID_ANNUAL, PRODUCT_ID_MONTHLY } from "../config/billingConfig";

export const RESTORE_MESSAGES = {
  loading: "Checking purchases...",
  restored: "Purchases restored. Premium is active.",
  alreadyActive: "An active subscription was found. This account already has Premium access independently of that subscription.",
  notFound: "No active subscription found. Make sure you're using the Google Play account you subscribed with.",
  unconfirmed: "An active subscription was found, but Lastrep hasn't confirmed Premium access yet. Please try again shortly.",
  failed: "Couldn't restore purchases. Check your connection and try again.",
} as const;

export type RestoreOutcome = "restored" | "alreadyActive" | "notFound" | "unconfirmed" | "failed";
export type RestoreDependencies = {
  identify: (uid: string) => Promise<void>;
  restore: () => Promise<RestoreResult>;
  confirm: (uid: string, productId: string, signal: AbortSignal) => Promise<boolean | "existingAccess">;
  currentUid: () => string | null;
};

// SDK and webhook identifiers can differ by Google's base-plan suffix.
export function samePlayProduct(left: string, right: string): boolean {
  const [leftId, leftPlan] = left.split(":");
  const [rightId, rightPlan] = right.split(":");
  return leftId === rightId && (!leftPlan || !rightPlan || leftPlan === rightPlan);
}
const isLastrepProduct = (id: string) => [PRODUCT_ID_MONTHLY, PRODUCT_ID_ANNUAL].includes(id.split(":")[0]);

function subscriptionExpired(info: CustomerInfo, productId: string, at: number): boolean {
  const dates = info.allExpirationDates ?? {};
  const expirations = Object.prototype.hasOwnProperty.call(dates, productId)
    ? [dates[productId]] : Object.entries(dates).filter(([id]) => samePlayProduct(id, productId)).map(([, date]) => date);
  if (!expirations.length) {
    const premium = info.entitlements.all?.[ENTITLEMENT_ID] ?? info.entitlements.active[ENTITLEMENT_ID];
    if (premium && samePlayProduct(premium.productIdentifier, productId)) expirations.push(premium.expirationDate);
  }
  // Missing/invalid dates are not evidence of expiry; backend confirmation is still required.
  return expirations.length > 0 && expirations.every((date) => typeof date === "string" &&
    Number.isFinite(Date.parse(date)) && Date.parse(date) <= at);
}

export function isPermanentPremiumConfirmed(data: unknown, fromCache: boolean): boolean {
  return !fromCache && !!data && typeof data === "object" &&
    (data as Record<string, unknown>).manualGrantPermanent === true;
}

export function isPaidPremiumConfirmed(data: unknown, productId: string, fromCache: boolean): boolean {
  if (fromCache || !data || typeof data !== "object") return false;
  const entitlement = data as Record<string, unknown>;
  if (entitlement.manualGrantPermanent === true) return false;
  if (entitlement.isSubscribed !== true || entitlement.source !== "revenuecat" ||
    typeof entitlement.productId !== "string" || !samePlayProduct(entitlement.productId, productId)) return false;
  const expiry = entitlement.expiresAt as { toMillis?: () => number } | null;
  return !expiry || (typeof expiry.toMillis === "function" && expiry.toMillis() > Date.now());
}

/** A successful store request is not proof of either a purchase or backend access. */
export async function runRestoreFlow(uid: string, signal: AbortSignal, deps: RestoreDependencies): Promise<RestoreOutcome | null> {
  const cancelled = () => signal.aborted || deps.currentUid() !== uid;
  if (cancelled()) return null;
  try {
    await deps.identify(uid);
    if (cancelled()) return null;
    const result = await deps.restore();
    if (cancelled()) return null;
    if (result.status === "ERROR") return "failed";
    const info = result.customerInfo;
    const observedAt = Date.now();
    const requestedAt = Date.parse(info.requestDate);
    // Use RevenueCat's response clock, rather than a potentially skewed phone clock.
    const referenceAt = Number.isFinite(requestedAt) ? requestedAt : observedAt;
    const activeSubscriptions = () => info.activeSubscriptions.filter((id) => isLastrepProduct(id) &&
      !subscriptionExpired(info, id, referenceAt + Math.max(0, Date.now() - observedAt)));
    const subscription = activeSubscriptions()[0];
    if (!subscription) return "notFound";
    // Only Lastrep's active Play subscription qualifies, not other purchases or grants.
    const premium = info.entitlements.active[ENTITLEMENT_ID];
    const mapped = premium?.isActive && premium.store === "PLAY_STORE" && isLastrepProduct(premium.productIdentifier);
    const productId = mapped ? premium.productPlanIdentifier && !premium.productIdentifier.includes(":")
      ? `${premium.productIdentifier}:${premium.productPlanIdentifier}` : premium.productIdentifier : subscription;
    if (!activeSubscriptions().some((id) => samePlayProduct(id, productId))) return "unconfirmed";
    let confirmed: boolean | "existingAccess" = false;
    try { confirmed = await deps.confirm(uid, productId, signal); } catch {
      // A backend read failure is not "no purchase" once a purchase was found.
    }
    if (cancelled()) return null;
    if (!activeSubscriptions().some((id) => samePlayProduct(id, productId))) return "notFound";
    if (confirmed === "existingAccess") return "alreadyActive";
    return mapped && confirmed ? "restored" : "unconfirmed";
  } catch { return cancelled() ? null : "failed"; }
}

/** One request per controller; cancellation suppresses late native SDK results. */
export function createRestoreController(deps: RestoreDependencies) {
  let inFlight = false;
  let active: AbortController | null = null;
  return {
    cancel() { active?.abort(); },
    async run(uid: string, publish: (message: string, busy: boolean) => void) {
      if (inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      active = controller;
      publish(RESTORE_MESSAGES.loading, true);
      try {
        const outcome = await runRestoreFlow(uid, controller.signal, deps);
        if (outcome && !controller.signal.aborted && deps.currentUid() === uid) {
          publish(RESTORE_MESSAGES[outcome], false);
        }
        return outcome;
      } finally {
        inFlight = false;
        if (active === controller) active = null;
      }
    },
  };
}
