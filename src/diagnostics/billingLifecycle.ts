export type BillingLifecycleClientEvent =
  | "paywall_opened"
  | "offerings_fetched"
  | "purchase_attempted"
  | "purchase_result"
  | "restore_attempted"
  | "restore_result"
  | "entitlement_state_changed";

type BillingLifecycleParamValue = string | number | boolean | null | undefined;
type BillingLifecycleParams = Record<string, BillingLifecycleParamValue>;

export function sanitizeBillingLifecycleParams(
  params?: BillingLifecycleParams
): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;

  const sanitizedEntries = Object.entries(params).filter(([, value]) => {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return typeof value === "number" || typeof value === "boolean";
  });

  if (sanitizedEntries.length === 0) return undefined;

  return Object.fromEntries(sanitizedEntries) as Record<string, string | number | boolean>;
}

export function buildBillingLifecyclePayload(
  event: BillingLifecycleClientEvent,
  params?: BillingLifecycleParams,
  timestamp = new Date().toISOString()
): Record<string, string | number | boolean> {
  return {
    event,
    timestamp,
    ...(sanitizeBillingLifecycleParams(params) ?? {}),
  };
}

export function logBillingLifecycleEvent(
  event: BillingLifecycleClientEvent,
  params?: BillingLifecycleParams
): void {
  console.log("[billing_lifecycle]", buildBillingLifecyclePayload(event, params));
}
