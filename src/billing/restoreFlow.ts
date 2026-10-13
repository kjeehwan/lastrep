import type { RestoreResult } from "../contracts";
import { ENTITLEMENT_ID, PRODUCT_ID_ANNUAL, PRODUCT_ID_MONTHLY } from "../config/billingConfig";

export const RESTORE_MESSAGES = {
  loading: "Checking purchases...",
  restored: "Purchases restored. Premium is active.",
  notFound: "No active subscription found. Make sure you're using the Google Play account you subscribed with.",
  unconfirmed: "An active subscription was found, but Lastrep hasn't confirmed Premium access yet. Please try again shortly.",
  failed: "Couldn't restore purchases. Check your connection and try again.",
} as const;

export type RestoreOutcome = "restored" | "notFound" | "unconfirmed" | "failed";
export type RestoreDependencies = {
  identify: (uid: string) => Promise<void>;
  restore: () => Promise<RestoreResult>;
  confirm: (uid: string, productId: string, signal: AbortSignal) => Promise<boolean>;
  currentUid: () => string | null;
};

// SDK and webhook identifiers can differ by Google's base-plan suffix.
export function samePlayProduct(left: string, right: string): boolean {
  const [leftId, leftPlan] = left.split(":");
  const [rightId, rightPlan] = right.split(":");
  return leftId === rightId && (!leftPlan || !rightPlan || leftPlan === rightPlan);
}
const isLastrepProduct = (id: string) => [PRODUCT_ID_MONTHLY, PRODUCT_ID_ANNUAL].includes(id.split(":")[0]);

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
    const subscription = info.activeSubscriptions.find(isLastrepProduct);
    if (!subscription) return "notFound";
    // Only Lastrep's active Play subscription qualifies, not other purchases or grants.
    const premium = info.entitlements.active[ENTITLEMENT_ID];
    if (!premium?.isActive || premium.store !== "PLAY_STORE" || !isLastrepProduct(premium.productIdentifier)) return "unconfirmed";
    const productId = premium.productPlanIdentifier && !premium.productIdentifier.includes(":")
      ? `${premium.productIdentifier}:${premium.productPlanIdentifier}` : premium.productIdentifier;
    if (!info.activeSubscriptions.some((id) => samePlayProduct(id, productId))) return "unconfirmed";
    let confirmed = false;
    try { confirmed = await deps.confirm(uid, productId, signal); } catch {
      // A backend read failure is not "no purchase" once a purchase was found.
    }
    if (cancelled()) return null;
    return confirmed ? "restored" : "unconfirmed";
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
