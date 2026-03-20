import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import {
  ENTITLEMENT_FIELDS,
  USER_ENTITLEMENT_FIELD,
  USERS_COLLECTION,
} from "../contracts";
import { isExpectedOfflineError } from "../utils/networkErrors";

type EntitlementState = "loading" | "inactive" | "active";

type UseEntitlementResult = {
  state: EntitlementState;
  isSubscribed: boolean | null;
};

export function useEntitlement(authReady: boolean, uid: string | null): UseEntitlementResult {
  const [state, setState] = useState<EntitlementState>("loading");
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const previousLogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authReady || !uid) {
      setState("loading");
      setIsSubscribed(null);
      return;
    }

    setState("loading");
    setIsSubscribed(null);

    const unsubscribe = onSnapshot(
      doc(db, USERS_COLLECTION, uid),
      (snap) => {
        const entitlement = snap.data()?.[USER_ENTITLEMENT_FIELD];
        const nextSubscribed =
          snap.exists() &&
          typeof entitlement?.[ENTITLEMENT_FIELDS.isSubscribed] === "boolean" &&
          entitlement?.[ENTITLEMENT_FIELDS.isSubscribed] === true;
        setIsSubscribed(nextSubscribed);
        setState(nextSubscribed ? "active" : "inactive");
      },
      (error) => {
        if (!isExpectedOfflineError(error)) {
          console.log("Failed to read entitlement", error);
        }
        setIsSubscribed(false);
        setState("inactive");
      }
    );

    return unsubscribe;
  }, [authReady, uid]);

  useEffect(() => {
    if (!__DEV__) return;

    const nextLogKey = `${authReady}:${uid ?? "signed_out"}:${state}:${isSubscribed ?? "null"}`;
    if (previousLogKeyRef.current === nextLogKey) {
      return;
    }

    previousLogKeyRef.current = nextLogKey;
    console.log("[entitlement] transition", {
      authReady,
      uidPrefix: uid ? uid.slice(0, 8) : null,
      state,
      isSubscribed,
    });
  }, [authReady, isSubscribed, state, uid]);

  return { state, isSubscribed };
}
