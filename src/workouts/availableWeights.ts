import { z } from "zod";

const unit = z.enum(["kg", "lbs"]);
export const availableWeightsSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("regular"), unit, minimum: z.number().min(0).max(10000), increment: z.number().min(0.001).max(1000) }).strict(),
  z.object({ mode: z.literal("custom"), unit, values: z.array(z.number().min(0).max(10000)).min(1).max(200) }).strict(),
]);
export type AvailableWeights = z.infer<typeof availableWeightsSchema>;
export type AvailableWeightsByExercise = Record<string, AvailableWeights>;
export const weightPreferenceKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const KG_PER_LB = 0.45359237;
const precise = (value: number) => Math.round(value * 1e6) / 1e6;

export function normalizeAvailableWeights(raw: unknown): AvailableWeights | null {
  const parsed = availableWeightsSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data.mode === "custom" ? { ...parsed.data, values: [...new Set(parsed.data.values)].sort((a, b) => a - b) } : parsed.data;
}

export function parseAvailableWeightsByExercise(raw: unknown): AvailableWeightsByExercise {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([name, value]) => {
    const settings = normalizeAvailableWeights(value);
    return settings ? [[weightPreferenceKey(name), settings]] : [];
  }));
}

/** Select an available load without exceeding the supported target, in the equipment's own units. */
export function availableWeightAtOrBelow(targetKg: number, settings: AvailableWeights): number | null {
  const factor = settings.unit === "lbs" ? KG_PER_LB : 1;
  const target = targetKg / factor;
  let value: number | undefined;
  if (settings.mode === "custom") value = [...settings.values].sort((a, b) => b - a).find((candidate) => candidate <= target + 1e-5);
  else {
    const steps = Math.floor((target - settings.minimum + 1e-5) / settings.increment);
    if (steps >= 0) value = settings.minimum + steps * settings.increment;
  }
  return value == null ? null : precise(value * factor);
}

export function fitAvailableWeight(currentKg: number, targetKg: number, settings: AvailableWeights) {
  if (Math.abs(currentKg - targetKg) < 1e-6) return { weightKg: currentKg, repFallback: 0 };
  const available = availableWeightAtOrBelow(targetKg, settings);
  if (targetKg > currentKg && (available == null || available <= currentKg + 1e-6)) {
    return { weightKg: currentKg, repFallback: 1 };
  }
  if (targetKg < currentKg && (available == null || available < currentKg * 0.5)) {
    return { weightKg: currentKg, repFallback: -1 };
  }
  return { weightKg: available ?? currentKg, repFallback: 0 };
}

export function convertAvailableWeightsUnit(settings: AvailableWeights, nextUnit: "kg" | "lbs"): AvailableWeights {
  if (settings.unit === nextUnit) return settings;
  const factor = nextUnit === "kg" ? KG_PER_LB : 1 / KG_PER_LB;
  // Keep grid precision: rounding each increment accumulates across heavier loads.
  const convert = (value: number) => Math.round(value * factor * 1e12) / 1e12;
  return settings.mode === "custom"
    ? { ...settings, unit: nextUnit, values: settings.values.map(convert) }
    : { ...settings, unit: nextUnit, minimum: convert(settings.minimum), increment: convert(settings.increment) };
}
