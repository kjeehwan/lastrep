import { useEffect, useRef } from "react";
import * as SplashScreen from "expo-splash-screen";
import { createStartupHandoff } from "./startupHandoff";

export function useStartupReady(ready: boolean, maxWaitMs?: number, enabled = true) {
  const handoff = useRef<ReturnType<typeof createStartupHandoff> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const current = createStartupHandoff(() => {
      void SplashScreen.hideAsync().catch(() => {});
    }, maxWaitMs);
    handoff.current = current;
    return () => { current.dispose(); handoff.current = null; };
  }, [maxWaitMs, enabled]);
  useEffect(() => { handoff.current?.setReady(ready); }, [ready, maxWaitMs, enabled]);
}
