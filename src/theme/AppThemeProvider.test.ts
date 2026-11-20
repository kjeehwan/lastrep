import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemePreferenceState } from "./themePreference";
import { AppThemeProvider, useAppTheme } from "./AppThemeProvider";

const fixture = vi.hoisted(() => ({
  state: { preference: "system", ready: false, saving: false, feedback: null } as ThemePreferenceState,
}));

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("firebase/auth", () => ({ onAuthStateChanged: vi.fn() }));
vi.mock("../config/firebaseConfig", () => ({ auth: {} }));
vi.mock("react-native", () => ({
  useColorScheme: () => "light",
  View: ({ children, accessibilityElementsHidden, importantForAccessibility, pointerEvents, ...props }: Record<string, unknown>) =>
    React.createElement("div", {
      ...props,
      "data-accessibility-hidden": accessibilityElementsHidden,
      "data-android-accessibility": importantForAccessibility,
      "data-pointer-events": pointerEvents,
    }, children as React.ReactNode),
  ActivityIndicator: ({ accessibilityLabel }: { accessibilityLabel: string }) =>
    React.createElement("span", { "aria-label": accessibilityLabel }),
}));
vi.mock("./themePreference", async (importOriginal) => ({
  ...await importOriginal<typeof import("./themePreference")>(),
  createThemePreferenceStore: () => ({
    subscribe: () => () => {},
    getSnapshot: () => fixture.state,
    setPreference: vi.fn(),
  }),
}));

function NavigatorProbe() {
  const theme = useAppTheme();
  return React.createElement("nav", { "data-theme": theme.colorScheme }, "Root navigator");
}

function render() {
  return renderToStaticMarkup(React.createElement(AppThemeProvider, null, React.createElement(NavigatorProbe)));
}

describe("startup appearance and root navigator", () => {
  beforeEach(() => {
    fixture.state = { preference: "system", ready: false, saving: false, feedback: null };
  });

  it("mounts the navigator on the first render while masking pending appearance", () => {
    const html = render();
    expect(html).toContain("Root navigator");
    expect(html).toContain('aria-label="Loading appearance"');
    expect(html).toContain('data-pointer-events="none"');
    expect(html).toContain('data-android-accessibility="no-hide-descendants"');
    expect(html).toContain("opacity:0");
  });

  it.each(["light", "dark"] as const)("reveals the navigator with the saved %s appearance", preference => {
    fixture.state = { ...fixture.state, preference, ready: true };
    const html = render();
    expect(html).toContain(`data-theme="${preference}"`);
    expect(html).not.toContain("Loading appearance");
    expect(html).toContain('data-pointer-events="auto"');
    expect(html).toContain("opacity:1");
  });

  it("keeps navigation available when appearance storage fails", () => {
    fixture.state = { ...fixture.state, ready: true, feedback: "Couldn't load appearance. Using System." };
    expect(render()).toContain("Root navigator");
    expect(render()).not.toContain("Loading appearance");
  });
});
