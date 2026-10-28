import { expect, it } from "vitest";
import { popupBottomSpace } from "./popupGeometry";

it("reserves the complete tab bar once, without a gap above it", () => {
  expect(popupBottomSpace(24, 92, false)).toBe(92);
  expect(popupBottomSpace(24, undefined, false)).toBe(24);
  expect(popupBottomSpace(0, 116, false)).toBe(116);
});
it("does not reserve hidden tabs above an open keyboard", () => {
  expect(popupBottomSpace(24, 92, true)).toBe(24);
});
