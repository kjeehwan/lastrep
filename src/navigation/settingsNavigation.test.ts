import { describe, expect, it, vi } from "vitest";
import { returnFromSettingsToHome } from "./settingsNavigation";

describe("Settings back navigation", () => {
  it("selects the Home tab without dismissing the containing stack", () => {
    const navigation = { navigate: vi.fn(), dismissTo: vi.fn(), goBack: vi.fn() };
    returnFromSettingsToHome(navigation);
    expect(navigation.navigate).toHaveBeenCalledWith("home");
    expect(navigation.dismissTo).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});
