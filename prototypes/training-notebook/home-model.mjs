import { workoutDraft } from './home-workout-details.mjs';
export const TODAY = '2026-10-15';
export function trendObservationDate(current, index) {
  return `2026-10-${String((current ? 12 : 6) + index).padStart(2, '0')}`;
}
export const metrics = [
  ['weight', 'Weight', 'kg'], ['bodyFat', 'Body fat', '%'],
  ['leanMass', 'Lean mass', 'kg'], ['skeletalMuscle', 'Skeletal muscle', 'kg'],
];
export const homeStates = [
  ['activity', 'Daily movement / steps', 'Proposed steps import inside Progress. Synthetic data; no native sync.'],
  ['activity-calories', 'Future example / activity calories', 'Hypothetical only; calorie import is deferred after the phone data check.'],
  ['activity-empty', 'Daily movement / no records', 'Missing records are unavailable, not zero steps or calories.'],
  ['activity-permission', 'Daily movement / permission needed', 'Existing sleep/body access does not imply steps access.'],
  ['activity-disconnected', 'Daily movement / saved data', 'Keep the dated saved value while sync is disconnected.'],
  ['returning', 'Returning user', 'A planned workout, saved measurements and a recovery check-in.'],
  ['new', 'First workout', 'No invented progress or readiness while the account is empty.'],
  ['rest', 'No workout selected', 'One clear start action without prescribing a rest day.'],
  ['incomplete', "Complete today's picture", 'Meal and health actions appear only when relevant.'],
  ['disconnected', 'Disconnected / saved data', 'Existing account records remain visible; connection status is separate.'],
  ['sparse', 'Sparse body-fat history', 'Real observations months apart, with the latest observation in view.'],
  ['empty', 'No body data', 'An explicit empty state and Add/edit entry.'],
  ['loading', 'Loading account', 'Neutral placeholders rather than briefly showing Get started.'],
  ['error', 'Refresh failed', 'Keep saved values, disclose the refresh failure and offer Retry.'],
  ['calendar', 'Calendar', 'Minimal record index; tap a date for workout or rest-day detail.'],
  ['workout-day', 'Workout day details', 'Close returns to the calendar, not Home.'],
  ['workout-edit', 'Edit saved workout details', 'Correct the date and duration without changing the exercises or current workout.'],
  ['workout-edit-failure', 'Workout details / save failed', 'A simulated failed save keeps your edits; retry or cancel.'],
  ['workout-edit-missing', 'Workout details / no duration', 'Older records without a duration stay blank until you enter one.'],
  ['rest-day', 'Rest day details', 'Rest day with one empty-workout message.'],
  ['training', 'Training phase', 'Selecting a different phase starts week 1; cancel changes nothing.'],
  ['diet', 'Diet phase', 'Compact selectors, without a separate Current phases card.'],
  ['add', 'Add body data', 'Adding for today is explicit, even when an older point is selected.'],
  ['past-data', 'Add today / older record', 'No data today. Add today creates a record; Edit Oct 12 changes the existing older record.'],
  ['edit', 'Edit selected body data', 'Existing values, the selected date and a separate Add today mode.'],
  ['delete', 'Delete body data', 'Confirm the specific date and the data being removed.'],
  ['measurement-error', 'Body data / validation', 'Keep entered values and place the error next to the form.'],
  ['check-in', 'Recovery check-in', 'Optional ratings; no pain assessment or AI generation on Home.'],
  ['readiness', 'About readiness', 'A transparent summary of inputs, not a medical clearance.'],
  ['weekly', 'Weekly trend detail', 'Metric meaning and sample observations, not unlabeled mini charts.'],
  ['profile', 'Profile entry', 'Identity and current phases share the same mock state.'],
  ['dark', 'Dark paper', 'Same hierarchy and interactions, with dark semantic colors.'],
  ['large', '200% text', 'Reflow, larger chart marks and readable action targets.'],
];
export function homeFixture(example = 'returning') {
  const records = [
    { date: '2026-05-22', weight: 82.2, bodyFat: 19.5, skeletalMuscle: 35.2, source: 'Manual entry' },
    { date: '2026-07-18', weight: 81.4, bodyFat: 18.5, skeletalMuscle: 35.5, source: 'Manual entry' },
    ...[['01', 80.8], ['04', 80.5], ['08', 80.65], ['12', 80.35], ['15', 80.15]].map(([day, weight]) => ({ date: `2026-10-${day}`, weight, source: 'Manual entry' })),
  ];
  const s = {
    activity: example.startsWith('activity') ? { steps: 6482, calories: example === 'activity-calories' ? 245 : null, caloriesSupported: example === 'activity-calories', status: example === 'activity-permission' ? 'permission' : example === 'activity-disconnected' ? 'disconnected' : 'connected', date: TODAY, synced: '14:10' } : null,
    example, planned: true, started: true, hasWorkouts: true, mealLogged: true,
    connected: true, records, metric: 'weight', selected: TODAY,
    training: { phase: 'Hypertrophy', since: '2026-10-01' },
    diet: { phase: 'Bulk', since: '2026-10-08' },
    phaseHistory: {
      training: [{ phase: 'Strength', since: '2026-09-01' }, { phase: 'Hypertrophy', since: '2026-10-01' }],
      diet: [{ phase: 'Maintain', since: '2026-09-01' }, { phase: 'Bulk', since: '2026-10-08' }],
    },
    ratings: { soreness: '1', fatigue: '1', motivation: '9' }, sleep: 6.7,
    calendarMonth: '2026-10', calendarDate: '2026-10-12',
    modal: '', form: {}, editDate: null, mode: 'add', unit: 'kg',
    error: '', refreshFailed: example === 'error', loading: example === 'loading',
    toast: '', dismissedWelcome: false, trend: 'Workouts',
  };
  if (example === 'activity-empty' || example === 'activity-permission') s.activity.steps = null;
  if (example === 'activity-disconnected') s.activity.date = '2026-10-14';
  if (['new', 'empty'].includes(example)) { s.records = []; s.selected = null; }
  if (example === 'new') { s.hasWorkouts = false; s.planned = false; s.started = false; s.connected = false; s.mealLogged = false; s.sleep = null; s.ratings = { soreness: '', fatigue: '', motivation: '' }; s.training = { phase: 'Hypertrophy', since: null }; s.diet = { phase: 'Maintain', since: null }; s.phaseHistory = { training: [], diet: [] }; }
  if (example === 'rest') { s.planned = false; s.started = false; }
  if (['incomplete', 'disconnected'].includes(example)) s.connected = false;
  if (example === 'incomplete') s.mealLogged = false;
  if (example === 'sparse') { s.metric = 'bodyFat'; s.selected = '2026-07-18'; }
  if (example === 'past-data') { s.records = s.records.filter(row => row.date !== TODAY); s.selected = '2026-10-12'; s.modal = 'measurement'; }
  s.modal = ({ calendar: 'calendar', 'workout-day': 'day', 'rest-day': 'day', training: 'training', diet: 'diet', add: 'measurement', edit: 'measurement', delete: 'delete', 'measurement-error': 'measurement', 'check-in': 'check-in', readiness: 'readiness', weekly: 'weekly', profile: 'profile' })[example] ?? '';
  if (example === 'past-data') s.modal = 'measurement';
  if (example === 'rest-day') s.calendarDate = '2026-10-13';
  if (['edit', 'delete'].includes(example)) { s.selected = '2026-10-12'; s.editDate = s.selected; s.mode = 'edit'; s.form = valuesForDate(s.records, s.editDate, 'kg'); }
  if (example === 'add') s.editDate = TODAY;
  if (example === 'measurement-error') { s.form.weight = '-2'; s.error = 'Weight must be greater than 0.'; }
  if (['measurement', 'delete'].includes(s.modal)) {
    s.editDate ??= selectedObservation(s)?.date ?? null;
    s.addDraft = s.mode === 'add' ? { ...s.form } : {};
    s.editDraft = s.mode === 'edit' ? { ...s.form } : valuesForDate(s.records, s.editDate, s.unit);
  }
  s.workouts = s.hasWorkouts ? Object.entries(workoutDays).map(([date, title], i) => ({ id: `sample-${i}`, date, title, durationMin: 62 })) : [];
  if (example.startsWith('workout-edit')) {
    s.editWorkoutId = s.workouts.find(w => w.date === s.calendarDate).id;
    const workout = s.workouts.find(w => w.id === s.editWorkoutId);
    if (example === 'workout-edit-missing') workout.durationMin = null;
    s.workoutDraft = workoutDraft(workout);
    s.modal = 'workout-edit';
    if (example === 'workout-edit-failure') {
      s.workoutDraft.minutes = '15';
      s.workoutError = "Couldn't save. Check your connection and try again.";
    }
  }
  return s;
}
export function observations(records, metric) {
  const daily = new Map();
  for (const row of records) if (Number.isFinite(row[metric])) daily.set(row.date, row);
  return [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function selectedObservation(s) {
  const rows = observations(s.records, s.metric);
  return rows.find(row => row.date === s.selected) ?? rows.at(-1) ?? null;
}
export function displayValue(value, metric, unit = 'kg') {
  if (!Number.isFinite(value)) return '';
  return String(Number((metric === 'bodyFat' || unit === 'kg' ? value : value * 2.2046226218).toFixed(metric === 'weight' ? 2 : 1)));
}
export function valuesForDate(records, date, unit) {
  const row = records.findLast(r => r.date === date);
  return Object.fromEntries(metrics.map(([key]) => [key, displayValue(row?.[key], key, unit)]));
}
export function phaseWeeks(since) {
  return since ? Math.max(1, Math.floor((Date.parse(`${TODAY}T12:00:00Z`) - Date.parse(`${since}T12:00:00Z`)) / 604800000) + 1) : null;
}
export function changePhase(s, kind, phase) {
  if (!({ training: ['Hypertrophy', 'Strength', 'Power'], diet: ['Cut', 'Maintain', 'Bulk'] })[kind]?.includes(phase)) throw new Error('Invalid phase.');
  if (s[kind].phase !== phase) { s[kind] = { phase, since: TODAY }; s.phaseHistory[kind].push({ phase, since: TODAY }); }
}
export function phaseOnDate(s, kind, date) { return s.phaseHistory[kind].filter(row => row.since <= date).at(-1)?.phase ?? 'Not recorded'; }
export function readiness(s) {
  if (s.sleep == null || Object.values(s.ratings).some(x => x === '')) return null;
  return Math.round((Math.min(s.sleep / 8, 1) * .3 + (10 - Number(s.ratings.soreness)) / 10 * .3 + (10 - Number(s.ratings.fatigue)) / 10 * .3 + Number(s.ratings.motivation) / 10 * .1) * 100);
}
export function saveMeasurement(s) {
  const patch = {};
  for (const [key, label] of metrics) {
    const raw = (s.form[key] ?? '').trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0 || (key === 'bodyFat' && value > 100)) throw new Error(`${label} must be ${key === 'bodyFat' ? 'greater than 0 and at most 100%' : 'greater than 0'}.`);
    patch[key] = key === 'bodyFat' || s.unit === 'kg' ? value : value / 2.2046226218;
  }
  if (!Object.keys(patch).length) throw new Error('Enter at least one measurement.');
  const date = s.mode === 'edit' ? s.editDate : TODAY;
  const existing = s.records.findLast(r => r.date === date);
  s.records = [...s.records.filter(r => r.date !== date), { ...existing, ...patch, date, source: 'Manual entry' }];
  s.metric = Object.keys(patch)[0]; s.selected = date;
}
export const workoutDays = { '2026-10-01': 'Chest + Triceps', '2026-10-04': 'Posterior legs', '2026-10-06': 'Back + Biceps', '2026-10-08': 'Chest + Triceps', '2026-10-10': 'Anterior legs', '2026-10-12': 'Chest + Triceps', '2026-10-14': 'Posterior legs' };
export function calendarCells(month) {
  const [year, m] = month.split('-').map(Number);
  const offset = (new Date(year, m - 1, 1, 12).getDay() + 6) % 7;
  const days = new Date(year, m, 0, 12).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
}
