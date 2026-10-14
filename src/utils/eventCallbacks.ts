type CallbackMap = Record<string, (...args: any[]) => any>;

/** Fixed-key event facade; resolves the latest callback only when an event fires. */
export function bindEventCallbacks<T extends CallbackMap>(keys: (keyof T)[], latest: () => T): T {
  return Object.fromEntries(keys.map((key) => [key, (...args: unknown[]) => latest()[key](...args)])) as T;
}
