import { copy, fixture, catalog, exerciseFromCatalog, lastText, effortValue, guidanceChanges, moveExercise, summary, setUnit, states } from './model.mjs';

const $ = (q, root = document) => root.querySelector(q);
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icons = {
  home: '<path d="M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10"/>',
  workout: '<path d="M2 12h20M5 6v12M8 8v8M16 8v8M19 6v12"/>',
  nutrition: '<path d="M12 7C4 2 1 10 5 17c2 5 5 4 7 3 2 1 5 2 7-3 4-7 1-15-7-10Z"/><path d="M12 7c0-4 3-5 6-5-1 4-3 5-6 5Z"/>',
  sleep: '<path d="M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z"/>',
  profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-9 16-9 16 0Z"/>',
  note: '<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h4M9 12h6M9 16h6"/>',
  speedometer: '<path d="M4 19a10 10 0 1 1 16 0Z"/><path d="m12 12 5-5M12 3v2M4.9 5.9l1.4 1.4M2 13h2M20 13h2"/><circle cx="12" cy="13" r="1.5"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7h5"/>',
  down: '<path d="m6 9 6 6 6-6"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  check: '<path d="m5 12 4 4L19 6"/>', reorder: '<path d="M7 4v16m-3-3 3 3 3-3M17 20V4m-3 3 3-3 3 3"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="2"/><path d="m4 19 6-6 4 3 3-5 4 8"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] ?? icons.note}</svg>`;
const attrs = o => Object.entries(o).map(([k, v]) => `data-${k}="${escape(v)}"`).join(' ');
const button = (label, action, kind = 'text', data = {}, disabled = false) => `<button type="button" class="btn ${kind}" data-action="${action}" ${attrs(data)} ${disabled ? 'disabled' : ''}>${label}</button>`;
const paragraph = (str, cls = 'supporting') => `<p class="${cls}">${str}</p>`;
const check = done => `<span class="checkmark ${done ? 'checked' : ''}">${done ? icon('check') : ''}</span>`;
let serial = 0, s;
let chosen = 'active', size = [390, 844], theme = false, large = false, scale = 'RPE', compare = true;
let toastTimer;

const modalMap = {
  routines: 'routines', recommend: 'recommend', 'exercise-menu': 'exercise-menu', 'set-options': 'set-options',
  'rest-detail': 'rest-detail', weights: 'weights', 'plan-none': 'plan-none', disclosure: 'disclosure',
  'plan-busy': 'plan-busy', 'plan-ok': 'plan-ok', 'plan-changes': 'plan-changes', 'plan-why': 'plan-changes',
  'plan-stale': 'plan-stale', 'plan-applied': 'plan-applied', 'plan-error': 'plan-error', context: 'context',
  history: 'history', 'history-empty': 'history-empty', finish: 'finish', saving: 'saving', 'save-error': 'save-error',
  saved: 'saved', 'routine-update': 'routine-update', 'routine-updated': 'routine-updated', 'deload-saved': 'deload-saved', discard: 'discard',
};

function makeState(id) {
  const state = { exercises: fixture(), title: 'Chest + Triceps', source: 'Chest + Triceps', modal: modalMap[id] ?? '', page: 'workout', selectedId: 'bench', setIndex: 1, keyboard: id === 'editing', query: 'press', selected: ['bench', 'incline'], searchMode: 'ready', plan: 'none', disclosure: false, why: id === 'plan-why', pain: 'None', activity: '', note: '', ratings: { soreness: 1, fatigue: 1, motivation: 9 }, draft: {}, undoSet: null, planBefore: null, planAfter: null, step: 2.5, focus: 'Chest + Triceps', length: 'Standard', rest: null, elapsed: 1122, clockStart: null, toast: '', demoScroll: id === 'editing' ? 136 : null, sample: id, date: 'Thu, Oct 15', historyPoint: 2, followed: '', helpful: '' };
  if (['empty', 'routines', 'recommend'].includes(id)) { state.exercises = []; state.title = ''; state.source = ''; }
  if (['add', 'search-loading', 'search-empty', 'search-error'].includes(id)) { state.page = 'search'; state.keyboard = id === 'add'; state.searchMode = id === 'search-loading' ? 'loading' : id === 'search-empty' ? 'empty' : id === 'search-error' ? 'error' : 'ready'; if (id === 'search-empty') state.query = 'Pendulum V squat'; }
  if (id === 'custom') { state.page = 'custom'; state.keyboard = true; state.draft.customName = 'Pendulum squat'; }
  if (id.startsWith('plan-') || id === 'disclosure' || id === 'context') { state.plan = id.replace('plan-', ''); state.disclosure = id !== 'disclosure'; }
  if (['plan-changes', 'plan-why', 'plan-applied'].includes(id)) state.pain = 'Wrist / hand';
  if (id === 'plan-applied') { state.planBefore = copy(state.exercises); state.exercises = guidanceChanges(state.exercises); state.planAfter = JSON.stringify(state.exercises); }
  if (id === 'rest' || id === 'rest-paused' || id === 'rest-detail') { state.rest = { remaining: 84, deadline: id === 'rest-paused' ? null : Date.now() + 84000, exercise: 'Bench press' }; state.demoScroll = 220; }
  if (id === 'deleted') { const row = state.exercises[0].sets.splice(1, 1)[0]; state.undoSet = { id: 'bench', index: 1, row }; }
  if (id.startsWith('cardio')) { const e = exerciseFromCatalog('treadmill'); e.time = '20:00'; e.distance = '3.2'; if (id === 'cardio-selected') { e.zone = '2'; e.session = 'Steady'; e.effort = 'Moderate'; } state.exercises = [e]; state.title = 'Cardio session'; state.source = ''; state.selectedId = e.id; }
  if (id === 'bodyweight') { state.exercises = [exerciseFromCatalog('legraise'), exerciseFromCatalog('v-squat', 'Custom V Squat')]; state.title = 'Accessories'; state.source = ''; }
  if (id === 'history-empty') state.selectedId = 'fly';
  return state;
}

function loadExample(id) {
  chosen = id; s = makeState(id); lastInput = null; scale = $('#effort').value;
  size = id === 'compact' ? [360, 800] : id === 'landscape' ? [844, 390] : id === 'tablet' ? [800, 1280] : id === 'tablet-wide' ? [1280, 800] : [390, 844];
  theme = id === 'dark'; large = id === 'large'; compare = id === 'active';
  if (id === 'landscape') { s.keyboard = true; s.demoScroll = 136; }
  $('#viewport').value = size.join(','); $('#dark').checked = theme; $('#large').checked = large; $('#compare').checked = compare; $('#example').value = id;
  render(false);
  if (['editing', 'landscape'].includes(id)) requestAnimationFrame(() => focusSet('bench', 1, 'reps', id === 'landscape'));
}

const getExercise = (id = s.selectedId) => s.exercises.find(e => e.id === id);
function toast(message) { s.toast = message; clearTimeout(toastTimer); render(); toastTimer = setTimeout(() => { s.toast = ''; render(); }, 5000); }
function field(label, name, value = '', placeholder = '', type = 'text') {
  return `<label class="field"><span>${escape(label)}</span><input type="${type}" data-draft="${name}" value="${escape(value)}" placeholder="${escape(placeholder)}" ${type === 'text' && /weight|duration|distance|increment/i.test(name) ? 'inputmode="decimal"' : ''}></label>`;
}
function chips(items, selected, action, data = {}, columns = 3) {
  return `<div class="chip-grid" style="--columns:${columns}">${items.map(v => `<button type="button" class="chip ${[].concat(selected).includes(v) ? 'selected' : ''}" aria-pressed="${[].concat(selected).includes(v)}" data-action="${action}" ${attrs({ ...data, value: v })}>${escape(v)}</button>`).join('')}</div>`;
}

function sessionHeader() {
  return `<section class="session-heading" aria-label="Session details"><div class="date-row"><span class="supporting">${s.date}</span><button class="elapsed" data-action="session-time" aria-label="Session timer, adjust elapsed time"><span data-clock="session">${time(s.elapsed)}</span></button></div><h1 class="editorial session-title">${escape(s.title)}</h1><p class="supporting phase-row">Hypertrophy${s.clockStart === 'paused' ? ' · Paused' : ''}</p>${s.source ? `<div class="source-row"><span class="supporting">Routine: ${escape(s.source)}</span>${button('Change', 'open', 'text', { modal: 'routines' })}</div>` : ''}<div class="plan-row">${icon('note')}<span class="plan-summary">${escape(planLabel())}</span>${button(s.plan === 'applied' ? 'View' : 'Review', 'review-plan')}</div></section>`;
}
function planLabel() { return ({ none: "Today's Plan", busy: 'Reviewing workout...', ok: 'Train as planned', changes: `${adjustmentCount()} exercises adjusted`, stale: 'Workout or context changed', applied: 'Changes applied', error: 'Review unavailable' })[s.plan] ?? "Today's Plan"; }

function resistance(e) {
  return `<div class="set-table" role="group" aria-label="${escape(e.name)} sets"><div class="set-grid table-header" aria-hidden="true"><span>Set</span><span>Last</span><span>${e.unit}</span><span>Reps</span><span>${scale}</span><span>Done</span></div>${e.sets.map((row, i) => {
    const prev = e.previous[i], marker = ({ warmup: 'W', failure: 'F', drop: 'D' })[row.type] ?? i + 1;
    return `<div class="set-grid set-row ${row.done ? 'completed' : ''}"><button class="set-marker" data-action="set-menu" ${attrs({ id: e.id, index: i })} aria-label="${escape(e.name)}, set ${i + 1}, ${row.type}, options">${marker}</button><button class="last-value" data-action="copy-last" ${attrs({ id: e.id, index: i })} ${prev ? '' : 'disabled'} aria-label="${escape(e.name)}, set ${i + 1}, copy previous ${escape(lastText(prev, scale))}, ${e.unit}, ${scale}">${escape(lastText(prev, scale))}</button>${['weight', 'reps', 'rpe'].map(k => `<label><span class="cell-label">${k === 'weight' ? e.unit : k === 'rpe' ? scale : 'Reps'}</span><input class="set-input" type="text" inputmode="${k === 'reps' ? 'numeric' : 'decimal'}" data-set="${e.id}" data-index="${i}" data-field="${k}" value="${escape(k === 'rpe' ? effortValue(row[k], scale) : row[k])}" aria-label="${escape(e.name)}, set ${i + 1}, ${k === 'weight' ? e.unit : k === 'rpe' ? scale : 'reps'}" autocomplete="off" spellcheck="false"></label>`).join('')}<button class="done" data-action="done" ${attrs({ id: e.id, index: i })} aria-label="${escape(e.name)}, set ${i + 1}, completed" aria-pressed="${row.done}">${check(row.done)}</button></div>`;
  }).join('')}</div>`;
}
function bodyweight(e) {
  return `<div class="section-stack"><div class="bodyweight-grid label muted"><span>Set</span><span>Last</span><span>Reps</span><span>${scale}</span><span>Done</span></div>${e.sets.map((row, i) => `<div class="bodyweight-grid bodyweight-row"><button class="set-marker" data-action="set-menu" ${attrs({ id: e.id, index: i })}>${i + 1}</button><span class="last-value">No record</span><label><span class="cell-label">Reps</span><input class="set-input" data-set="${e.id}" data-index="${i}" data-field="reps" value="${escape(row.reps)}" inputmode="numeric" aria-label="${e.name}, set ${i + 1}, reps"></label><label><span class="cell-label">${scale}</span><input class="set-input" data-set="${e.id}" data-index="${i}" data-field="rpe" value="${effortValue(row.rpe, scale)}" inputmode="decimal" aria-label="${e.name}, set ${i + 1}, ${scale}"></label><button class="done" data-action="done" ${attrs({ id: e.id, index: i })} aria-label="Complete ${e.name} set ${i + 1}" aria-pressed="${row.done}">${check(row.done)}</button></div>`).join('')}</div>`;
}
function cardio(e) {
  return `<div class="section-stack"><div class="cardio-fields">${field('Time / min:sec', `cardio-time-${e.id}`, e.time, 'e.g. 20:00')}${field('Distance / km', `cardio-distance-${e.id}`, e.distance, 'e.g. 3.2')}<div class="cardio-completion"><span class="label muted">Done</span><button class="done" data-action="cardio-done" data-id="${e.id}" aria-label="${escape(e.name)}, session completed" aria-pressed="${e.sets[0].done}">${check(e.sets[0].done)}</button></div></div><p class="label">Zone</p>${chips(['1', '2', '3', '4', '5'], e.zone, 'cardio-toggle', { id: e.id, field: 'zone' }, 5)}<p class="label">Session type</p>${chips(['Steady', 'Intervals', 'Recovery'], e.session, 'cardio-toggle', { id: e.id, field: 'session' })}<p class="label">Effort level</p>${chips(['Easy', 'Moderate', 'Hard'], e.effort, 'cardio-toggle', { id: e.id, field: 'effort' })}</div>`;
}
function exercise(e, index) {
  return `<section class="exercise" data-exercise="${e.id}" aria-label="${escape(e.name)}"><div class="exercise-heading"><span class="ordinal">${String(index + 1).padStart(2, '0')}</span><button class="name" data-action="history" data-id="${e.id}">${escape(e.name)}</button><button class="icon-button" data-action="exercise-menu" data-id="${e.id}" aria-label="${escape(e.name)}, options">${icon('more')}</button></div><div class="exercise-controls ${e.mode === 'cardio' ? 'cardio-controls' : ''}"><button data-action="demo" data-id="${e.id}">${icon('play')}Demo</button><button data-action="rest-detail" data-id="${e.id}">${icon('clock')}Rest ${time(e.rest)}</button>${e.mode !== 'cardio' ? `<button class="tempo-control" data-action="open" data-modal="tempo" data-id="${e.id}">${icon('speedometer')}<span>Tempo</span>${e.tempo ? `<span>${escape(e.tempo)}</span>` : ''}</button>` : ''}</div><div class="exercise-note">${field('Note', `note-${e.id}`, e.notes, 'e.g. Keep the last rep controlled')}</div>${e.mode === 'cardio' ? cardio(e) : e.mode === 'bodyweight' ? bodyweight(e) : resistance(e)}${e.mode !== 'cardio' ? `<div class="set-actions">${button('+ Add set', 'add-set', 'text', { id: e.id })}${button('Duplicate last set', 'duplicate-set', 'text', { id: e.id })}</div>` : ''}${s.undoSet?.id === e.id ? `<div class="inline-undo"><span>Set deleted</span>${button('Undo', 'undo-set')}</div>` : ''}</section>`;
}
function empty() { return `<div class="empty-content"><span class="supporting">Thu, Oct 15</span><h1 class="editorial">Your next session</h1>${paragraph('Choose a routine or add your first exercise.')}<div style="height:12px"></div>${button('Choose routine', 'open', 'primary', { modal: 'routines' })}${button('Add exercise', 'search', '')}${button('Recommend workout', 'open', 'text', { modal: 'recommend' })}${button('Repeat past workout', 'repeat')}${button('Create routine', 'open', 'text', { modal: 'create-routine' })}</div>`; }
function searchPage() {
  const matches = catalog.filter(e => e[1].toLowerCase().includes(s.query.toLowerCase()));
  return `<div class="section-stack"><div class="search-wrap"><input data-query value="${escape(s.query)}" placeholder="Search exercises" aria-label="Search exercises">${s.query ? '<button class="search-clear" data-action="clear-search" aria-label="Clear exercise search">×</button>' : ''}</div>${s.selected.length ? `<div class="selected-chips">${s.selected.map(id => `<button class="selected-chip" data-action="toggle-exercise" data-id="${id}" aria-label="Unselect ${escape(catalog.find(e => e[0] === id)?.[1])}">${escape(catalog.find(e => e[0] === id)?.[1])} <span aria-hidden="true">×</span></button>`).join('')}</div>` : ''}${s.searchMode === 'loading' ? '<div class="busy-row"><span class="spinner" aria-hidden="true"></span><p class="supporting" role="status">Searching exercises...</p></div>' : s.searchMode === 'error' ? `<h3>Couldn't load exercises</h3>${paragraph('Try another search.')}${button('Try again', 'retry-search', '')}` : s.searchMode === 'empty' || !matches.length ? `<h3>No matching exercises</h3>${paragraph('Try another name or create a custom exercise.')}${button('Clear search', 'clear-search')}${button('Create custom exercise', 'custom', '')}` : `<div>${matches.map(([id, name, meta]) => `<div class="result-row"><button class="done" data-action="toggle-exercise" data-id="${id}" aria-label="Select ${name}" aria-pressed="${s.selected.includes(id)}">${check(s.selected.includes(id))}</button><button class="result-title" data-action="toggle-exercise" data-id="${id}"><strong>${name}</strong><small>${meta}</small></button></div>`).join('')}</div>${button('Create custom exercise', 'custom')}`}</div>`;
}
function customPage() {
  return `<div class="section-stack">${paragraph('Create an entry for the way you train.')}${field('Exercise name', 'customName', s.draft.customName ?? '', 'e.g. Pendulum squat')}${field('Muscle group', 'customMuscle', s.draft.customMuscle ?? 'Quads', 'e.g. Quads')}${field('Equipment', 'customEquipment', s.draft.customEquipment ?? 'Machine', 'e.g. Machine')}${s.draft.error ? paragraph(escape(s.draft.error), 'form-error') : ''}</div>`;
}
function tabs() { return `<nav class="bottom-tabs" aria-label="App destinations">${['Home', 'Workout', 'Nutrition', 'Sleep', 'Profile'].map(name => `<button class="tab ${name === 'Workout' ? 'active' : ''}" data-action="tab" data-value="${name}" ${name === 'Workout' ? 'aria-current="page"' : ''}>${icon(name.toLowerCase())}${name}</button>`).join('')}</nav>`; }
const time = seconds => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`;
function remaining() { return s.rest?.deadline ? Math.max(0, Math.ceil((s.rest.deadline - Date.now()) / 1000)) : s.rest?.remaining ?? 0; }
function restDock() { return `<div class="rest-dock"><button class="rest-copy" data-action="open" data-modal="rest-detail" aria-label="Open rest timer"><span>${remaining() > 0 ? `Rest: ${escape(s.rest.exercise)}` : 'Rest complete'}</span><strong data-clock="rest">${time(remaining())}</strong></button>${remaining() > 0 ? button(s.rest.deadline ? 'Pause' : 'Resume', 'pause-rest') : ''}${button(remaining() > 0 ? 'Skip' : 'Dismiss', 'skip-rest')}</div>`; }

