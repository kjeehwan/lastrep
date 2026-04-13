import type { Timestamp } from "firebase/firestore";

export const USERS_COLLECTION = "users" as const;
export const USER_ENTITLEMENT_FIELD = "entitlement" as const;
export const USER_ENTITLEMENT_PATH = `${USERS_COLLECTION}/{uid}.${USER_ENTITLEMENT_FIELD}` as const;

export const ENTITLEMENT_FIELDS = {
  isSubscribed: "isSubscribed",
  source: "source",
  productId: "productId",
  expiresAt: "expiresAt",
  lastEventId: "lastEventId",
  lastEventTimestampMs: "lastEventTimestampMs",
  lastUpdatedAt: "lastUpdatedAt",
  devOverrideIsSubscribed: "devOverrideIsSubscribed",
  manualGrantPermanent: "manualGrantPermanent",
} as const;

export const CLIENT_ENTITLEMENT_FIELDS = [
  ENTITLEMENT_FIELDS.isSubscribed,
  ENTITLEMENT_FIELDS.source,
  ENTITLEMENT_FIELDS.productId,
  ENTITLEMENT_FIELDS.expiresAt,
] as const;

export const SERVER_ENTITLEMENT_FIELDS = [
  ENTITLEMENT_FIELDS.lastEventId,
  ENTITLEMENT_FIELDS.lastEventTimestampMs,
  ENTITLEMENT_FIELDS.lastUpdatedAt,
] as const;

export const OPTIONAL_ENTITLEMENT_FIELDS = [
  ENTITLEMENT_FIELDS.devOverrideIsSubscribed,
  ENTITLEMENT_FIELDS.manualGrantPermanent,
] as const;

export const ENTITLEMENT_DEV_OVERRIDE_POLICY = "emulator_only" as const;

export type EntitlementSource = "revenuecat";

/**
 * Canonical entitlement snapshot stored at `users/{uid}.entitlement`.
 *
 * The entitlement map is server-owned and may be absent entirely until the
 * server writes the first authoritative snapshot.
 */
export interface UserEntitlement {
  isSubscribed: boolean;
  source: EntitlementSource | null;
  productId: string | null;
  expiresAt: Timestamp | null;
  lastEventId: string;
  lastEventTimestampMs: number;
  lastUpdatedAt: Timestamp | null;
  /**
   * Dev-only, non-authoritative override. Applied only by emulator-backed
   * functions and ignored by deployed production functions.
   */
  devOverrideIsSubscribed?: boolean;
  /**
   * Server-owned support/reviewer override that keeps entitlement paid and
   * blocks RevenueCat webhook mutations for this user.
   */
  manualGrantPermanent?: boolean;
}

export type ClientReadableEntitlement = Pick<
  UserEntitlement,
  (typeof CLIENT_ENTITLEMENT_FIELDS)[number]
> &
  Partial<Pick<UserEntitlement, (typeof OPTIONAL_ENTITLEMENT_FIELDS)[number]>>;
