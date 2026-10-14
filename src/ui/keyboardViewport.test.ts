import { expect, it } from "vitest";
import { focusedInputScrollOffset, modalViewportHeight } from "./keyboardViewport";
it("limits modal content to the visible area without double-subtracting a resized keyboard", () => {
  expect(modalViewportHeight(800, null, 24, 24)).toBe(720);
  expect(modalViewportHeight(800, 450, 24, 24)).toBe(370);
  expect(modalViewportHeight(450, 450, 24, 24)).toBe(370);
  expect(modalViewportHeight(360, 220, 0, 0)).toBe(188);
  expect(modalViewportHeight(100, 60, 24, 24)).toBe(48);
});

it("keeps visible inputs still and scrolls obscured inputs after a viewport resize", () => {
  expect(focusedInputScrollOffset(100, 200, 300, 240, 48)).toBe(100);
  expect(focusedInputScrollOffset(100, 200, 150, 320, 48)).toBe(130);
  expect(focusedInputScrollOffset(100, 200, 150, 180, 48)).toBe(68);
  expect(focusedInputScrollOffset(0, 200, 150, 180, 48)).toBe(0);
  expect(focusedInputScrollOffset(100, 200, 60, 240, 48)).toBe(128);
});
