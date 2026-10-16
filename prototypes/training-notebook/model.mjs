export const copy = (value) => structuredClone(value);
const set = (weight, reps, done = false, rpe = '') => ({ weight, reps, rpe, done, type: 'normal' });
export function fixture() {
  return [
    { id: 'bench', name: 'Bench press', tempo: '3-0-1-0', unit: 'kg', mode: 'resistance', rest: 120, notes: '', previous: [set('105', '3', false, '10'), set('105', '3', false, '10'), set('105', '3', false, '10')], sets: [set('100', '5', true), set('100', '5'), set('100', '5')] },
    { id: 'incline', name: 'Incline dumbbell press', unit: 'kg', mode: 'resistance', rest: 120, notes: '', previous: [set('30', '8'), set('28', '10'), set('28', '9')], sets: [set('30', '8'), set('28', '10'), set('28', '9')] },
    { id: 'fly', name: 'Cable fly', unit: 'kg', mode: 'resistance', rest: 90, notes: '', previous: [], sets: [set('', '12'), set('', '12')] },
    { id: 'pushdown', name: 'Tricep pushdown', unit: 'kg', mode: 'resistance', rest: 90, notes: '', previous: [set('35', '10'), set('35', '10'), set('35', '10')], sets: [set('35', '10'), set('35', '10'), set('35', '10')] },
  ];
}
export const catalog = [
  ['bench', 'Bench press', 'Barbell / Chest'], ['incline', 'Incline dumbbell press', 'Dumbbell / Chest'],
  ['fly', 'Cable fly', 'Cable / Chest'], ['pushdown', 'Tricep pushdown', 'Cable / Triceps'],
  ['row', 'Chest-supported row', 'Machine / Back'], ['curl', 'Seated leg curl', 'Machine / Hamstrings'],
  ['treadmill', 'Treadmill', 'Cardio / Time and distance'], ['legraise', 'Hanging leg raise', 'Bodyweight / Abs'],
];
export function exerciseFromCatalog(id, name) {
  const existing = fixture().find(e => e.id === id);
  if (existing) { existing.sets = existing.sets.map(s => ({ ...s, done: false, rpe: '' })); return existing; }
  const entry = catalog.find(e => e[0] === id);
  return { id, name: name ?? entry?.[1] ?? 'Custom exercise', mode: id === 'treadmill' ? 'cardio' : id === 'legraise' ? 'bodyweight' : 'resistance', custom: !entry, unit: id === 'treadmill' ? 'km' : 'kg', rest: 90, notes: '', previous: [], sets: [set('', '12')], time: '', distance: '', zone: '', session: '', effort: '' };
}
export function effortValue(rpe, scale) {
  if (rpe === '' || rpe == null) return '';
  const n = Number(rpe);
  if (!Number.isFinite(n)) return '';
  return String(scale === 'RIR' ? 10 - n : n);
}
export function lastText(set, scale = 'RPE') {
  if (!set) return '\u2014';
  return `${set.weight} \u00d7 ${set.reps}${set.rpe !== '' && set.rpe != null ? ` @ ${effortValue(set.rpe, scale)}` : ''}`;
}
export function guidanceChanges(exercises, step = 2.5) {
  return exercises.map(e => ({ ...e, sets: e.sets.map(s => {
    if (!['bench', 'incline'].includes(e.id.split('-')[0]) || s.done || s.type === 'warmup' || !Number.isFinite(Number(s.weight)) || !s.weight) return { ...s };
    const interval = e.unit === 'lbs' ? step * 2.2046226218 : step;
    // Two synthetic adjustment types demonstrate load and rep changes, not a recommendation engine.
    if (e.id.split('-')[0] === 'incline') return { ...s, reps: String(Math.max(1, Number(s.reps) - 2)) };
    return { ...s, weight: String(Number((Math.floor(Number(s.weight) * .95 / interval) * interval).toFixed(2))) };
  }) }));
}
export function moveExercise(exercises, id, direction) {
  const next = copy(exercises), i = next.findIndex(e => e.id === id), to = i + direction;
  if (i < 0 || to < 0 || to >= next.length) return next;
  [next[i], next[to]] = [next[to], next[i]];
  return next;
}
export function summary(exercises) {
  const sets = exercises.flatMap(e => e.sets.map(s => ({ ...s, unit: e.unit, mode: e.mode })));
  const completed = sets.filter(s => s.done);
  return { total: sets.length, completed: completed.length, volumeKg: completed.filter(s => s.mode === 'resistance').reduce((n, s) => n + (Number(s.weight) || 0) * (Number(s.reps) || 0) / (s.unit === 'lbs' ? 2.2046226218 : 1), 0) };
}
export function setUnit(exercise, unit) {
  if (exercise.unit === unit) return copy(exercise);
  const factor = unit === 'lbs' ? 2.2046226218 : 1 / 2.2046226218;
  const convert = s => ({ ...s, weight: s.weight === '' ? '' : String(Number((Number(s.weight) * factor).toFixed(2))) });
  return { ...copy(exercise), unit, sets: exercise.sets.map(convert), previous: exercise.previous.map(convert) };
}
export const states = [
  ['Approved screens', 'active', 'Active workout', 'The approved populated screen, with optional side-by-side reps editing.'],
  ['Approved screens', 'editing', 'Editing reps + keyboard', 'The approved scrolled editing state. The caret belongs to Set 2, Reps.'],
  ['Setup', 'empty', 'Empty workout', 'Choose a routine, add exercises, repeat a session or request a recommendation.'],
  ['Setup', 'routines', 'Choose routine', 'Routine selection, deload entry and creation are discoverable.'],
  ['Setup', 'recommend', 'Recommendation setup', 'Focus and session length move off the active log.'],
  ['Setup', 'add', 'Add exercise + selection', 'Search, removable selections and Add (2), above an illustrative keyboard.'],
  ['Setup', 'search-loading', 'Search loading', 'A loading state does not erase the selection.'],
  ['Setup', 'search-empty', 'No search matches', 'Clear the query or create a custom exercise.'],
  ['Setup', 'search-error', 'Search failed', 'Plain-language recovery, with the selection preserved.'],
  ['Setup', 'custom', 'Create custom exercise', 'A keyboard-aware form with explicit fields.'],
  ['Active controls', 'exercise-menu', 'Exercise options', 'Up is unavailable on the first exercise; Down and Replace remain discoverable.'],
  ['Active controls', 'set-options', 'Compact set options', 'Normal, warm-up, failure, drop and percentage adjustments.'],
  ['Active controls', 'rest', 'Rest running', 'A dock above the tabs, without covering the last row.'],
  ['Active controls', 'rest-paused', 'Rest paused', 'The same dock with an explicit Resume action.'],
  ['Active controls', 'rest-detail', 'Rest timer controls', 'Presets, custom duration and pause/resume.'],
  ['Active controls', 'details', 'Note and tempo', 'Always-visible Note field and a direct tempo control; weights stay in the exercise menu.'],
  ['Active controls', 'weights', 'Available weights', 'An editable local increment used by the fixture adjustments.'],
  ['Active controls', 'deleted', 'Deleted set + Undo', 'Undo stays beside the exercise that changed.'],
  ["Today's Plan", 'plan-none', 'No plan yet', 'An entry point, not a speculative recommendation.'],
  ["Today's Plan", 'disclosure', 'AI disclosure', 'What would be sent by the real feature. This prototype sends nothing.'],
  ["Today's Plan", 'plan-busy', 'Reviewing', 'A busy state with no premature Apply action.'],
  ["Today's Plan", 'plan-ok', 'Train as planned', 'Concise guidance without repeating every unchanged exercise.'],
  ["Today's Plan", 'plan-changes', 'Selected exercise changes', 'Set-specific before/after values; completed sets remain unchanged.'],
  ["Today's Plan", 'plan-why', 'Grouped explanation', 'One shared reason instead of the same paragraph below every exercise.'],
  ["Today's Plan", 'plan-stale', 'Inputs changed', 'Update before applying old advice.'],
  ["Today's Plan", 'plan-applied', 'Applied + Undo', 'Review adjusted loads and undo only while the applied draft is unchanged.'],
  ["Today's Plan", 'plan-error', 'Review failed', 'Retry without blocking the workout or losing values.'],
  ["Today's Plan", 'context', "Edit today's inputs", 'Recovery, pain/context and notes are optional.'],
  ['History and exercise types', 'history', 'History + progress', 'Three observed sessions; one set per row, with estimates labeled.'],
  ['History and exercise types', 'history-empty', 'No exercise history', 'An honest empty state, not a fabricated chart.'],
  ['History and exercise types', 'cardio', 'Cardio / unset', 'Time, distance and optional toggles; no fake weighted sets.'],
  ['History and exercise types', 'cardio-selected', 'Cardio / selected', 'Tap a selected zone, session type or effort level again to clear it.'],
  ['History and exercise types', 'bodyweight', 'Bodyweight + custom', 'Reps without invented loads; a non-interactive custom demo placeholder.'],
  ['Completion', 'finish', 'Finish review', 'Review the actual completed sets before saving.'],
  ['Completion', 'saving', 'Saving', 'Duplicate submission is disabled.'],
  ['Completion', 'save-error', 'Save failed', 'Draft retained; retry or return to the workout.'],
  ['Completion', 'saved', 'Workout saved', 'A persistent acknowledgement before the separate routine-update decision.'],
  ['Completion', 'routine-update', 'Update source routine?', 'An optional decision after the workout has been saved.'],
  ['Completion', 'routine-updated', 'Routine updated', 'Separate confirmation, not a disappearing toast.'],
  ['Completion', 'deload-saved', 'Deload saved', 'No prompt to overwrite the original routine.'],
  ['Completion', 'discard', 'Discard confirmation', 'Keep workout is the safe alternative.'],
  ['Responsive checks', 'dark', 'Dark active workout', 'Same hierarchy and geometry, using the specified dark tokens.'],
  ['Responsive checks', 'compact', 'Compact phone', '320-wide set table at 360-wide frame, without shrinking the type.'],
  ['Responsive checks', 'landscape', 'Landscape + keyboard', 'A short viewport with the focused field kept in view.'],
  ['Responsive checks', 'large', '200% text / stacked sets', 'The table reflows into labeled fields rather than clipping text.'],
  ['Responsive checks', 'tablet', 'Tablet portrait', 'A centered 760-wide content column, not a stretched phone screenshot.'],
  ['Responsive checks', 'tablet-wide', 'Tablet landscape', 'The same reading order with bounded content width.'],
];
