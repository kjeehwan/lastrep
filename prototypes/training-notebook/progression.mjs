import { displayWeight, renderProgressOptions, nextProgressPrescription } from './progression-settings.mjs';
import { effortValue } from './model.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const progressionStates = [
  ['Progression', 'layout-minimal-progression-reps', 'Progression / add reps', 'A new session: the last three working sets met 6 reps at the target effort. Apply the two-rep step without changing past records.'],
  ['Progression', 'layout-minimal-progression-weight', 'Progression / increase weight', 'The last three sets reached 8 reps within target effort. Try your preferred 5 kg increase within a 10 kg maximum, then return to 6 reps.'],
  ['Progression', 'layout-minimal-progression-supported', 'Progression / supported larger increase', 'A synthetic recent session supports 90 kg for 3 sets of 6 at RPE 8. Compare this with the usual 5 kg increase and 10 kg maximum.'],
  ['Progression', 'layout-minimal-progression-smallest', 'Progression / no preferred increase', 'With no preferred increase, try the smallest available increment within your maximum.'],
  ['Progression', 'layout-minimal-progression-repeat', 'Progression / repeat', 'The rep goal was met, but recorded effort exceeded the target. Keep the prescription; you can still edit it yourself.'],
  ['Progression', 'layout-minimal-progression-mixed', 'Progression / previous sets mixed', 'The previous completed session used top and back-off sets. The current plan is uniform, but there is no comparable uniform session to progress from.'],
  ['Progression', 'layout-minimal-progression-planned', 'Progression / planned sets mixed', 'The previous session was uniform, but the current plan uses top and back-off sets. No automatic progression is offered for this plan.'],
  ['Progression', 'layout-minimal-progression-missing', 'Progression / missing effort', 'The rep goal was met, but missing effort ratings prevent confirming the effort criterion. No automatic increase is offered.'],
  ['Progression', 'layout-minimal-progression-sequence', 'Progression / custom rep sequence', 'Cable fly uses 12, 15, 18 within its 12–18 target range. Edit Rep steps to try your own sequence.'],
  ['Progression', 'layout-minimal-progression-limited', 'Progression / available weight gap', 'The equipment list has 80 and 85 kg, but the chosen increase is 2.5 kg. Repeat instead of silently making a larger jump. Edit the increase or Available weights to explore.'],
  ['Progression', 'layout-minimal-progression-history', 'Progression / no history', 'An exercise can still be planned and recorded without prior completed sets. No progression is inferred from an empty history.'],
];

export function setupProgression(state, id) {
  const sampleKind = id.split('-').at(-1), kind = ['limited','supported','smallest'].includes(sampleKind) ? 'weight' : sampleKind === 'sequence' ? 'reps' : sampleKind, exercise = state.exercises[0];
  state.exercises = [exercise];
  state.title = 'Chest + Triceps'; state.date = 'Wed, Oct 28'; state.elapsed = 0;
  exercise.targets = { min: 6, max: 8, rpe: 8 };
  exercise.notes = ''; exercise.tempo = '3-0-1-0'; exercise.unit = 'kg';
  const reps = kind === 'reps' ? '6' : '8';
  const row = (weight, reps, rpe = '', type = 'normal') => ({ weight, reps, rpe, type, done: false });
  exercise.previous = Array.from({ length: 3 }, (_, i) => row('80', reps, kind === 'repeat' ? ['9', '9.5', '10'][i] : kind === 'missing' && i === 2 ? '' : ['7.5', '8', '8'][i]));
  exercise.sets = [row('20', '4', '', 'warmup'), ...Array.from({ length: 3 }, () => row('80', reps))];
  if (kind === 'mixed') {
    exercise.previous = [row('90', '6', '8'), row('80', '8', '8'), row('80', '8', '8')];
  }
  if (kind === 'planned') {
    exercise.sets = [row('20', '4', '', 'warmup'), row('90', '6'), row('80', '8'), row('80', '8')];
  }
  if (kind === 'history') exercise.previous = [];
  exercise.availableWeights = {mode:'regular',unit:'kg',minimum:20,increment:2.5};
  if (sampleKind === 'limited') exercise.availableWeights = {mode:'custom',unit:'kg',values:[20,40,60,80,85]};
  if (sampleKind === 'sequence') {
    exercise.id = 'fly'; exercise.name = 'Cable fly'; exercise.availableWeights.minimum = 5; exercise.targets = {min:12,max:18,rpe:8};
    exercise.previous.forEach(row => {row.reps = '12'; row.weight = '20';});
    exercise.sets.forEach(row => {row.weight = row.type === 'warmup' ? '5' : '20'; row.reps = row.type === 'warmup' ? '4' : '12';});
  }
  state.progression = { options: {repSteps:[6,8,10,12,15,18],preferredIncreaseKg: ['weight','supported'].includes(sampleKind) ? 5 : null,weightIncreaseKg: ['weight','supported','smallest'].includes(sampleKind) ? 10 : 2.5}, editOption:'', id: exercise.id, kind, applied: false, before: null, after: '',
    baseline: JSON.stringify(exercise.sets), targets: JSON.stringify(exercise.targets) };
  if (sampleKind === 'supported') state.progression.comparableSession = {date:'Oct 24',sets:Array.from({length:3},()=>({weightKg:90,reps:6,rpe:8}))};
  state.selectedId = exercise.id;
}

