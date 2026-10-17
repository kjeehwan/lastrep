import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { reconcileSleepTargetDraft } from "./sleepTargetDraft";

it("updates a clean Profile target and baseline when Sleep saves a new target", () => {
  expect(reconcileSleepTargetDraft("7", "7", 8)).toEqual({ baseline: "8", draft: "8" });
});

it("preserves an unsaved target while rebasing Discard to the latest saved value", () => {
  expect(reconcileSleepTargetDraft("7", "9", 8)).toEqual({ baseline: "8", draft: "9" });
  expect(reconcileSleepTargetDraft("8", "9", 8)).toEqual({ baseline: "8", draft: "9" });
});

it("clears target dirtiness when the remote save matches the current draft", () => {
  expect(reconcileSleepTargetDraft("7", "8", 8)).toEqual({ baseline: "8", draft: "8" });
});

it("normalizes saved precision without applying malformed targets", () => {
  expect(reconcileSleepTargetDraft("7", "7", 7.54)).toEqual({ baseline: "7.5", draft: "7.5" });
  for (const remote of [null, undefined, "8", NaN, Infinity, 0, -1, 25]) {
    expect(reconcileSleepTargetDraft("7", "7", remote)).toEqual({ baseline: "7", draft: "7" });
  }
});

it("connects remote target reconciliation to the Profile listener and saved baseline", () => {
  const source = readFileSync("app/(tabs)/profile/index.tsx", "utf8");
  expect(source).toContain("reconcileSleepTargetDraft(baseline.sleepTargetHours, local.sleepTargetHours, data.sleepSettings?.targetHours)");
  expect(source).toContain("setSleepTargetHours(sleepTarget.draft)");
  expect(source).toContain("baseline.sleepTargetHours = sleepTarget.baseline");
});
