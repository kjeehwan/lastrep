import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig";

type EntitlementState = "loading" | "inactive" | "active";

type UseEntitlementResult = {
  state: EntitlementState;
  isSubscribed: boolean | null;
};

export function useEntitlement(authReady: boolean, uid: string | null): UseEntitlementResult {
  const [state, setState] = useState<EntitlementState>("loading");
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authReady || !uid) {
      setState("loading");
      setIsSubscribed(null);
      return;
    }

    setState("loading");
    setIsSubscribed(null);

    const unsubscribe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const nextSubscribed =
          snap.exists() &&
          typeof snap.data()?.entitlement?.isSubscribed === "boolean" &&
          snap.data()?.entitlement?.isSubscribed === true;
        setIsSubscribed(nextSubscribed);
        setState(nextSubscribed ? "active" : "inactive");
      },
      (error) => {
        console.log("Failed to read entitlement", error);
        setIsSubscribed(false);
        setState("inactive");
      }
    );

    return unsubscribe;
  }, [authReady, uid]);

  return { state, isSubscribed };
}
