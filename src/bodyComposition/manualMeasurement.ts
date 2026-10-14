export function parseManualMeasurement(values: Record<string, string>, weightUnit: "kg" | "lbs") {
  const input: Record<string, number> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (!raw.trim()) continue;
    const value = Number(raw.trim().replace(",", "."));
    const isPercent = key === "bodyFatPercent";
    const converted = !isPercent && weightUnit === "lbs" ? value / 2.2046226218 : value;
    if (!Number.isFinite(value) || value <= 0 || converted > (isPercent ? 100 : 500)) {
      throw new Error(isPercent ? "Enter body fat between 0 and 100%." : "Enter a valid positive measurement.");
    }
    input[key] = converted;
  }
  if (!Object.keys(input).length) throw new Error("Enter at least one measurement.");
  return input;
}
