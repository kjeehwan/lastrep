export type EffortScale = "rpe" | "rir";
export type EffortInput = { scale: EffortScale; value: string; canonicalRpe: string };

export const resolveEffortScale = (value: unknown): EffortScale => value === "rir" ? "rir" : "rpe";
export const effortLabel = (scale: EffortScale) => scale.toUpperCase();

/** New ratings use RPE 6-10 (equivalently RIR 0-4); history keeps its original range. */
export function isValidWorkoutEffort(value: unknown): boolean {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return true;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 6 && number <= 10;
}

export function effortToRpe(value: string, scale: EffortScale): string {
  const raw = value.trim().replace(",", ".");
  if (!raw || raw === ".") return raw;
  const number = Number(raw);
  if (!Number.isFinite(number)) return raw;
  return scale === "rpe" ? raw : String(Math.round((10 - number) * 100) / 100);
}

export function rpeToEffort(value: unknown, scale: EffortScale): string {
  if (value == null || String(value).trim() === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1 || number > 10) return "";
  return String(Math.round((scale === "rir" ? 10 - number : number) * 100) / 100);
}

export function effortInputValue(set: { rpe?: string; effortInput?: EffortInput }, scale: EffortScale): string {
  const input = set.effortInput;
  return input?.scale === scale && input.canonicalRpe === set.rpe ? input.value : rpeToEffort(set.rpe, scale);
}

export function formatEffort(value: unknown, scale: EffortScale): string {
  const display = rpeToEffort(value, scale);
  return display ? ` @ ${effortLabel(scale)} ${display}` : "";
}
