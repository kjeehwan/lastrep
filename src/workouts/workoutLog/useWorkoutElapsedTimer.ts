import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { elapsedAt, pauseElapsed, startElapsed, type ElapsedClock } from "./timerClock";

export function useWorkoutElapsedTimer(initialElapsedSeconds = 0, initiallyRunning = false) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const [startedAtMs, setStartedAtMs] = useState(() => initiallyRunning ? Date.now() - initialElapsedSeconds * 1000 : null);
  const clockRef = useRef<ElapsedClock>({ elapsedSeconds: initialElapsedSeconds, startedAtMs });
  const running = startedAtMs != null;
  const refresh = useCallback(() => setElapsedSeconds(elapsedAt(clockRef.current, Date.now())), []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => { clearInterval(interval); subscription.remove(); };
  }, [refresh, running]);

  const start = useCallback(() => {
    clockRef.current = startElapsed(clockRef.current, Date.now());
    setStartedAtMs(clockRef.current.startedAtMs);
    refresh();
  }, [refresh]);

  const pause = useCallback(() => {
    clockRef.current = pauseElapsed(clockRef.current, Date.now());
    setStartedAtMs(null);
    refresh();
  }, [refresh]);

  const restore = useCallback((seconds: number, anchor: number | null = null) => {
    clockRef.current = { elapsedSeconds: Math.max(0, seconds), startedAtMs: anchor };
    setStartedAtMs(anchor);
    refresh();
  }, [refresh]);
  const setDuration = useCallback((seconds: number) => restore(seconds), [restore]);

  const reset = useCallback(() => setDuration(0), [setDuration]);

  return {
    elapsedSeconds,
    running,
    startedAtMs,
    restore,
    start,
    pause,
    setDuration,
    reset,
  };
}