const prescription = (p, exercise) => { const next = p.appliedPrescription ?? nextProgressPrescription(exercise,p); return `3 \u00d7 ${next.reps} at ${displayWeight(next.weightKg,exercise.unit)} ${exercise.unit}`; };
const working = exercise => exercise.sets.filter(row => !row.type || row.type === 'normal');
const mixedPlan = exercise => new Set(working(exercise).map(row => `${row.weight}/${row.reps}`)).size > 1;
function blocked(exercise, p) {
  if (working(exercise).some(row => row.done || String(row.rpe ?? '').trim())) return 'Working sets are already being recorded. Keep logging this session.';
  if (JSON.stringify(exercise.sets) !== p.baseline || JSON.stringify(exercise.targets) !== p.targets) return 'The plan has changed. Reset this example to review the original suggestion.';
  return '';
}
export function renderProgression(exercise, p) {
  if (!p || p.id !== exercise.id) return '';
  return `<button type="button" class="btn text progression-entry" data-action="progression-details" aria-label="Progress for ${esc(exercise.name)}">Progress</button>`;
}
function progressionSummary(exercise, p) {
  const currentMixed = mixedPlan(exercise), unavailable = !p.applied && nextProgressPrescription(exercise,p).type === 'unavailable';
  const title = currentMixed ? 'No suggestion' : unavailable ? 'Repeat' : p.applied ? 'Applied to this workout' : p.kind === 'reps' ? 'Add reps' : p.kind === 'weight' ? 'Increase weight' : p.kind === 'repeat' ? 'Repeat' : 'No suggestion';
  const description = currentMixed ? 'Current planned sets are mixed' : p.applied || ['reps', 'weight'].includes(p.kind) ? prescription(p, exercise) : p.kind === 'repeat' ? `3 \u00d7 8 at ${exercise.unit === 'lbs' ? 176.37 : 80} ${exercise.unit}` : p.kind === 'mixed' ? 'Previous completed sets were mixed' : p.kind === 'planned' ? 'Current plan has changed' : p.kind === 'history' ? 'No completed history yet' : 'Previous effort not confirmed';
  return `<div class="progression-result" ${p.applied ? 'role="status"' : ''}><span class="supporting">${title}</span><p class="progression-prescription">${description}</p></div>`;
}

