import { expect, it } from "vitest";
import { notebookDialogTabHeight, notebookTabBarHeight, usesNotebookDesign } from "./navigationGeometry";

it("themes shared dialogs only on migrated screens", () => {
  for (const path of ["/w/example-token", "/shared-workout", "/auth/sign-in", "/auth/sign-up", "/home", "/workout", "/workout/log", "/nutrition", "/nutrition/meal/search", "/sleep", "/profile", "/settings", "/settings/revenuecat-dev"]) expect(usesNotebookDesign(path)).toBe(true);
  for (const path of ["/auth/unknown", "/settings-other", "/nutrition-other", "/sleep-other", "/profile-other"]) expect(usesNotebookDesign(path)).toBe(false);
});
it("reserves the same tab height in screens and root dialog portals", () => {
  expect(notebookTabBarHeight(24, 1)).toBe(92);
  expect(notebookTabBarHeight(0, 1)).toBe(80);
  expect(notebookTabBarHeight(24, 2)).toBe(128);
});
it("does not reserve nonexistent bottom tabs on authentication screens", () => {
  expect(notebookDialogTabHeight("/w/example-token", 24, 1)).toBeUndefined();
  expect(notebookDialogTabHeight("/shared-workout", 24, 1)).toBeUndefined();
  expect(notebookDialogTabHeight("/auth/sign-in", 24, 1)).toBeUndefined();
  expect(notebookDialogTabHeight("/auth/sign-up", 24, 2)).toBeUndefined();
  expect(notebookDialogTabHeight("/home", 24, 1)).toBe(92);
});

it("uses notebook dialogs without bottom tabs on the four onboarding routes", () => {
  for (const step of ["experience", "availability", "nickname", "health"]) {
    expect(usesNotebookDesign(`/onboarding/${step}`)).toBe(true);
    expect(notebookDialogTabHeight(`/onboarding/${step}`, 24, 2)).toBeUndefined();
  }
  expect(usesNotebookDesign("/onboarding/unknown")).toBe(false);
});
