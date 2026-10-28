import type { RestClock } from "./timerClock";

export function restAlertsPlan(clocks: Record<string, RestClock>, exercises: { id: string; name: string }[]) {
  return exercises.flatMap(({ id, name }) => {
    const clock = clocks[id];
    return clock?.running && Number.isFinite(clock.endsAtMs) ? [{ id, name, deadline: clock.endsAtMs! }] : [];
  }).sort((a, b) => a.id.localeCompare(b.id));
}

/** A foreground-only fallback must not ring late when the user returns. */
export function shouldPlayForegroundRest(deadline: number | undefined, now: number, active: boolean) {
  return active && deadline != null && now >= deadline && now - deadline <= 2000;
}
