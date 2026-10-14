export type SleepRefreshStamp = { uid: string; atMs: number };

export function shouldRefreshSleep(uid: string | null, previous: SleepRefreshStamp | null, nowMs: number) {
  if (!uid) return false;
  return previous?.uid !== uid || nowMs - previous.atMs >= 30_000;
}
