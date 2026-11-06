import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createEntitlementStore, type EntitlementResult } from "./entitlementStore";
import { logBillingLifecycleEvent } from "../diagnostics/billingLifecycle";

export function useEntitlement(authReady: boolean, uid: string | null): EntitlementResult {
  const store = useMemo(() => createEntitlementStore(authReady ? uid : null), [authReady, uid]);
  const { state, isSubscribed } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const previousLogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const effectiveState = !authReady || !uid ? "loading" : state;
    const effectiveSubscribed = !authReady || !uid ? null : isSubscribed;
    const nextLogKey = `${authReady}:${uid ?? "signed_out"}:${effectiveState}:${effectiveSubscribed ?? "null"}`;
    if (previousLogKeyRef.current === nextLogKey) {
      return;
    }

    previousLogKeyRef.current = nextLogKey;
    logBillingLifecycleEvent("entitlement_state_changed", {
      auth_ready: authReady,
      uid_prefix: uid ? uid.slice(0, 8) : null,
      entitlement_state: effectiveState,
      is_subscribed: effectiveSubscribed,
    });
  }, [authReady, isSubscribed, state, uid]);

  if (!authReady || !uid) {
    return { state: "loading", isSubscribed: null };
  }

  return { state, isSubscribed };
}
