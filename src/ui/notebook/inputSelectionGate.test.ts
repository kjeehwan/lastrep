import { expect, it } from "vitest";
import { createInputSelectionGate } from "./inputSelectionGate";

it("cancels delayed selection when the first digit arrives", () => {
  const gate = createInputSelectionGate();
  const pending = gate.claim()!;
  expect(pending()).toBe(true);
  gate.changed();
  expect(pending()).toBe(false);
  expect(gate.claim()).toBeNull();
});

it("does not reselect on keyboard refocus; reopening allows a new selection", () => {
  const gate = createInputSelectionGate();
  const previous = gate.claim()!;
  expect(gate.claim()).toBeNull();
  gate.reset();
  expect(previous()).toBe(false);
  expect(gate.claim()!()).toBe(true);
});
