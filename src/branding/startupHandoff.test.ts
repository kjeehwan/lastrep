import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStartupHandoff } from "./startupHandoff";

describe("startup handoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => setTimeout(callback, 16));
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("keeps the native splash until the ready destination paints, then releases once", () => {
    const hide = vi.fn();
    const handoff = createStartupHandoff(hide, 8000);
    handoff.setReady(false);
    vi.advanceTimersByTime(1000);
    expect(hide).not.toHaveBeenCalled();
    handoff.setReady(true);
    vi.advanceTimersByTime(16);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(16);
    expect(hide).toHaveBeenCalledTimes(1);
    handoff.setReady(true);
    vi.advanceTimersByTime(9000);
    expect(hide).toHaveBeenCalledTimes(1);
    handoff.dispose();
  });

  it("reveals the mounted Home loading/error state if data stalls", () => {
    const hide = vi.fn();
    const handoff = createStartupHandoff(hide, 8000);
    handoff.setReady(false);
    vi.advanceTimersByTime(8000);
    expect(hide).not.toHaveBeenCalled();
    vi.advanceTimersByTime(32);
    expect(hide).toHaveBeenCalledTimes(1);
    handoff.dispose();
  });

  it("cancels a pending reveal when readiness is lost", () => {
    const hide = vi.fn();
    const handoff = createStartupHandoff(hide);
    handoff.setReady(true);
    vi.advanceTimersByTime(16);
    handoff.setReady(false);
    vi.advanceTimersByTime(100);
    expect(hide).not.toHaveBeenCalled();
    handoff.dispose();
  });

  it("does not hide over a replacement destination after unmount", () => {
    const hide = vi.fn();
    const handoff = createStartupHandoff(hide, 8000);
    handoff.setReady(true);
    handoff.dispose();
    vi.advanceTimersByTime(9000);
    expect(hide).not.toHaveBeenCalled();
  });
});
