import { useLayoutEffect, useRef, useState } from "react";
import { bindEventCallbacks } from "../utils/eventCallbacks";

/** For events only, never render-time calculations. Keys must remain fixed. */
export function useEventCallbacks<T extends Record<string, (...args: any[]) => any>>(callbacks: T): T {
  const latest = useRef(callbacks);
  useLayoutEffect(() => { latest.current = callbacks; });
  // The binder stores this reader without invoking it; refs are read only by events.
  // eslint-disable-next-line react-hooks/refs
  const [stable] = useState(() => bindEventCallbacks(Object.keys(callbacks), () => latest.current));
  return stable;
}
