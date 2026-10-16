import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Workout native prebuild parity", () => {
  it("dismisses Tempo through the same non-saving close handler on Android Back", () => {
    const screen = readFileSync("app/(tabs)/workout/log.tsx", "utf8");
    expect(screen).toContain('visible={showTempoEditorModal} transparent animationType="fade" onRequestClose={closeTempoEditor}');
  });
  it("uses a system-inset wrapper for all Workout dialogs", () => {
    for (const path of ["app/(tabs)/workout/log.tsx", "src/workouts/workoutLog/WorkoutModalShell.tsx", "src/workouts/workoutLog/WorkoutTodayPlan.tsx", "src/workouts/workoutLog/AvailableWeightsModal.tsx"]) {
      expect(readFileSync(path, "utf8")).toContain("NotebookModal as Modal");
    }
    const modal = readFileSync("src/ui/notebook/NotebookModal.tsx", "utf8");
    expect(modal).toContain("paddingBottom: insets.bottom");
    expect(modal).toContain("paddingLeft: insets.left");
  });
  it("uses the same notebook checkbox geometry and focus feedback in native rows", () => {
    const native = readFileSync("native-overrides/android-kotlin/workoutnative/WorkoutSetListView.kt", "utf8");
    expect(native).toContain("cornerRadius = dp(if (largeText) 6f else 4f)");
    expect(native).toContain("if (binding.root.isSelected) accentSoft else Color.TRANSPARENT");
    expect(native).toContain("binding.check.isActivated = done");
  });
  it("does not invent selections for new pain or activity context", () => {
    const context = readFileSync("src/services/decision/TodayPlanContextModal.tsx", "utf8");
    for (const field of ["pain?.area", "pain?.severity", "pain?.trigger", "additionalActivity?.type", "additionalActivity?.timing", "additionalActivity?.effort", "additionalActivity?.duration"]) {
      expect(context).toContain(`context?.${field} ?? null`);
    }
    expect(context).toContain("setValidationError");
  });
  it("leaves Android focus scrolling to the native input visibility handler", () => {
    const screen = readFileSync("app/(tabs)/workout/log.tsx", "utf8");
    expect(screen).toContain('scrollsChildToFocus={Platform.OS !== "android"}');
    const native = readFileSync("native-overrides/android-kotlin/workoutnative/WorkoutSetListView.kt", "utf8");
    expect(native).toContain("bindingAdapterPosition == boundIndex && input.isAttachedToWindow");
    expect(native).toContain("input.isAttachedToWindow && !input.hasFocus()");
    expect(native).toContain("recyclerView.preserveFocusAfterLayout = false");
  });
  it("activates native rows on confirmed taps, not touch-down or inferred focus", () => {
    const native = readFileSync("native-overrides/android-kotlin/workoutnative/WorkoutSetListView.kt", "utf8");
    const down = native.split("MotionEvent.ACTION_DOWN -> {")[1].split("MotionEvent.ACTION_MOVE")[0];
    expect(down).not.toContain("activateSet(");
    expect(down).not.toContain("requestFocus()");
    expect(native).toContain("if (tapped && boundIndex >= 0");
    const manager = readFileSync("native-overrides/android-kotlin/workoutnative/WorkoutSetListManager.kt", "utf8");
    expect(manager).toContain('"onSetActivate"');
    expect(manager).toContain('name = "editingSuspended"');
  });
  for (const file of ["WorkoutSetListView.kt", "WorkoutSetListManager.kt"]) {
    it(`${file} retains exactly the same behavior after prebuild`, () => {
      const template = readFileSync(`native-overrides/android-kotlin/workoutnative/${file}`, "utf8");
      const native = readFileSync(`android/app/src/main/java/com/kjeehwan/lastrep/workoutnative/${file}`, "utf8");
      expect(native.replaceAll("\r\n", "\n")).toBe(template.replaceAll("__PACKAGE__", "com.kjeehwan.lastrep").replaceAll("\r\n", "\n"));
    });
  }
});
