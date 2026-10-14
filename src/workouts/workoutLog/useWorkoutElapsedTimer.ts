import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { elapsedAt, pauseElapsed, startElapsed, type ElapsedClock } from "./timerClock";

export function useWorkoutElapsedTimer(initialElapsedSeconds = 0, initiallyRunning = false, displayActive = true, tickIntervalMs: number | null = 1000) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const [startedAtMs, setStartedAtMs] = useState(() => initiallyRunning ? Date.now() - initialElapsedSeconds * 1000 : null);
  const clockRef = useRef<ElapsedClock>({ elapsedSeconds: initialElapsedSeconds, startedAtMs });
  const running = startedAtMs != null;
  const refresh = useCallback(() => setElapsedSeconds(elapsedAt(clockRef.current, Date.now())), []);
  const getElapsedSeconds = useCallback(() => elapsedAt(clockRef.current, Date.now()), []);

  useEffect(() => {
    if (!running || !displayActive) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
    };
    const resume = () => {
      stop();
      refresh();
      if (tickIntervalMs !== null) interval = setInterval(refresh, tickIntervalMs);
    };
    // The timestamp keeps counting; only the visible display needs ticking.
    if (AppState.currentState === "active") resume();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resume();
      else stop();
    });
    return () => { stop(); subscription.remove(); };
  }, [displayActive, refresh, running, tickIntervalMs]);

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
    getElapsedSeconds,
    running,
    startedAtMs,
    restore,
    start,
    pause,
    setDuration,
    reset,
  };
}
