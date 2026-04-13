export type PaywallSourceScreen =
  | "settings"
  | "home_gate"
  | "cooldown_gate"
  | "feature_gate";

export type PaywallReasonCode =
  | "decision_limit"
  | "cooldown_gate"
  | "feature_locked"
  | "manual_upgrade";

export type PaywallAnalyticsContext = {
  sourceScreen?: PaywallSourceScreen;
  reasonCode?: PaywallReasonCode;
};

export type MonetizationAnalyticsEvent =
  | "paywall_viewed"
  | "purchase_started"
  | "purchase_completed"
  | "purchase_cancelled"
  | "purchase_failed"
  | "restore_started"
  | "restore_completed"
  | "restore_failed"
  | "manage_subscription_tapped";

const PAYWALL_SOURCE_SCREENS: PaywallSourceScreen[] = [
  "settings",
  "home_gate",
  "cooldown_gate",
  "feature_gate",
];

const PAYWALL_REASON_CODES: PaywallReasonCode[] = [
  "decision_limit",
  "cooldown_gate",
  "feature_locked",
  "manual_upgrade",
];

export function normalizePaywallSourceScreen(value: unknown): PaywallSourceScreen | undefined {
  if (typeof value !== "string") return undefined;
  return PAYWALL_SOURCE_SCREENS.includes(value as PaywallSourceScreen)
    ? (value as PaywallSourceScreen)
    : undefined;
}

export function normalizePaywallReasonCode(value: unknown): PaywallReasonCode | undefined {
  if (typeof value !== "string") return undefined;
  return PAYWALL_REASON_CODES.includes(value as PaywallReasonCode)
    ? (value as PaywallReasonCode)
    : undefined;
}