function keyboard(alpha = false) {
  if (alpha) return `<section class="keyboard alpha" aria-label="Illustrative alphabetic keyboard"><div class="keyboard-toolbar"><span>Illustrative keyboard</span><button data-action="hide-keyboard">Hide</button></div>${['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map(row => `<div class="alpha-row">${[...row].map(k => `<button class="key" data-action="key" data-key="${k}">${k}</button>`).join('')}</div>`).join('')}<div class="alpha-row"><button class="key" data-action="key" data-key="Backspace">⌫</button><button class="key space" data-action="key" data-key=" ">space</button><button class="key" data-action="hide-keyboard">Done</button></div><div class="keyboard-bottom"><span></span><span class="home-indicator"></span><span></span></div></section>`;
  return `<section class="keyboard" aria-label="Illustrative numeric keyboard"><div class="keyboard-toolbar"><button data-action="hide-keyboard" aria-label="Hide keyboard">⌄</button><span>Illustrative keyboard</span><span>123</span></div><div class="keyboard-keys">${['1', '2', '3', '-', '4', '5', '6', 'Next', '7', '8', '9', 'Backspace', '.', '0', ',', 'Done'].map((k, i) => `<button class="key ${i % 4 === 3 ? 'special' : ''}" data-action="key" data-key="${k}" aria-label="${k}">${k === 'Backspace' ? '⌫' : k === 'Next' ? '↹' : k === 'Done' ? '↵' : k}</button>`).join('')}</div><div class="keyboard-bottom"><button data-action="hide-keyboard" aria-label="Hide keyboard">⌄</button><span class="home-indicator"></span><span></span></div></section>`;
}