export function progressionDetails(exercise, p, scale, { shell, button }) {
  const reasons = {
    reps: `In your previous completed session, all 3 working sets reached ${exercise.previous[0]?.reps ?? 6} reps without exceeding target effort. For this workout, try the next rep step at the same weight.`,
    weight: 'All 3 working sets reached 8 reps within target effort in your previous completed session.',
    repeat: 'In your previous completed session, all 3 sets reached 8 reps, but effort exceeded your target. For this workout, repeat before increasing difficulty. You can always change your plan manually.',
    mixed: 'Your previous completed session used different working weights and rep goals (top and back-off sets). Even though the current plan is uniform, this version cannot derive a progression from that mixed session. Missing a rep goal alone does not make a session mixed. You can keep planning and recording normally.',
    planned: 'Your currently planned working sets use different weights and rep goals (top and back-off sets). Even though the previous completed session was uniform, this version does not apply progression suggestions to a mixed plan. Missing a rep goal alone does not make a session mixed. You can keep planning and recording normally.',
    missing: 'In your previous completed session, all 3 sets reached 8 reps, but one effort rating is missing. The rep goal was met; your target effort could not be confirmed.',
    history: 'There is no completed history for this exercise yet. Choose your starting prescription and record your working sets normally. No progression is inferred from planned values alone.',
  };
  const next = p.appliedPrescription ?? nextProgressPrescription(exercise,p);
  if (p.kind === 'weight' && next.type === 'weight') reasons.weight += next.basis === 'history'
    ? ` You also completed 3 sets of 6 at ${displayWeight(next.weightKg,exercise.unit)} ${exercise.unit}, within target effort, on ${p.comparableSession.date}. This supports a larger increase within your maximum.`
    : next.basis === 'preferred' ? ' Try your preferred increase at an available weight and return to 6 reps.'
    : ' Try the smallest available increase and return to 6 reps.';
  const previous = exercise.previous.map((row, i) => `<div class="progression-history-row"><span>${i + 1}</span><span>${esc(row.weight)} ${exercise.unit} \u00d7 ${esc(row.reps)}</span><span>${row.rpe ? `${scale} ${effortValue(row.rpe, scale)}` : 'Not recorded'}</span></div>`).join('');
  const unavailable = !p.applied && nextProgressPrescription(exercise,p).type === 'unavailable';
  const canApply = !unavailable && !mixedPlan(exercise) && !p.applied && ['reps', 'weight'].includes(p.kind);
  const canUndo = p.applied && JSON.stringify(exercise.sets) === p.after;
  const footer = p.editOption ? button('Update suggestion', 'progression-save-options', 'primary') + button('Cancel edit', 'progression-cancel-options') : canApply ? button('Apply', 'progression-apply', 'primary', {}, !!blocked(exercise,p)) + button('Not now', 'close') : (canUndo ? button('Undo', 'progression-undo') : '') + button(p.applied ? 'Done' : 'Got it', 'close', 'primary');
  return shell('Progress', `<div class="progression-details"><h3>${esc(exercise.name)}</h3>${progressionSummary(exercise,p)}<p>${mixedPlan(exercise) ? reasons.planned : unavailable ? 'Your previous completed session met the rep and effort goals, but no heavier available weight fits your progression settings. Repeat this prescription or adjust your progression options.' : reasons[p.kind]}</p>${renderProgressOptions(exercise,p)}${previous ? `<section><h4>Previous completed session \u00b7 Oct 25</h4><div class="progression-history">${previous}</div></section>` : ''}<p class="supporting">Target: ${exercise.targets?.min ?? 6}\u2013${exercise.targets?.max ?? 8} reps \u00b7 ${scale} ${effortValue(8, scale)}</p>${!mixedPlan(exercise) && ['reps', 'weight'].includes(p.kind) ? '<p class="supporting">Only upcoming working sets change. Warm-ups, previous records and recorded effort stay unchanged.</p>' : ''}${canApply && blocked(exercise,p) ? `<p class="supporting">${esc(blocked(exercise,p))}</p>` : ''}</div>`, footer);
}

export function applyProgression(exercise, p) {
  if (!p || p.applied || mixedPlan(exercise) || !['reps', 'weight'].includes(p.kind) || blocked(exercise, p) || nextProgressPrescription(exercise,p).type === 'unavailable') return false;
  p.before = structuredClone(exercise.sets);
  p.appliedPrescription = nextProgressPrescription(exercise,p);
  for (const row of working(exercise)) { row.weight = String(displayWeight(p.appliedPrescription.weightKg,exercise.unit)); row.reps = String(p.appliedPrescription.reps); }
  p.applied = true; p.after = JSON.stringify(exercise.sets); return true;
}
export function undoProgression(exercise, p) {
  if (!p?.applied || JSON.stringify(exercise.sets) !== p.after) return false;
  exercise.sets = structuredClone(p.before); p.applied = false; p.before = null; p.after = ''; p.appliedPrescription = null; return true;
}
