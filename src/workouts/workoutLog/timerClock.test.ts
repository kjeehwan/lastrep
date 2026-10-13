import { describe, expect, it } from "vitest";
import { advanceRest, elapsedAt, pauseElapsed, pauseRest, startElapsed, startRest } from "./timerClock";

describe("timestamp-based workout timers", () => {
  it("counts background time without requiring any JS interval ticks", () => {
    const clock = startElapsed({ elapsedSeconds: 30, startedAtMs: null }, 100000);
    expect(elapsedAt(clock, 160000)).toBe(90);
    expect(startElapsed(clock, 160000)).toBe(clock);
    expect(elapsedAt(clock, 160000)).toBe(90);
  });
  it("captures time on pause and resumes without counting paused time", () => {
    const clock = pauseElapsed(startElapsed({ elapsedSeconds: 0, startedAtMs: null }, 100000), 125000);
    expect(elapsedAt(clock, 200000)).toBe(25);
    expect(elapsedAt(startElapsed(clock, 200000), 210000)).toBe(35);
  });
  it("restores a serialized running clock without losing suspended time", () => {
    const clock = JSON.parse(JSON.stringify(startElapsed({ elapsedSeconds: 10, startedAtMs: null }, 100000)));
    expect(elapsedAt(clock, 160000)).toBe(70);
  });
  it("advances and expires rest countdowns across background gaps", () => {
    const clock = startRest(undefined, 90, 100000);
    expect(advanceRest(clock, 160000)).toMatchObject({ remainingSec: 30, running: true });
    expect(advanceRest(clock, 200000)).toEqual({ remainingSec: 0, running: false });
    const ended = advanceRest(clock, 200000);
    expect(advanceRest(ended, 250000)).toBe(ended);
  });
  it("pauses, resumes and resets countdowns without stale deadlines", () => {
    const paused = pauseRest(startRest(undefined, 90, 100000), 125000);
    expect(paused).toEqual({ remainingSec: 65, running: false });
    const resumed = startRest(paused, 90, 200000);
    expect(advanceRest(resumed, 210000).remainingSec).toBe(55);
    expect(startRest({ remainingSec: 0, running: false }, 90, 200000)).toMatchObject({ remainingSec: 90, endsAtMs: 290000 });
  });
});