function dialogShell(title, body, footer = '', center = false) {
  return `<div class="overlay" data-action="outside"><section class="sheet ${center ? 'center' : ''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header class="sheet-head"><h2 id="dialog-title" class="${s.modal === 'saved' ? 'saved-heading' : ''}">${s.modal === 'saved' ? icon('check') : ''}<span>${title}</span></h2><button type="button" class="icon-button close" data-action="close" aria-label="Close dialog" ${s.modal === 'saving' ? 'disabled' : ''}>×</button></header><div class="sheet-body">${body}</div>${footer ? `<footer class="sheet-footer">${footer}</footer>` : ''}</section></div>`;
}
function guidanceBody() {
  const before = s.planBefore ?? s.exercises, after = guidanceChanges(before, s.step);
  return before.filter(e => ['bench', 'incline'].includes(e.id.split('-')[0])).map(a => {
    const b = after.find(e => e.id === a.id); if (!b) return '';
    return `<div class="change-group"><h3>${escape(a.name)}</h3><div class="changes-table">${a.sets.map((r, i) => r.done || r.type === 'warmup' ? `<div class="change-line"><span>Set ${i + 1}</span><span>${escape(r.weight)} ${a.unit} × ${r.reps} · unchanged (${r.done ? 'completed' : 'warmup'})</span></div>` : `<div class="change-line"><span>Set ${i + 1}</span><span>${escape(r.weight)} ${a.unit} × ${r.reps} → <strong>${escape(b.sets[i].weight)} ${a.unit} × ${b.sets[i].reps}</strong></span></div>`).join('')}</div></div>`;
  }).join('');
}
function adjustmentCount() {
  const before = s.planBefore ?? s.exercises, after = guidanceChanges(before, s.step);
  return before.filter((e, i) => JSON.stringify(e.sets) !== JSON.stringify(after[i].sets)).length;
}
function historySessions(e) {
  const sessions = [{ day: 12, sets: copy(e.previous) }];
  if (e.id === 'bench') sessions.unshift({ day: 1, sets: Array.from({ length: 3 }, () => ({ weight: '95', reps: '5', rpe: '' })) }, { day: 8, sets: Array.from({ length: 3 }, () => ({ weight: '100', reps: '4', rpe: '' })) });
  return sessions.map(session => ({ ...session, estimate: Math.max(...session.sets.map(row => Number(row.weight) * (1 + Number(row.reps) / 30))) }));
}
function chart(sessions) {
  const values = sessions.map(x => x.estimate), lo = Math.min(...values) - 2, range = Math.max(4, Math.max(...values) - lo + 2);
  const points = sessions.map((session, i) => [sessions.length === 1 ? 165 : 28 + i * 274 / (sessions.length - 1), 90 - (session.estimate - lo) / range * 70]);
  return `<div class="chart-scroll" tabindex="0" role="region" aria-label="Exercise progress chart, scroll horizontally at enlarged text sizes"><svg class="chart" viewBox="0 0 330 120" role="img" aria-label="Illustrative estimated strength from ${sessions.length} recorded sessions"><path class="axis" d="M12 94H320"/>${points.length > 1 ? `<polyline class="trend" points="${points.map(p => p.join(',')).join(' ')}"/>` : ''}${points.map(([x, y], i) => `<circle class="point ${Math.min(s.historyPoint, points.length - 1) === i ? 'selected' : ''}" cx="${x}" cy="${y}" r="4"/><circle class="hit" cx="${x}" cy="${y}" r="18" data-action="history-point" data-value="${i}" tabindex="0" role="button" aria-label="Select October ${sessions[i].day}"/><text x="${x - 12}" y="114">${i === 0 ? 'Oct ' : ''}${sessions[i].day}</text>`).join('')}</svg></div>`;
}
function historyContent(e) {
  const sessions = historySessions(e), current = sessions.at(-1), selected = sessions[Math.min(s.historyPoint, sessions.length - 1)];
  const selectedSet = selected.sets[0], best = Math.max(...sessions.map(x => x.estimate));
  return `<div class="stats"><div><strong>${Number(current.estimate.toFixed(1))} ${e.unit}</strong><span>Latest estimated 1RM</span></div><div><strong>${Number(best.toFixed(1))} ${e.unit}</strong><span>Best estimated 1RM</span></div></div>${chart(sessions)}${paragraph(`Selected: Oct ${selected.day} · ${escape(selectedSet.weight)} ${e.unit} × ${escape(selectedSet.reps)}${selectedSet.rpe ? ` @ ${scale} ${effortValue(selectedSet.rpe, scale)}` : ''}`)}${[...sessions].reverse().map(session => `<div class="change-group"><h3>Oct ${session.day}, 2026</h3><table class="history-table"><thead><tr><th>Set</th><th>${e.unit}</th><th>Reps</th><th>${scale}</th></tr></thead><tbody>${session.sets.map((row, i) => `<tr><td>${i + 1}</td><td>${escape(row.weight)}</td><td>${escape(row.reps)}</td><td>${row.rpe ? effortValue(row.rpe, scale) : '—'}</td></tr>`).join('')}</tbody></table></div>`).join('')}${paragraph('Illustrative recorded sessions; no daily values are inferred.', 'mock-disclaimer')}`;
}

