import { isExpectedOfflineError } from "../utils/networkErrors";

/** A server snapshot can finish recovery after NetInfo reports online too early. */
export function shouldRetryProfileLoad(loadedUid: string | null, uid: string, hasBaseline: boolean, fromCache: boolean): boolean {
  return !hasBaseline && loadedUid !== uid && !fromCache;
}

/** Deferred refreshes must settle even if connectivity changes after scheduling. */
export async function runProfileRefresh(task: () => Promise<void>, onUnexpectedError: (error: unknown) => void): Promise<void> {
  try {
    await task();
  } catch (error) {
    if (!isExpectedOfflineError(error)) onUnexpectedError(error);
  }
}
