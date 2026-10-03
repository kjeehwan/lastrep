import { useCallback, useEffect, useRef, useState } from "react";

export function useWorkoutElapsedTimer(initialElapsedSeconds = 0, initiallyRunning = false) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const [running, setRunning] = useState(initiallyRunning);
  const startedAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    if (startedAtMsRef.current == null) {
      startedAtMsRef.current = Date.now() - elapsedSeconds * 1000;
    }
    const interval = setInterval(() => {
      const startedAtMs = startedAtMsRef.current ?? Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [elapsedSeconds, running]);

  const start = useCallback(() => {
    startedAtMsRef.current = Date.now() - elapsedSeconds * 1000;
    setRunning(true);
  }, [elapsedSeconds]);

  const pause = useCallback(() => {
    setRunning(false);
    startedAtMsRef.current = null;
  }, []);

  const setDuration = useCallback((nextElapsedSeconds: number) => {
    setElapsedSeconds(Math.max(0, nextElapsedSeconds));
    setRunning(false);
    startedAtMsRef.current = null;
  }, []);

  const reset = useCallback(() => setDuration(0), [setDuration]);

  return {
    elapsedSeconds,
    running,
    setElapsedSeconds,
    setRunning,
    start,
    pause,
    setDuration,
    reset,
  };
}