function modal() {
  const e = getExercise(), sum = summary(s.exercises), actions = (primary, a, secondary = 'Back to workout', sa = 'close') => button(primary, a, 'primary') + (secondary ? button(secondary, sa, '') : '');
  switch (s.modal) {
    case 'routines': return dialogShell('Choose routine', `${field('Search routines', 'routineQuery', s.draft.routineQuery ?? '', 'Search by name')}<div class="section-stack">${[['Chest + Triceps', '4 exercises · 11 planned sets'], ['Posterior legs', '5 exercises · 15 planned sets'], ['Shoulders + Arms', '5 exercises · 14 planned sets']].filter(x => x[0].toLowerCase().includes((s.draft.routineQuery ?? '').toLowerCase())).map(([name, meta]) => `<div>${button(name, 'load-routine', '', { value: name })}${paragraph(meta)}</div>`).join('')}</div>${button('Deload this routine', 'deload')}${button('Repeat past workout', 'repeat')}${button('Create routine', 'open', 'text', { modal: 'create-routine' })}`);
    case 'recommend': return dialogShell('Recommend workout', `${paragraph('Choose a focus')}${chips(['Chest', 'Chest + Triceps', 'Back', 'Back + Biceps', 'Legs', 'Anterior legs', 'Posterior legs', 'Shoulders', 'Shoulders + Arms', 'Arms', 'Push', 'Pull'], s.focus, 'focus', {}, 2)}<h3>Session length</h3>${chips(['Quick', 'Standard', 'Extended'], s.length, 'length')}${paragraph('Volume adapts to recent training and recovery. This prototype loads a fixture, not a generated recommendation.')}`, button('Recommend workout', 'generate-workout', 'primary'));
    case 'create-routine': return dialogShell('Create routine', `${field('Routine name', 'routineName', s.draft.routineName ?? '', 'e.g. Upper body')}${paragraph('Use the exercise editor to build your routine. This is a local mock flow.')}`, actions('Start building', 'build-routine'));
    case 'replace-guard': return dialogShell('Replace this workout?', paragraph('Your current draft has exercises. Replace it with the selected routine, or add the routine to this session.'), button('Replace workout', 'confirm-routine', 'primary') + button('Append instead', 'append-routine', '') + button('Keep current workout', 'close', ''), true);
    case 'exercise-menu': {
      const i = s.exercises.indexOf(e);
      return dialogShell(escape(e?.name ?? 'Exercise options'), `<div class="reorder-row">${icon('reorder')}${button('Up', 'move', '', { direction: -1 }, i === 0)}${button('Down', 'move', '', { direction: 1 }, i === s.exercises.length - 1)}</div>${button('Replace exercise', 'open', '', { modal: 'replace' })}${e?.mode === 'resistance' ? `${chips(['kg', 'lbs'], e.unit, 'unit')}${button('Available weights', 'open', '', { modal: 'weights' })}` : ''}<div class="divider"></div><button class="btn danger" data-action="delete-exercise">Delete exercise</button>`);
    }
    case 'replace': return dialogShell('Replace exercise', e?.custom ? paragraph('No automatic suggestions for a custom exercise. Add another exercise manually if needed.') : `${paragraph('Choose an alternative for this mock session.')}${button('Machine chest press', 'replace-exercise', '')}${button('Dumbbell bench press', 'replace-exercise', '')}`);
    case 'set-options': return dialogShell('Set options', `${paragraph(`${escape(e?.name)} · Set ${s.setIndex + 1}`)}<h3>Set type</h3>${chips(['Normal', 'Warm-up', 'Failure', 'Drop'], ({ normal: 'Normal', warmup: 'Warm-up', failure: 'Failure', drop: 'Drop' })[e?.sets[s.setIndex]?.type], 'set-type', {}, 2)}${e?.mode === 'resistance' ? `<h3>Adjust baseline load</h3>${chips(['-10%', '-5%', '0%', '+5%', '+10%'], [], 'percentage', {}, 3)}` : ''}<div class="divider"></div><button class="btn danger" data-action="delete-set">Delete set</button>`);
    case 'rest-detail': return dialogShell('Rest timer', `<div class="stats"><div><strong data-clock="rest">${time(remaining() || e?.rest || 120)}</strong><span>${escape(e?.name ?? 'Bench press')}</span></div></div>${chips(['01:00', '01:30', '02:00', '03:00'], time(e?.rest ?? 120), 'rest-preset', {}, 2)}${field('Custom duration / seconds', 'restDuration', s.draft.restDuration ?? '', 'e.g. 90')}`, button(s.rest ? s.rest.deadline ? 'Pause' : 'Resume' : 'Start rest', s.rest ? 'pause-rest' : 'start-rest', 'primary') + button('Apply custom duration', 'custom-rest', '') + button('Skip rest', 'skip-rest', 'text'));
    case 'session-time': return dialogShell('Session timer', `<div class="stats"><div><strong data-clock="session">${time(s.elapsed)}</strong><span>Elapsed time</span></div></div>${field('Elapsed minutes', 'sessionMinutes', s.draft.sessionMinutes ?? '', 'e.g. 20')}`, actions(s.clockStart && s.clockStart !== 'paused' ? 'Pause timer' : 'Resume timer', 'pause-session') + button('Apply time', 'apply-time', 'text'));
    case 'weights': return dialogShell('Available weights', `${paragraph(escape(e?.name ?? 'Bench press'))}${field('Weight increment / kg', 'increment', s.draft.increment ?? String(s.step), 'e.g. 2.5')}${paragraph('Use the increment available at your gym. The mock adjustments round down to this increment.')}${s.draft.error ? paragraph(escape(s.draft.error), 'form-error') : ''}`, actions('Save settings', 'save-weights') + button('Clear settings', 'clear-weights', 'text'));
    case 'tempo': return dialogShell('Tempo', `${paragraph('Eccentric / hold / concentric / hold')}${field('Tempo', 'tempo', s.draft.tempo ?? e?.tempo ?? '', 'e.g. 3-0-1-0')}`, actions('Apply tempo', 'apply-tempo'));
    case 'demo': return dialogShell(escape(e?.name ?? 'Exercise demo'), `<div class="placeholder-demo" role="img" aria-label="Demonstration media not included in this design prototype">${icon('photo')}</div>${paragraph(e?.custom ? 'No demonstration is available for this custom exercise.' : 'Demonstration media is not included in this local design study. The real app retains its existing exercise images.')}`, button('Back to workout', 'close', ''));
    case 'plan-none': return dialogShell("Today's Plan", `<h3>Review today's workout</h3>${paragraph('Use your check-in and the planned session to review possible adjustments.')}${paragraph('This prototype demonstrates the flow with synthetic advice only.', 'mock-disclaimer')}`, actions('Review workout', 'review-plan'));
    case 'disclosure': return dialogShell("AI-assisted Today's Plan", `${paragraph('In Lastrep, relevant recovery, nutrition, health summaries, planned workout, recent performance and any context you provide may be sent to OpenAI to produce guidance.')}${paragraph('Your email, nickname and profile photo are not intentionally included.')}${paragraph('This prototype sends nothing. Recommendations here are layout examples, not medical or training advice.', 'mock-disclaimer')}`, actions('Continue', 'accept-disclosure', 'Not now', 'close'));
    case 'plan-busy': return dialogShell("Today's Plan", '<div class="busy-row"><span class="spinner" aria-hidden="true"></span><h3>Reviewing your workout...</h3></div>' + paragraph('Keep your session open. No changes have been applied.'), button('Reviewing...', 'noop', 'primary', {}, true));
    case 'plan-ok': return dialogShell("Today's Plan", `<h3>Train as planned</h3>${paragraph('No changes to the planned working sets in this example.')}${button(s.why ? 'Hide explanation' : 'Why these suggestions?', 'toggle-why')}${s.why ? paragraph('This fixture represents a review with no additional constraint requiring an adjustment. Actual recommendations must use the real records, not this example.') : ''}${button("Edit today's inputs", 'open', 'text', { modal: 'context' })}`, button('Back to workout', 'close', 'primary'));
    case 'plan-changes': return dialogShell("Today's Plan", `<h3>${adjustmentCount() ? `Reduce ${adjustmentCount()} affected exercises` : 'No remaining working-set changes'}</h3>${guidanceBody()}${button(s.why ? 'Hide explanation' : 'Why these suggestions?', 'toggle-why')}${s.why ? `<div class="row-note">${paragraph('These pressing movements overlap the wrist/hand discomfort in this example. Completed sets stay unchanged. The remaining sets use the available weight increment.')}${paragraph('This is synthetic guidance to demonstrate the interface, not a clinical assessment.', 'mock-disclaimer')}</div>` : ''}${s.pain !== 'None' ? paragraph('Stop any movement that causes sharp, worsening or unusual pain.', 'warning') : ''}${button("Edit today's inputs", 'open', 'text', { modal: 'context' })}`, button('Apply changes', 'apply-plan', 'primary', {}, !adjustmentCount()));
    case 'plan-stale': return dialogShell("Today's Plan", `<h3>Workout or context changed</h3>${paragraph('Update the review before applying changes. Your workout has not been altered.')}${button("Edit today's inputs", 'open', 'text', { modal: 'context' })}`, actions("Update today's plan", 'generate-plan'));
    case 'plan-applied': return dialogShell("Today's Plan", `<h3>Changes applied</h3>${paragraph('The remaining working-set loads were updated. Completed and warmup sets were kept.')} ${s.planAfter === JSON.stringify(s.exercises) ? button('Undo changes', 'undo-plan', '') : paragraph('Undo is unavailable because you edited the workout after applying changes.')}`, button('Back to workout', 'close', 'primary'));
    case 'plan-error': return dialogShell("Today's Plan", `<h3>Couldn't review this workout</h3>${paragraph('Your workout is unchanged. Try again, or continue logging.')}`, actions('Try again', 'generate-plan'));
    case 'context': return dialogShell("Today's inputs", `${['soreness', 'fatigue', 'motivation'].map(k => `<label class="field"><span class="rating-label"><span>${k[0].toUpperCase() + k.slice(1)}</span><output id="rating-${k}">${s.ratings[k]}/10</output></span><input type="range" min="0" max="10" step="1" value="${s.ratings[k]}" data-rating="${k}"></label>`).join('')}<h3>Pain or discomfort</h3>${paragraph('Illustrative body-area choices. This prototype does not assess injuries.', 'mock-disclaimer')}${chips(['None', 'Neck', 'Shoulder', 'Elbow', 'Wrist / hand', 'Upper back', 'Lower back', 'Hip / groin', 'Knee', 'Ankle / foot', 'Other'], s.pain, 'pain')}${field('Additional activity', 'activity', s.activity, 'e.g. Travel, hiking, physical work')}${field('Daily note', 'dailyNote', s.note, 'Anything relevant to today')}${paragraph('All context is optional. No information leaves this browser.', 'mock-disclaimer')}`, button('Save check-in', 'save-context', 'primary'));
    case 'history': return dialogShell(escape(e?.name ?? 'Bench press'), historyContent(e));
    case 'history-empty': return dialogShell(escape(e?.name ?? 'Cable fly'), `<h3>No recorded sessions yet</h3>${paragraph('Complete and save working sets to see exercise history and progress. No weight will be invented for this exercise.')}`, button('Back to workout', 'close', 'primary'));
    case 'finish': case 'saving': case 'save-error': return dialogShell('Finish workout', `<h3>${escape(s.title || 'Workout')}</h3>${paragraph('Thu, Oct 15, 2026')}<div class="stats"><div><strong>${sum.completed} / ${sum.total}</strong><span>sets marked complete</span></div><div><strong>${Number(sum.volumeKg.toFixed(2))} kg</strong><span>completed weighted volume</span></div></div>${sum.completed < sum.total ? paragraph('Some sets are unfinished. Return to the workout if you want to finish logging them.') : ''}<h3>Followed recommendation?</h3>${chips(['Yes', 'Partial', 'No'], s.followed, 'followed')}<h3>Helpful?</h3>${chips(['Yes', 'Neutral', 'No'], s.helpful, 'helpful')}${s.modal === 'save-error' ? paragraph('Save failed. Your draft is kept. Try again or return to the workout.', 'danger') : ''}`, button(s.modal === 'saving' ? 'Saving...' : s.modal === 'save-error' ? 'Try again' : s.builder ? 'Save routine' : 'Save workout', 'save', 'primary', {}, s.modal === 'saving') + button('Back to workout', 'close', '', {}, s.modal === 'saving'));
    case 'saved': return dialogShell(s.builder ? 'Routine saved' : 'Workout saved', `${paragraph(`${escape(s.title)} is saved in this mock flow.`)}${paragraph('No real account data was written.', 'mock-disclaimer')}`, button('Continue', 'after-saved', 'primary'), true);
    case 'routine-update': return dialogShell('Update routine?', paragraph(`Your workout is saved. Also update the ${escape(s.source || 'Chest + Triceps')} routine with this session's structure?`), button('Update routine', 'update-routine', 'primary') + button('Keep routine unchanged', 'skip-update', ''), true);
    case 'routine-updated': return dialogShell('Routine updated', paragraph('Your workout was saved first. The source routine was then updated in this mock flow.'), button('Done', 'complete-flow', 'primary'), true);
    case 'deload-saved': return dialogShell('Workout saved', paragraph('Deload session saved. The original routine stays unchanged.'), button('Done', 'complete-flow', 'primary'), true);
    case 'discard': return dialogShell('Discard workout?', paragraph('Remove this unsaved workout draft? Previously saved records are not affected.'), button('Keep workout', 'close', 'primary') + '<button class="btn danger" data-action="confirm-discard">Discard workout</button>', true);
    case 'session-options': return dialogShell('Session options', `${button('Save as routine', 'open', '', { modal: 'create-routine' })}${button('Choose another routine', 'open', '', { modal: 'routines' })}<button class="btn danger" data-action="open" data-modal="discard">Discard workout</button>`);
    default: return '';
  }
}

