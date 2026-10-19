import { expect, it } from "vitest";
import { formatInstalledVersion, settingsAccessLabel } from "./settingsPresentation";

it("keeps the installed flavor suffix and build distinct from a JS manifest version", () => {
  expect(formatInstalledVersion("1.0.1-dev", "42")).toBe("1.0.1-dev (42)");
  expect(formatInstalledVersion("2.0", null)).toBe("2.0");
  expect(formatInstalledVersion(null, "42")).toBe("Not available");
  expect(formatInstalledVersion()).toBe("Not available");
});

it("does not present unknown account access as Free or a previous account's Premium", () => {
  for (const state of ["loading", "active", "inactive"] as const) expect(settingsAccessLabel(false, state)).toBe("Checking access");
  expect(settingsAccessLabel(true, "loading")).toBe("Checking access");
  expect(settingsAccessLabel(true, "active")).toBe("Premium");
  expect(settingsAccessLabel(true, "inactive")).toBe("Free");
});
