// Synthetic browser study. No links are created, sent or persisted.
import { notebookIcon } from './notebook-icons.mjs';
export const sharingStates = [
  ['Workout sharing candidate', 'bottom-finish', 'Workout / sharing layout', 'Inbox is in the header; Finish follows the last exercise. Share workout remains below Today’s Plan.'],
  ['Workout sharing candidate', 'share-send', 'Share a workout', 'Preview the plan, then send within Lastrep or share an external link. In-app sharing is off until you enable it.'],
  ['Workout sharing candidate', 'share-receive', 'Receive a workout', 'Recipient: opening a link does not add anything. Review the plan, then choose how to use it.'],
  ['Workout sharing candidate', 'share-again', 'Receive the same workout again', 'The same recipient can receive and use this workout again at any time. An existing routine never blocks a new session.'],
  ['Workout sharing candidate', 'share-draft', 'Receive / workout already open', 'Keep the open workout, replace it explicitly, or add the shared exercises.'],
  ['Workout sharing candidate', 'share-unavailable', 'Shared link unavailable', 'A revoked or unavailable link leaves existing workouts and routines intact.'],
  ['Workout sharing candidate', 'share-apply', 'Use received workout / Workout destination', 'Arrives from Settings after Use for a new workout. Resolve the open-workout choice here.'],
  ['Workout sharing candidate', 'share-saved-routine', 'Received workout / saved routine', 'Arrives from Settings after Save to My routines. The current workout is preserved.'],
];
export function openSharingDestination(sharing, destination) {
  try { sessionStorage.setItem('lastrep-sharing-handoff', JSON.stringify(sharing)); } catch { /* Fall back to the synthetic example. */ }
  location.href = `./index.html#${destination}`;
}
export function takeSharingHandoff() {
  try { const raw = sessionStorage.getItem('lastrep-sharing-handoff'); sessionStorage.removeItem('lastrep-sharing-handoff'); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export const sharedPlan = () => [
  { id: 'bench', name: 'Bench press', unit: 'kg', mode: 'resistance', rest: 120, sets: [{ weight: '100', reps: '8' }, { weight: '100', reps: '8' }, { weight: '100', reps: '8' }] },
  { id: 'incline', name: 'Incline dumbbell press', unit: 'kg', mode: 'resistance', rest: 120, sets: [{ weight: '30', reps: '10' }, { weight: '30', reps: '10' }, { weight: '30', reps: '10' }] },
  { id: 'fly', name: 'Cable fly', unit: 'kg', mode: 'resistance', rest: 90, sets: [{ weight: '15', reps: '12' }, { weight: '15', reps: '12' }] },
  { id: 'pushdown', name: 'Tricep pushdown', unit: 'kg', mode: 'resistance', rest: 90, sets: [{ weight: '35', reps: '10' }, { weight: '35', reps: '10' }, { weight: '35', reps: '10' }] },
];
export function sharingState(id) {
  return { weights: true, routineSaved: id === 'share-again', used: false, plan: sharedPlan() };
}
export function planForSharing(plan, includeWeights = true) {
  return plan.map(ex => ({ id: ex.id, name: ex.name, mode: ex.mode, unit: ex.unit,
    rest: ex.rest ?? 0, tempo: ex.tempo || '', instructions: ex.instructions || '',
    ...(ex.mode === 'cardio' ? { time: ex.time || '', distance: ex.distance || '' } : {}),
    sets: ex.sets.map(row => ({ weight: includeWeights ? row.weight ?? '' : '', reps: row.reps ?? '', type: row.type || 'normal', targetRpe: row.targetRpe ?? '' })) }));
}
export function planSetMarkers(sets) {
  let working = 0;
  return sets.map(row => row.type === 'warmup' ? 'W' : (++working, ({ failure: 'F', drop: 'D' })[row.type] || working));
}
export function newSharedSession(plan) {
  return structuredClone(plan).map(ex => ({ ...ex, notes: ex.instructions || '', previous: [], sets: ex.sets.map(row => ({ ...row, done: false, rpe: '', type: row.type || 'normal' })) }));
}
export function workoutPlanPreview(a, esc) {
  const effortScale = a.effortScale || 'RPE';
  const exercises = `<ol class="share-exercises">${a.plan.map(ex => {
    const markers = planSetMarkers(ex.sets);
    const plain = ex.sets.every(row => (!row.type || row.type === 'normal') && (row.targetRpe == null || row.targetRpe === ''));
    const uniform = plain && ex.sets.every(row => row.weight === ex.sets[0]?.weight && row.reps === ex.sets[0]?.reps);
    const prescription = ex.mode === 'cardio' ? [ex.time && `${esc(ex.time)} time`, ex.distance && `${esc(ex.distance)} ${esc(ex.unit)}`].filter(Boolean).join(' · ') || 'Duration not set' : uniform ? `${ex.sets.length} sets · ${esc(ex.sets[0]?.reps || '—')} reps${a.weights && ex.sets[0]?.weight ? ' · ' + esc(ex.sets[0].weight) + ' ' + esc(ex.unit) : ''}` : ex.sets.map((row,i) => `${row.type === 'warmup' ? 'Warm-up' : row.type === 'drop' ? 'Drop set' : row.type === 'failure' ? 'Failure set' : `Set ${markers[i]}`} · ${a.weights && row.weight ? esc(row.weight) + ' ' + esc(ex.unit) + ' × ' : ''}${esc(row.reps || '—')} reps${row.targetRpe !== '' && row.targetRpe != null ? ` · Target ${effortScale} ${esc(effortScale === 'RIR' ? 10-Number(row.targetRpe) : row.targetRpe)}` : ''}`).join('<br>');
    return `<li><strong>${esc(ex.name)}</strong><span>${prescription}</span><span>Rest ${esc(ex.rest ?? 0)} sec${ex.tempo ? ` · Tempo ${esc(ex.tempo)}` : ''}</span>${ex.instructions ? `<span class="share-instructions">${esc(ex.instructions)}</span>` : ''}</li>`;
  }).join('')}</ol>`;
  const title = `<div class="share-heading"><p class="supporting">Workout plan</p><h3>${esc(a.title || 'Chest + Triceps')}</h3><p class="supporting">${a.plan.length} exercises · ${a.plan.reduce((n,ex)=>n+ex.sets.length,0)} sets</p></div>`;
  return { title, exercises, preview: title + exercises };
}

export function sharingDialog(s, { shell: baseShell, button: btn, paragraph: p, escape: esc }) {
  const shell = (...args) => baseShell(...args).replace('class="sheet ', 'class="sheet sharing-sheet ');
  const a = s.sharing;
  const { title, exercises, preview } = workoutPlanPreview(a, esc);
  switch (s.modal) {
    case 'share-send': return shell('Share workout', title + `<button class="share-toggle" data-action="sharing-weights" aria-pressed="${a.weights}"><span class="checkmark ${a.weights ? 'checked' : ''}">${a.weights ? '✓' : ''}</span><span>Include weights</span></button>` + p('Shares the plan, including target effort, tempo and recipient instructions when set. Personal notes, recorded effort and completed marks stay private.') + exercises, btn('Send in Lastrep', 'social-search', 'primary') + btn('Share external link', 'sharing-send'));
    case 'share-system': return shell('Share with…', p(`Choose an app to send ${esc(a.title || 'Chest + Triceps')}.`) + p('Anyone with the link can view this plan.') + `<div class="share-destinations">${[['Messages', 'message'], ['Email', 'mail'], ['Copy link', 'copy']].map(([name, symbol]) => btn(`${notebookIcon(symbol)}<span>${name}</span>`, 'sharing-sent', 'share-destination')).join('')}</div>` + p('Android share sheet preview. No message or link will be sent.', 'mock-disclaimer'), btn('Back', 'sharing-back-send'));
    case 'share-sent': return shell('Ready to share', p('This workout uses the same link when you share it again.') + p('Sharing is simulated in this study.', 'mock-disclaimer'), btn('Share again', 'sharing-send', 'primary') + btn('Preview as recipient', 'sharing-recipient'));
    case 'share-receive': case 'share-again': return shell('Shared workout', p(`Shared by ${esc(a.sender || 'Alex · @alex.lifts')}`, 'supporting') + preview + (a.routineSaved ? `<p class="share-confirm" role="status">✓ Already saved to My routines</p>` : '') + p('Use this plan with your own weights. Sets start unchecked; effort fields start empty.') + (a.used ? `<p role="status" class="share-confirm">New workout is open.</p>` : ''), btn(a.used ? 'View workout' : 'Use for a new workout', a.used ? 'close' : 'sharing-use', 'primary') + btn(a.routineSaved ? 'View saved routine' : 'Save to My routines', a.routineSaved ? 'sharing-view-routine' : 'sharing-save-routine'));
    case 'share-draft': return shell('A workout is already open', p(`Your ${esc(s.title || 'current workout')} has ${s.exercises.length} exercises. Choose what to do with ${esc(a.title || 'Chest + Triceps')}.`) + p('Replacing discards the open workout and its unsaved sets. Saved workouts stay in your history.'), btn('Keep current workout', 'close', 'primary') + btn('Add shared exercises', 'sharing-append') + btn('Replace current workout', 'sharing-confirm-replace', 'danger'));
    case 'share-routine': return shell('Saved routine', preview + p('You can use this routine again whenever you train. Opening a shared link again does not create another routine.'), btn('Use for a new workout', 'sharing-use', 'primary') + btn('Back to shared workout', 'sharing-recipient'));
    case 'share-unavailable': return shell('Workout unavailable', p('This sharing link is no longer available. Ask the sender for a new link. Your saved routines and workouts are unchanged.'), btn('Back to workout', 'close', 'primary'));
    default: return '';
  }
}