function frame(reference = false) {
  const key = reference || s.keyboard;
  const search = !reference && s.page === 'search', custom = !reference && s.page === 'custom';
  const title = search ? 'Add exercise' : custom ? 'Custom exercise' : s.builder ? 'Routine builder' : 'Workout';
  const main = search ? searchPage() : custom ? customPage() : s.exercises.length ? sessionHeader() + s.exercises.map(exercise).join('') + `<div class="section-stack">${button('+ Add exercise', 'search', '')}<div class="session-actions">${button('Save as routine', 'open', 'text', { modal: 'create-routine' })}${button('Session options', 'open', 'text', { modal: 'session-options' })}</div></div>` : empty();
  return `<div class="frame-wrap"><h3>${reference ? 'Approved / Reps editing' : escape(states.find(v => v[1] === chosen)?.[2] ?? 'Workout')}</h3><section class="device ${theme ? 'dark' : ''} ${large ? 'large-text' : ''} ${reference ? 'reference' : 'interactive'}" style="--width:${size[0]}px;--height:${size[1]}px" ${reference ? 'inert' : ''} aria-label="${reference ? 'Approved static editing reference' : 'Interactive Workout prototype'}"><div class="system-bar" aria-hidden="true"><span>9:41</span><span>LTE&nbsp;&nbsp; 92%</span></div><header class="toolbar"><div><h2>${title}</h2>${search || custom ? '<button class="icon-button close" data-action="back-search" aria-label="Close exercise picker">×</button>' : s.exercises.length ? button(s.builder ? 'Save routine' : 'Finish', 'open', 'primary', { modal: 'finish' }) : ''}</div></header><div class="viewport" tabindex="0" aria-label="Scrollable workout"><div class="page-content">${main}</div></div>${search ? `<footer class="search-footer"><span class="supporting">${s.selected.length} selected</span>${button(`Add (${s.selected.length})`, 'add-selected', 'primary', {}, !s.selected.length)}</footer>` : custom ? `<footer class="search-footer">${button('Cancel', 'back-search')}${button('Create exercise', 'save-custom', 'primary')}</footer>` : !key && s.rest ? restDock() : ''}${key ? keyboard(!reference && (search || custom || s.keyboardAlpha)) : tabs()}${!reference && s.modal ? modal() : ''}${!reference && s.toast ? `<div class="toast" role="status"><span>${escape(s.toast)}</span><button data-action="dismiss-toast" aria-label="Dismiss message">×</button></div>` : ''}</section><p class="frame-caption">${reference ? 'Approved editing reference. Interact with the screen on the left.' : `${size[0]} × ${size[1]} / ${theme ? 'Dark' : 'Paper'} / ${large ? '200%' : '100%'} text. Synthetic records only.`}</p></div>`;
}

