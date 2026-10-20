import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../config/firebaseConfig";
import { USERS_COLLECTION, USER_ENTITLEMENT_FIELD } from "../contracts";
import { ensureRevenueCatLoggedIn, restorePurchases } from "./revenuecat";
import { isPaidPremiumConfirmed, isPermanentPremiumConfirmed, type RestoreDependencies } from "./restoreFlow";

export const RESTORE_CONFIRM_TIMEOUT_MS = 10_000;

export function confirmRestoredPremium(uid: string, productId: string, signal: AbortSignal): Promise<boolean | "existingAccess"> {
  return new Promise((resolve) => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;
    const finish = (confirmed: boolean | "existingAccess") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      unsubscribe?.();
      resolve(confirmed);
    };
    const cancel = () => finish(false);
    const timer = setTimeout(cancel, RESTORE_CONFIRM_TIMEOUT_MS);
    if (signal.aborted || auth.currentUser?.uid !== uid) { finish(false); return; }
    signal.addEventListener("abort", cancel, { once: true });
    try {
      unsubscribe = onSnapshot(doc(db, USERS_COLLECTION, uid), { includeMetadataChanges: true }, (snapshot) => {
        if (signal.aborted || auth.currentUser?.uid !== uid) { finish(false); return; }
        const entitlement = snapshot.data()?.[USER_ENTITLEMENT_FIELD];
        const unconfirmed = snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites;
        if (isPermanentPremiumConfirmed(entitlement, unconfirmed)) finish("existingAccess");
        else if (isPaidPremiumConfirmed(entitlement, productId, unconfirmed)) finish(true);
      }, cancel);
      if (settled) unsubscribe();
    } catch { finish(false); }
  });
}

export const restoreDependencies: RestoreDependencies = {
  identify: ensureRevenueCatLoggedIn,
  restore: restorePurchases,
  confirm: confirmRestoredPremium,
  currentUid: () => auth.currentUser?.uid ?? null,
};
