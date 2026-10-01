type IdleCallbackHandle = {
  cancel: () => void;
};

export function scheduleAfterInteractions(
  task: () => void | Promise<void>,
  timeoutMs = 250
): IdleCallbackHandle {
  if (typeof globalThis.requestIdleCallback === "function") {
    const idleId = globalThis.requestIdleCallback(
      () => {
        void task();
      },
      { timeout: timeoutMs }
    );
    return {
      cancel: () => {
        if (typeof globalThis.cancelIdleCallback === "function") {
          globalThis.cancelIdleCallback(idleId);
        }
      },
    };
  }

  const timeoutId = globalThis.setTimeout(() => {
    void task();
  }, 0);

  return {
    cancel: () => globalThis.clearTimeout(timeoutId),
  };
}
