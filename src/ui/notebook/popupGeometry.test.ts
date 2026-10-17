import { expect, it } from "vitest";
import { popupBottomSpace } from "./popupGeometry";

it("reserves the complete tab bar once, plus breathing room", () => {
  expect(popupBottomSpace(24, 92, false)).toBe(104);
  expect(popupBottomSpace(24, undefined, false)).toBe(36);
  expect(popupBottomSpace(0, 116, false)).toBe(128);
});
it("does not reserve hidden tabs above an open keyboard", () => {
  expect(popupBottomSpace(24, 92, true)).toBe(24);
});
