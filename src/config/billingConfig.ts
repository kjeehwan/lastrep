// Centralized billing identifiers for Google Play + RevenueCat.
// Keep these stable once products are created in Play Console.

export const PRODUCT_ID_MONTHLY = "lastrep_premium_monthly";
export const PRODUCT_ID_ANNUAL = "lastrep_premium_annual";

export const ENTITLEMENT_ID = "premium";
export const OFFERING_ID = "default";

export const PACKAGE_ID_MONTHLY = "$rc_monthly";
export const PACKAGE_ID_ANNUAL = "$rc_annual";
export const MANAGE_SUBSCRIPTION_URL = "https://play.google.com/store/account/subscriptions";

export const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID!;
