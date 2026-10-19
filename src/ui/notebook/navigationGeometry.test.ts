import { expect, it } from "vitest";
import { notebookTabBarHeight, usesNotebookDesign } from "./navigationGeometry";

it("themes shared dialogs only on migrated screens", () => {
  for (const path of ["/home", "/workout", "/workout/log", "/nutrition", "/nutrition/meal/search", "/sleep", "/profile", "/settings", "/settings/revenuecat-dev"]) expect(usesNotebookDesign(path)).toBe(true);
  for (const path of ["/settings-other", "/auth/sign-in", "/nutrition-other", "/sleep-other", "/profile-other"]) expect(usesNotebookDesign(path)).toBe(false);
});
it("reserves the same tab height in screens and root dialog portals", () => {
  expect(notebookTabBarHeight(24, 1)).toBe(92);
  expect(notebookTabBarHeight(0, 1)).toBe(80);
  expect(notebookTabBarHeight(24, 2)).toBe(128);
});
