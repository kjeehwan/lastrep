import { ensureRevenueCatLoggedIn, restorePurchases, syncRevenueCatPurchases } from "./revenuecat";

/** Restore against the signed-in account; Firestore remains the entitlement authority. */
export async function restoreAccountPurchases(uid: string): Promise<void> {
  await ensureRevenueCatLoggedIn(uid);
  const result = await restorePurchases();
  if (result.status === "ERROR") throw new Error(result.errorCode || "restore_failed");
  await syncRevenueCatPurchases();
}
