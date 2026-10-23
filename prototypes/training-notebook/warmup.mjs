// Browser-study fixtures only. No account or training-service access.
const clone = value => structuredClone(value);
export const workingSet = exercise => exercise.sets.find(row => row.type !== 'warmup');
export function setDisplayRows(exercise) {
  let workingIndex = 0;
  const previous = (exercise.previous ?? []).filter(row => row.type !== 'warmup');
  return exercise.sets.map(row => {
    if (row.type === 'warmup') return { marker: 'W', previous: undefined };
    const index = workingIndex++;
    return { marker: ({ failure: 'F', drop: 'D' })[row.type] ?? index + 1, previous: previous[index] };
  });
}
export function suggestWarmups(weight, pattern, step = 2.5) {
  if (!(Number(weight) > 0)) return [];
  return pattern.map(row => ({
    weight: String(Number(Math.min(Number(weight), row.fixed ?? Math.floor(Number(weight) * row.ratio / step) * step).toFixed(2))),
    reps: String(row.reps), fixed: row.fixed != null,
  })).filter(row => Number(row.weight) > 0);
}
export function rememberWarmups(rows, weight) {
  return rows.map(row => row.fixed
    ? { fixed: Number(row.weight), reps: Number(row.reps) }
    : { ratio: Number(row.weight) / Number(weight), reps: Number(row.reps) });
}
export function newWarmups(rows, existing) {
  // Match occurrences, so opening again avoids duplicates without removing
  // intentionally repeated rows in a user's ramp.
  const remaining = existing.map(row => ({ ...row }));
  return rows.filter(row => {
    if (row.manual) return true;
    const i = remaining.findIndex(old => Number(old.weight) === Number(row.weight) && Number(old.reps) === Number(row.reps));
    if (i < 0) return true;
    remaining.splice(i, 1); return false;
  });
}
export function insertWarmups(sets, rows) {
  const next = clone(sets), first = next.findIndex(row => row.type !== 'warmup');
  next.splice(first < 0 ? next.length : first, 0, ...rows.map(row => ({ weight: String(row.weight), reps: String(row.reps), rpe: '', done: false, type: 'warmup' })));
  return next;
}
export function warmupError(rows, weight) {
  if (!(Number(weight) > 0)) return 'Enter a working weight to suggest warm-up sets.';
  if (!rows.length) return 'Add a warm-up set to continue.';
  if (rows.some(row => !row.weight.trim() || !Number.isFinite(Number(row.weight)) || Number(row.weight) <= 0 || Number(row.weight) > Number(weight))) return 'Use warm-up weights above zero and no higher than the working weight.';
  if (rows.some(row => !row.reps.trim() || !Number.isInteger(Number(row.reps)) || Number(row.reps) <= 0)) return 'Enter a whole number of reps above zero.';
  return '';
}
