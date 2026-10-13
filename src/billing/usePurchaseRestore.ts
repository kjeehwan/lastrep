import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRestoreController } from "./restoreFlow";
import { restoreDependencies } from "./restoreAccountPurchases";
import { auth } from "../config/firebaseConfig";
import type { PaywallAnalyticsContext } from "../contracts";
import { getUidPrefix, logAnalyticsEvent } from "../analytics/analytics";
import { logBillingLifecycleEvent } from "../diagnostics/billingLifecycle";

export function usePurchaseRestore(uid: string | null, disabled: boolean, context: PaywallAnalyticsContext = {}) {
  const [state, setState] = useState<{ uid: string; message: string; busy: boolean } | null>(null);
  const [controller] = useState(() => createRestoreController(restoreDependencies));
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = !!uid && !disabled;
    setState(null);
    return () => { focused.current = false; controller.cancel(); };
  }, [controller, disabled, uid]));
  useEffect(() => () => controller.cancel(), [controller]);
  const restore = useCallback(async () => {
    if (!uid || disabled || !focused.current) return;
    const startedAt = Date.now();
    const params = { source_screen: context.sourceScreen, reason_code: context.reasonCode, uid_prefix: getUidPrefix(uid) };
    const outcome = await controller.run(uid, (message, busy) => {
      if (busy) {
        logBillingLifecycleEvent("restore_attempted", params);
        void logAnalyticsEvent("restore_started", params);
      }
      if (focused.current) setState({ uid, message, busy });
    });
    if (outcome && focused.current && auth.currentUser?.uid === uid) {
      const resultParams = { ...params, result_status: outcome, latency_ms: Date.now() - startedAt };
      logBillingLifecycleEvent("restore_result", resultParams);
      void logAnalyticsEvent(outcome === "restored" ? "restore_completed" : "restore_failed", resultParams);
    }
  }, [controller, disabled, uid, context.sourceScreen, context.reasonCode]);
  const current = state?.uid === uid ? state : null;
  return { restore, restoring: current?.busy ?? false, feedback: current?.message ?? null };
}
