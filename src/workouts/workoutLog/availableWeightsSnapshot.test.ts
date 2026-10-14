import { expect, it } from "vitest";
import { retainAvailableWeightsSnapshot, type AvailableWeightsSnapshot } from "./availableWeightsSnapshot";

const previous: AvailableWeightsSnapshot = {
  uid: "account-a",
  values: {
    bench: { mode: "regular", unit: "kg", minimum: 20, increment: 2.5 },
    fly: { mode: "custom", unit: "kg", values: [10, 12, 14] },
  },
};
const copy = () => JSON.parse(JSON.stringify(previous)) as AvailableWeightsSnapshot;

it("retains the loaded reference for equivalent snapshots, independent of key order", () => {
  const next = copy();
  next.values = { fly: next.values.fly, bench: next.values.bench };
  expect(retainAvailableWeightsSnapshot(previous, next)).toBe(previous);
});
it("loads an empty first snapshot but ignores repeated empty snapshots", () => {
  const empty = { uid: "account-a", values: {} };
  expect(retainAvailableWeightsSnapshot(null, empty)).toBe(empty);
  expect(retainAvailableWeightsSnapshot(empty, { ...empty, values: {} })).toBe(empty);
});
it("does not reuse another account's settings", () => {
  const next = { ...copy(), uid: "account-b" };
  expect(retainAvailableWeightsSnapshot(previous, next)).toBe(next);
});
it.each(["unit", "increment", "minimum", "mode", "custom_values", "remove", "add"])("accepts a real %s change", (change) => {
  const next = copy();
  if (change === "unit") next.values.bench.unit = "lbs";
  if (change === "increment") next.values.bench = { mode: "regular", unit: "kg", minimum: 20, increment: 2 };
  if (change === "minimum") next.values.bench = { mode: "regular", unit: "kg", minimum: 15, increment: 2.5 };
  if (change === "mode") next.values.bench = { mode: "custom", unit: "kg", values: [20, 22.5] };
  if (change === "custom_values") next.values.fly = { mode: "custom", unit: "kg", values: [10, 12, 16] };
  if (change === "remove") delete next.values.fly;
  if (change === "add") next.values.squat = next.values.bench;
  expect(retainAvailableWeightsSnapshot(previous, next)).toBe(next);
});
