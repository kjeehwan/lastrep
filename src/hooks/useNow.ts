import { useEffect, useState } from "react";

export function useNow(intervalMs = 60_000, enabled = true) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = globalThis.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => globalThis.clearInterval(id);
  }, [enabled, intervalMs]);

  return nowMs;
}
