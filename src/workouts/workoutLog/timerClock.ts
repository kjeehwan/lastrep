export type ElapsedClock = { elapsedSeconds: number; startedAtMs: number | null; hasStarted?: boolean };
export type RestClock = { remainingSec: number; running: boolean; endsAtMs?: number };

export function nextRestDeadlineDelay(clocks: Record<string, RestClock>, nowMs: number): number | null {
  const deadlines = Object.values(clocks).filter((clock) => clock.running && clock.endsAtMs != null).map((clock) => clock.endsAtMs!);
  return deadlines.length ? Math.max(0, Math.min(...deadlines) - nowMs) : null;
}

export function elapsedAt(clock: ElapsedClock, nowMs: number): number {
  return clock.startedAtMs == null ? clock.elapsedSeconds : Math.max(0, Math.floor((nowMs - clock.startedAtMs) / 1000));
}

export function startElapsed(clock: ElapsedClock, nowMs: number): ElapsedClock {
  return clock.startedAtMs == null ? { ...clock, hasStarted: true, startedAtMs: nowMs - clock.elapsedSeconds * 1000 } : clock;
}

export function autoStartElapsed(clock: ElapsedClock, nowMs: number): ElapsedClock {
  return clock.hasStarted || clock.startedAtMs != null || clock.elapsedSeconds > 0 ? clock : startElapsed(clock, nowMs);
}

export function pauseElapsed(clock: ElapsedClock, nowMs: number): ElapsedClock {
  return { ...clock, elapsedSeconds: elapsedAt(clock, nowMs), startedAtMs: null };
}

export function advanceRest(clock: RestClock, nowMs: number): RestClock {
  if (!clock.running || clock.endsAtMs == null) return clock;
  const remainingSec = Math.max(0, Math.ceil((clock.endsAtMs - nowMs) / 1000));
  if (remainingSec === clock.remainingSec && remainingSec > 0) return clock;
  return { remainingSec, running: remainingSec > 0, ...(remainingSec > 0 ? { endsAtMs: clock.endsAtMs } : {}) };
}

export function startRest(clock: RestClock | undefined, fallback: number, nowMs: number): RestClock {
  if (clock?.running) return advanceRest(clock, nowMs);
  const remainingSec = clock && clock.remainingSec > 0 ? clock.remainingSec : fallback;
  return { remainingSec, running: true, endsAtMs: nowMs + remainingSec * 1000 };
}

export function pauseRest(clock: RestClock, nowMs: number): RestClock {
  return { remainingSec: advanceRest(clock, nowMs).remainingSec, running: false };
}
