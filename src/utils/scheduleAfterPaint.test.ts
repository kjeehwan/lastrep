import { afterEach, expect, it, vi } from "vitest";
import { scheduleAfterPaint } from "./scheduleAfterPaint";

afterEach(() => { vi.unstubAllGlobals(); });

function frames() {
  const queued = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queued.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => queued.delete(key));
  vi.stubGlobal("requestIdleCallback", (callback: () => void) => { idle = callback; return 1; });
  vi.stubGlobal("cancelIdleCallback", () => { idle = null; });
  let idle: (() => void) | null = null;
  return {
    frame() { const pending = [...queued.values()]; queued.clear(); pending.forEach((callback) => callback(0)); },
    idle() { idle?.(); },
  };
}

it("waits for two frames before queuing noncritical work", () => {
  const clock = frames();
  const task = vi.fn();
  scheduleAfterPaint(task);
  clock.frame(); clock.idle();
  expect(task).not.toHaveBeenCalled();
  clock.frame();
  expect(task).not.toHaveBeenCalled();
  clock.idle();
  expect(task).toHaveBeenCalledOnce();
});

it.each([0, 1, 2])("cancels at stage %i without starting work", (stage) => {
  const clock = frames();
  const task = vi.fn();
  const scheduled = scheduleAfterPaint(task);
  for (let index = 0; index < stage; index++) clock.frame();
  scheduled.cancel();
  clock.frame(); clock.frame(); clock.idle();
  expect(task).not.toHaveBeenCalled();
});
