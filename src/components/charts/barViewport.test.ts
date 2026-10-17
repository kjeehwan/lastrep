import { expect, it } from "vitest";
import { barViewportRange } from "./barViewport";

it("clamps a stale scroll position after zero-day filtering shortens the history", () => {
  const range = barViewportRange(20, 18000, 320);
  expect(range).toEqual({ start: 0, end: 7 });
  expect(barViewportRange(3, 18000, 320)).toEqual({ start: 0, end: 3 });
});
it("handles an empty history and normal visible ranges", () => {
  expect(barViewportRange(0, 18000, 320)).toEqual({ start: 0, end: 0 });
  expect(barViewportRange(100, 104, 320)).toEqual({ start: 91, end: 98 });
  expect(barViewportRange(100, -10, 320)).toEqual({ start: 93, end: 100 });
});

it("starts at the newest bars without a post-render scroll", () => {
  expect(barViewportRange(20, 0, 320)).toEqual({ start: 13, end: 20 });
  expect(barViewportRange(20, 51, 320)).toEqual({ start: 12, end: 20 });
});
