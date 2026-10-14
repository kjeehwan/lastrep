import { scheduleAfterInteractions } from "./scheduleAfterInteractions";

/** Give a newly committed screen a paint opportunity before noncritical work. */
export function scheduleAfterPaint(task: () => void | Promise<void>) {
  let cancelled = false;
  let frame: number | null = null;
  let idle: { cancel: () => void } | null = null;
  frame = requestAnimationFrame(() => {
    if (cancelled) return;
    frame = requestAnimationFrame(() => {
      if (cancelled) return;
      idle = scheduleAfterInteractions(() => {
        if (!cancelled) return task();
      });
    });
  });
  return {
    cancel() {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      idle?.cancel();
    },
  };
}
