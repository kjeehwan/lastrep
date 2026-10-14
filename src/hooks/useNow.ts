import { useEffect, useState } from "react";
import { AppState } from "react-native";

export function useNow(intervalMs = 60_000, enabled = true) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const refresh = () => setNowMs(Date.now());
    const stop = () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
    };
    const resume = () => {
      stop();
      refresh();
      interval = setInterval(refresh, intervalMs);
    };
    const initialRefresh = setTimeout(() => {
      if (AppState.currentState !== "background" && AppState.currentState !== "inactive") resume();
    }, 0);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resume();
      else stop();
    });
    return () => { clearTimeout(initialRefresh); stop(); subscription.remove(); };
  }, [enabled, intervalMs]);

  return nowMs;
}
