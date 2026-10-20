// Release only after the destination has committed and had a chance to paint.
// The optional deadline allows Home to show its normal loading/error states
// when a remote read cannot finish; it is not an artificial minimum duration.
export function createStartupHandoff(hide: () => void, maxWaitMs?: number) {
  let disposed = false;
  let released = false;
  let frame: number | undefined;
  const cancelPaint = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
  const releaseAfterPaint = () => {
    if (disposed || released || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (disposed || released) return;
        released = true;
        hide();
      });
    });
  };
  let expired = false;
  const timeout = maxWaitMs === undefined ? undefined : setTimeout(() => {
    expired = true;
    releaseAfterPaint();
  }, maxWaitMs);
  return {
    setReady(ready: boolean) {
      if (ready || expired) releaseAfterPaint();
      else cancelPaint();
    },
    dispose() {
      disposed = true;
      cancelPaint();
      clearTimeout(timeout);
    },
  };
}
