import { getAuth } from "firebase-admin/auth";
import { getFirestore, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";

async function authAccountExists(uid: string): Promise<boolean> {
  try {
    await getAuth().getUser(uid);
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") return false;
    throw error; // Transient Auth failures must be retried, not acknowledged as deletion.
  }
}

/** Billing never provisions account documents. Missing profiles on a live Auth
 * account are retriable (e.g. first-purchase/profile creation races). Deleting
 * and deleted accounts are acknowledged without creating data. */
export async function withBillingAccount<T>(
  uid: string,
  update: (transaction: Transaction, account: DocumentSnapshot) => Promise<T> | T,
  database = getFirestore(),
  accountExists = authAccountExists,
) {
  const skipped = (reason: "account_deleted" | "account_deleting") => ({
    skipped: true as const, reason,
    previousIsSubscribed: false, nextIsSubscribed: false,
  });
  if (!await accountExists(uid)) return skipped("account_deleted");
  return database.runTransaction(async transaction => {
    const account = await transaction.get(database.doc(`users/${uid}`));
    if (!account.exists) {
      // Throwing produces a failed webhook response so the provider can retry.
      // Never recreate the profile using only a subscription event.
      throw new Error("Billing account profile is not ready. Retry the event.");
    }
    if (account.data()?.profilePhotoDeletionStartedAt) return skipped("account_deleting");
    return update(transaction, account);
  });
}