function focusSet(id, index, field, scroll = true) {
  const el = $(`.interactive input[data-set="${id}"][data-index="${index}"][data-field="${field}"]`);
  if (!el) return;
  el.focus({ preventScroll: true }); el.setSelectionRange(el.value.length, el.value.length);
  if (scroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function render(preserve = true) {
  const active = document.activeElement, pos = preserve && active && $('.interactive')?.contains(active) && (!s.modal || active.closest('.sheet')) ? { set: active.dataset.set, index: active.dataset.index, field: active.dataset.field, draft: active.dataset.draft, query: active.hasAttribute('data-query'), start: active.selectionStart, end: active.selectionEnd } : null;
  const y = $('.interactive .viewport')?.scrollTop ?? 0, dy = $('.interactive .sheet-body')?.scrollTop ?? 0;
  const oldChart = $('.interactive .chart-scroll');
  const chartPosition = oldChart && { left: oldChart.scrollLeft, width: oldChart.clientWidth, content: oldChart.scrollWidth, selected: oldChart.querySelector('.point.selected')?.getAttribute('cx') };
  $('#stage').innerHTML = frame() + (compare && !s.modal && s.page === 'workout' && size[0] === 390 && !large ? frame(true) : '');
  document.querySelectorAll('.device').forEach(el => el.classList.toggle('short-window', size[1] < 500));
  const state = states.find(v => v[1] === chosen); $('#state-title').textContent = state?.[2] ?? 'Workout'; $('#state-description').textContent = state?.[3] ?? '';
  const view = $('.interactive .viewport'); view.scrollTop = s.demoScroll ?? (preserve ? y : 0); s.demoScroll = null;
  const ref = $('.reference .viewport'); if (ref) ref.scrollTop = 136;
  const sheet = $('.interactive .sheet-body'); if (sheet) sheet.scrollTop = preserve ? dy : 0;
  const chart = $('.interactive .chart-scroll'), point = chart?.querySelector('.point.selected');
  if (chart && point) {
    if (preserve && chartPosition && chartPosition.width === chart.clientWidth && chartPosition.content === chart.scrollWidth && chartPosition.selected === point.getAttribute('cx')) chart.scrollLeft = chartPosition.left;
    else {
      const bounds = chart.getBoundingClientRect(), dot = point.getBoundingClientRect();
      chart.scrollLeft = chart.scrollLeft + dot.left + dot.width / 2 - bounds.left - chart.clientWidth / 2;
    }
  }
  if (pos) { const q = pos.set ? `input[data-set="${pos.set}"][data-index="${pos.index}"][data-field="${pos.field}"]` : pos.draft ? `[data-draft="${pos.draft}"]` : pos.query ? '[data-query]' : ''; const target = q && $(q, $('.interactive')); if (target) { target.focus({ preventScroll: true }); if (typeof pos.start === 'number') target.setSelectionRange(pos.start, pos.end); } }
  else if (s.modal) $('.interactive .sheet-head .close')?.focus({ preventScroll: true });
}

function openModal(name) { if (name === 'history') s.historyPoint = historySessions(getExercise()).length - 1; if (name === 'tempo') s.draft.tempo = getExercise()?.tempo ?? ''; s.keyboard = false; s.modal = name; render(false); }
function performSave() { const current = s; s.modal = 'saving'; render(); setTimeout(() => { if (s !== current || s.modal !== 'saving') return; s.modal = s.deload ? 'deload-saved' : 'saved'; render(false); }, 650); }
function generatePlan() { const current = s; s.disclosure = true; s.modal = 'plan-busy'; s.plan = 'busy'; render(false); setTimeout(() => { if (s !== current || s.modal !== 'plan-busy') return; s.plan = s.pain === 'None' || !adjustmentCount() ? 'ok' : 'changes'; s.modal = `plan-${s.plan}`; render(false); }, 650); }
function mutateWorkout() { if (s.plan && !['none', 'applied'].includes(s.plan)) s.plan = 'stale'; }
function validateInput(el) {
  const raw = el.value.trim(), value = Number(raw), field = el.dataset.field;
  let message = '';
  if (raw !== '') {
    if (!Number.isFinite(value) || value < 0) message = 'Enter a positive number.';
    else if (field === 'reps' && !Number.isInteger(value)) message = 'Use whole reps.';
    else if (field === 'rpe' && (scale === 'RPE' ? value < 6 || value > 10 : value > 4)) message = scale === 'RPE' ? 'Use RPE 6-10.' : 'Use RIR 0-4.';
  }
  el.setCustomValidity(message);
  el.setAttribute('aria-invalid', String(Boolean(message)));
  let hint = el.parentElement.querySelector('.field-error');
  if (message && !hint) { hint = document.createElement('span'); hint.className = 'field-error'; hint.id = `error-${el.dataset.set}-${el.dataset.index}-${field}`; hint.setAttribute('role', 'status'); el.parentElement.append(hint); }
  if (hint) { hint.textContent = message; el.setAttribute('aria-describedby', hint.id); }
  return !message;
}
function chooseRoutine(append = false) {
  const next = fixture(); next.forEach(e => { e.id += append ? `-${++serial}` : ''; e.sets.forEach(row => { row.done = false; row.rpe = ''; }); });
  s.exercises = append ? [...s.exercises, ...next] : next; s.title = s.pendingRoutine || 'Chest + Triceps'; s.source = s.title; s.modal = ''; s.plan = 'none'; s.planBefore = null; s.planAfter = null; render(false);
}

$('#stage').addEventListener('input', event => {
  const el = event.target;
  if (!el.closest('.interactive')) return;
  if (el.dataset.set) { el.setCustomValidity(''); el.removeAttribute('aria-invalid'); el.parentElement.querySelector('.field-error')?.remove(); el.removeAttribute('aria-describedby'); }
  if (el.dataset.set) { const e = getExercise(el.dataset.set), row = e.sets[Number(el.dataset.index)], k = el.dataset.field; row[k] = k === 'rpe' && scale === 'RIR' ? el.value === '' ? '' : String(10 - Number(el.value)) : el.value; mutateWorkout(); return; }
  if (el.hasAttribute('data-query')) { s.query = el.value; s.searchMode = 'ready'; render(); return; }
  if (el.dataset.rating) { s.ratings[el.dataset.rating] = Number(el.value); $(`#rating-${el.dataset.rating}`).value = `${el.value}/10`; return; }
  if (el.dataset.draft) {
    const name = el.dataset.draft; s.draft[name] = el.value;
    if (name.startsWith('note-')) getExercise(name.slice(5)).notes = el.value;
    if (name.startsWith('cardio-time-')) getExercise(name.slice(12)).time = el.value;
    if (name.startsWith('cardio-distance-')) getExercise(name.slice(16)).distance = el.value;
    if (name === 'activity') s.activity = el.value;
    if (name === 'dailyNote') s.note = el.value;
    if (name === 'routineQuery') render();
  }
});
let lastInput = null;
$('#stage').addEventListener('focusout', event => { if (event.target.matches('.interactive input[data-set]')) validateInput(event.target); });
$('#stage').addEventListener('focusin', event => {
  const el = event.target; if (!el.closest('.interactive') || el.tagName !== 'INPUT' || el.type === 'range') return;
  lastInput = el.dataset.set ? { set: el.dataset.set, index: el.dataset.index, field: el.dataset.field } : el.dataset.draft ? { draft: el.dataset.draft } : { query: true };
  if (s.modal) { requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' })); return; }
  const alpha = !el.dataset.set && !String(el.dataset.draft ?? '').startsWith('cardio-distance');
  if (!s.keyboard || s.keyboardAlpha !== alpha) {
    s.keyboard = true;
    s.keyboardAlpha = alpha;
    const device = el.closest('.interactive');
    device.querySelector('.bottom-tabs')?.remove();
    device.querySelector('.rest-dock')?.remove();
    device.querySelector('.keyboard')?.remove();
    device.insertAdjacentHTML('beforeend', keyboard(alpha));
  }
  requestAnimationFrame(() => { const q = lastInput?.set ? `input[data-set="${lastInput.set}"][data-index="${lastInput.index}"][data-field="${lastInput.field}"]` : lastInput?.draft ? `[data-draft="${lastInput.draft}"]` : '[data-query]'; $(q, $('.interactive'))?.scrollIntoView({ block: 'nearest' }); });
});
$('#stage').addEventListener('pointerdown', event => { if (event.target.closest('[data-action="key"]')) event.preventDefault(); });
$('#stage').addEventListener('click', async event => {
  const b = event.target.closest('[data-action]'); if (!b || b.disabled || !b.closest('.interactive')) return;
  const d = b.dataset, action = d.action;
  if (action === 'outside' && event.target !== b) return;
  const e = getExercise(d.id || s.selectedId);
  switch (action) {
    case 'open': {
      if (d.modal === 'finish') {
        const invalid = [...$('.interactive').querySelectorAll('input[data-set]')].filter(el => !validateInput(el));
        if (invalid.length) { invalid[0].focus(); invalid[0].scrollIntoView({ block: 'nearest' }); return; }
      }
      if (d.id) s.selectedId = d.id; openModal(d.modal); return;
    }
    case 'close': case 'outside': if (s.modal === 'saving') return; s.modal = ''; render(false); $('.interactive .toolbar .btn')?.focus({ preventScroll: true }); return;
    case 'hide-keyboard': s.keyboard = false; render(); $('.interactive .viewport')?.focus({ preventScroll: true }); return;
    case 'dismiss-toast': s.toast = ''; render(); return;
    case 'tab': if (d.value !== 'Workout') toast('This study covers Workout only. Other app destinations are not implemented.'); return;
    case 'search': s.page = 'search'; s.keyboard = false; s.modal = ''; s.query = ''; s.searchMode = 'ready'; s.selected = []; render(false); return;
    case 'back-search': if (s.page === 'custom') { s.page = 'search'; } else { s.page = 'workout'; } s.keyboard = false; render(false); return;
    case 'clear-search': s.query = ''; s.searchMode = 'ready'; render(); return;
    case 'retry-search': s.searchMode = 'ready'; render(); return;
    case 'toggle-exercise': s.selected = s.selected.includes(d.id) ? s.selected.filter(x => x !== d.id) : [...s.selected, d.id]; render(); return;
    case 'add-selected': for (const id of s.selected) { const ex = exerciseFromCatalog(id); ex.id += `-${++serial}`; s.exercises.push(ex); } s.page = 'workout'; s.keyboard = false; s.title ||= 'My workout'; s.plan = 'none'; render(false); return;
    case 'custom': s.page = 'custom'; s.draft.customName ||= s.query; s.keyboard = false; render(false); return;
    case 'save-custom': if (!s.draft.customName?.trim()) { s.draft.error = 'Enter an exercise name.'; render(); return; } s.exercises.push(exerciseFromCatalog(`custom-${++serial}`, s.draft.customName.trim())); s.page = 'workout'; s.title ||= 'My workout'; s.keyboard = false; s.draft.error = ''; render(false); return;
    case 'load-routine': s.pendingRoutine = d.value; if (s.exercises.length) openModal('replace-guard'); else chooseRoutine(); return;
    case 'confirm-routine': chooseRoutine(); return;
    case 'append-routine': chooseRoutine(true); return;
    case 'repeat': s.pendingRoutine = 'Chest + Triceps / Repeat'; if (s.exercises.length) openModal('replace-guard'); else chooseRoutine(); return;
    case 'deload': s.pendingRoutine = 'Chest + Triceps / Deload'; s.deload = true; chooseRoutine(); s.exercises = s.exercises.map(ex => ({ ...ex, sets: ex.sets.map(row => ({ ...row, weight: row.weight ? String(Number(row.weight) * .6) : '' })) })); render(); return;
    case 'build-routine': s.builder = true; s.title = s.draft.routineName || 'New routine'; s.exercises = []; s.modal = ''; render(false); return;
    case 'focus': s.focus = d.value; render(); return;
    case 'length': s.length = d.value; render(); return;
    case 'generate-workout': s.pendingRoutine = `${s.focus} / ${s.length} fixture`; if (s.exercises.length) openModal('replace-guard'); else chooseRoutine(); return;
    case 'exercise-menu': s.selectedId = d.id; openModal('exercise-menu'); return;
    case 'set-menu': s.selectedId = d.id; s.setIndex = Number(d.index); openModal('set-options'); return;
    case 'copy-last': { const p = e.previous[Number(d.index)]; if (p) { const row = e.sets[Number(d.index)]; Object.assign(row, { weight: p.weight, reps: p.reps, rpe: p.rpe }); mutateWorkout(); render(); } return; }
    case 'done': e.sets[Number(d.index)].done = !e.sets[Number(d.index)].done; mutateWorkout(); render(); return;
    case 'cardio-done': e.sets[0].done = !e.sets[0].done; render(); return;
    case 'add-set': e.sets.push({ weight: '', reps: '', rpe: '', done: false, type: 'normal' }); mutateWorkout(); render(); return;
    case 'duplicate-set': { const row = e.sets.at(-1); if (row) e.sets.push({ ...row, done: false, type: 'normal' }); mutateWorkout(); render(); return; }
    case 'delete-set': { const index = s.setIndex; const row = getExercise().sets.splice(index, 1)[0]; s.undoSet = { id: s.selectedId, index, row }; s.modal = ''; mutateWorkout(); render(); return; }
    case 'undo-set': { const u = s.undoSet; getExercise(u.id)?.sets.splice(u.index, 0, u.row); s.undoSet = null; render(); return; }
    case 'set-type': getExercise().sets[s.setIndex].type = ({ Normal: 'normal', 'Warm-up': 'warmup', Failure: 'failure', Drop: 'drop' })[d.value]; s.modal = ''; mutateWorkout(); render(); return;
    case 'percentage': { const row = getExercise().sets[s.setIndex]; if (row.weight) row.weight = String(Number((Number(row.weight) * (1 + Number(d.value.replace('%', '')) / 100)).toFixed(2))); s.modal = ''; mutateWorkout(); render(); return; }
    case 'move': s.exercises = moveExercise(s.exercises, s.selectedId, Number(d.direction)); mutateWorkout(); render(); return;
    case 'unit': s.exercises = s.exercises.map(ex => ex.id === s.selectedId ? setUnit(ex, d.value) : ex); mutateWorkout(); render(); return;
    case 'delete-exercise': s.exercises = s.exercises.filter(ex => ex.id !== s.selectedId); s.modal = ''; mutateWorkout(); render(); return;
    case 'replace-exercise': { const ex = getExercise(); ex.name = b.textContent.trim(); ex.previous = []; ex.sets = [{ weight: '', reps: '', rpe: '', done: false, type: 'normal' }]; s.modal = ''; mutateWorkout(); render(); return; }
    case 'demo': s.selectedId = d.id; openModal('demo'); return;
    case 'history': s.selectedId = d.id; openModal(e?.previous.length ? 'history' : 'history-empty'); return;
    case 'history-point': s.historyPoint = Number(d.value); render(); return;
    case 'rest-detail': s.selectedId = d.id; openModal('rest-detail'); return;
    case 'rest-preset': { const [m, sec] = d.value.split(':').map(Number); getExercise().rest = m * 60 + sec; s.rest = { exercise: getExercise().name, remaining: m * 60 + sec, deadline: null }; render(); return; }
    case 'start-rest': s.rest = { exercise: getExercise()?.name ?? 'Bench press', remaining: getExercise()?.rest ?? 120, deadline: Date.now() + (getExercise()?.rest ?? 120) * 1000 }; s.modal = ''; render(); return;
    case 'pause-rest': if (s.rest) { if (s.rest.deadline) { s.rest.remaining = remaining(); s.rest.deadline = null; } else s.rest.deadline = Date.now() + s.rest.remaining * 1000; render(); } return;
    case 'custom-rest': { const value = Number(s.draft.restDuration); if (!Number.isFinite(value) || value <= 0 || value > 3600) { toast('Enter a duration between 1 and 3600 seconds.'); return; } getExercise().rest = value; s.rest = { remaining: value, deadline: null, exercise: getExercise().name }; render(); return; }
    case 'skip-rest': s.rest = null; s.modal = ''; render(); return;
    case 'session-time': openModal('session-time'); return;
    case 'pause-session': if (s.clockStart && s.clockStart !== 'paused') { s.elapsed += Math.floor((Date.now() - s.clockStart) / 1000); s.clockStart = 'paused'; } else s.clockStart = Date.now(); render(); return;
    case 'apply-time': { const value = Number(s.draft.sessionMinutes); if (!Number.isFinite(value) || value < 0) { toast('Enter elapsed minutes of zero or more.'); return; } s.elapsed = Math.round(value * 60); if (s.clockStart && s.clockStart !== 'paused') s.clockStart = Date.now(); s.modal = ''; render(); return; }
    case 'save-weights': { const value = Number(s.draft.increment ?? s.step); if (!Number.isFinite(value) || value <= 0) { s.draft.error = 'Enter an increment greater than zero.'; render(); return; } s.step = value; s.draft.error = ''; s.modal = ''; if (s.plan === 'changes') s.plan = 'stale'; render(); return; }
    case 'clear-weights': s.step = 2.5; s.draft.increment = ''; s.modal = ''; render(); return;
    case 'apply-tempo': getExercise().tempo = s.draft.tempo?.trim() || '';  s.modal = ''; toast('Tempo saved in this mock session.'); return;
    case 'cardio-toggle': e[d.field] = e[d.field] === d.value ? '' : d.value; render(); return;
    case 'review-plan': if (!s.disclosure) openModal('disclosure'); else if (s.plan === 'applied') openModal('plan-applied'); else generatePlan(); return;
    case 'accept-disclosure': case 'generate-plan': generatePlan(); return;
    case 'toggle-why': s.why = !s.why; render(); return;
    case 'pain': s.pain = d.value; render(); return;
    case 'save-context': s.modal = ''; s.plan = s.plan === 'none' ? 'none' : 'stale'; render(); return;
    case 'apply-plan': s.planBefore = copy(s.exercises); s.exercises = guidanceChanges(s.exercises, s.step); s.planAfter = JSON.stringify(s.exercises); s.plan = 'applied'; s.modal = ''; render(); return;
    case 'undo-plan': if (s.planAfter === JSON.stringify(s.exercises)) { s.exercises = copy(s.planBefore); s.planAfter = null; s.plan = 'changes'; s.modal = ''; render(); } return;
    case 'followed': s.followed = d.value; render(); return;
    case 'helpful': s.helpful = d.value; render(); return;
    case 'save': performSave(); return;
    case 'after-saved': s.modal = s.source && !s.deload && !s.builder ? 'routine-update' : ''; render(false); return;
    case 'update-routine': s.modal = 'routine-updated'; render(false); return;
    case 'skip-update': case 'complete-flow': s.modal = ''; toast('Mock flow complete. No account records were changed.'); return;
    case 'confirm-discard': s = makeState('empty'); render(false); return;
    case 'key': {
      if (d.key === 'Done') { s.keyboard = false; render(); return; }
      const q = lastInput?.set ? `input[data-set="${lastInput.set}"][data-index="${lastInput.index}"][data-field="${lastInput.field}"]` : lastInput?.draft ? `[data-draft="${lastInput.draft}"]` : '[data-query]';
      const target = $(q, $('.interactive')); if (!target) return;
      if (d.key === 'Next') { const list = [...$('.interactive').querySelectorAll('input[data-set]')]; list[(list.indexOf(target) + 1) % list.length]?.focus(); return; }
      const start = target.selectionStart ?? target.value.length, end = target.selectionEnd ?? start;
      if (d.key === 'Backspace') target.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end'); else target.setRangeText(d.key, start, end, 'end');
      target.dispatchEvent(new Event('input', { bubbles: true })); target.focus({ preventScroll: true }); return;
    }
    default: return;
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (s.modal && s.modal !== 'saving') { s.modal = ''; render(false); } else if (s.keyboard) { s.keyboard = false; render(); } return; }
  if (['Enter', ' '].includes(event.key) && event.target.matches('circle.hit')) { event.preventDefault(); s.historyPoint = Number(event.target.dataset.value); render(); }
  if (event.key !== 'Tab' || !s.modal) return;
  const list = [...$('.interactive .sheet').querySelectorAll('button:not(:disabled),input,textarea,[tabindex="0"]')];
  if (!list.length) return;
  if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list.at(-1).focus(); }
  if (!event.shiftKey && document.activeElement === list.at(-1)) { event.preventDefault(); list[0].focus(); }
});

let lastGroup = '', optionHTML = '';
for (const [group, id, name] of states) { if (group !== lastGroup) { if (lastGroup) optionHTML += '</optgroup>'; optionHTML += `<optgroup label="${escape(group)}">`; lastGroup = group; } optionHTML += `<option value="${id}">${escape(name)}</option>`; }
$('#example').innerHTML = optionHTML + '</optgroup>';
$('#example').addEventListener('change', e => loadExample(e.target.value));
$('#viewport').addEventListener('change', e => { size = e.target.value.split(',').map(Number); render(); if (s.keyboard && lastInput?.set) requestAnimationFrame(() => focusSet(lastInput.set, lastInput.index, lastInput.field)); });
$('#dark').addEventListener('change', e => { theme = e.target.checked; render(); });
$('#large').addEventListener('change', e => { large = e.target.checked; render(); });
$('#compare').addEventListener('change', e => { compare = e.target.checked; render(); });
$('#effort').addEventListener('change', e => { scale = e.target.value; render(); });
$('#reset').addEventListener('click', () => loadExample(chosen));
setInterval(() => {
  if (!s) return;
  document.querySelectorAll('[data-clock="rest"]').forEach(el => { el.textContent = time(remaining()); });
  if (s.rest?.deadline && remaining() === 0) { s.rest = { ...s.rest, deadline: null, remaining: 0 }; render(); }
  if (s.clockStart && s.clockStart !== 'paused') document.querySelectorAll('[data-clock="session"]').forEach(el => { el.textContent = time(s.elapsed + Math.floor((Date.now() - s.clockStart) / 1000)); });
}, 500);
loadExample(location.hash.slice(1) && states.some(x => x[1] === location.hash.slice(1)) ? location.hash.slice(1) : 'active');
