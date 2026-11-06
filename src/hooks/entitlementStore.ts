import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { ENTITLEMENT_FIELDS, USER_ENTITLEMENT_FIELD, USERS_COLLECTION } from "../contracts";
import { isExpectedOfflineError } from "../utils/networkErrors";

export type EntitlementResult = {
  state: "loading" | "inactive" | "active";
  isSubscribed: boolean | null;
};

// Each hook creates a new store when its account changes. Values and callbacks
// from an old store can never become the new account's snapshot.
export function createEntitlementStore(uid: string | null) {
  let snapshot: EntitlementResult = { state: "loading", isSubscribed: null };
  return {
    getSnapshot: () => snapshot,
    subscribe: (changed: () => void) => {
      if (!uid) return () => {};
      let active = true;
      const publish = (subscribed: boolean) => {
        if (!active) return;
        snapshot = { state: subscribed ? "active" : "inactive", isSubscribed: subscribed };
        changed();
      };
      const unsubscribe = onSnapshot(doc(db, USERS_COLLECTION, uid), value => {
        const entitlement = value.data()?.[USER_ENTITLEMENT_FIELD];
        publish(value.exists() && (entitlement?.[ENTITLEMENT_FIELDS.manualGrantPermanent] === true ||
          entitlement?.[ENTITLEMENT_FIELDS.isSubscribed] === true));
      }, error => {
        if (!active) return;
        if (!isExpectedOfflineError(error)) console.log("Failed to read entitlement", error);
        publish(false);
      });
      return () => { active = false; unsubscribe(); };
    },
  };
}
