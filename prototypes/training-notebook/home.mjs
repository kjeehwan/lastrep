import { workoutDraft, workoutDetails } from './home-workout-details.mjs';
import './input-behavior.mjs';
import { demoAvatar } from './notebook-avatar.mjs';
import { readNotebookPreferences, writeNotebookPreferences } from './notebook-preferences.mjs';
import { setReviewState } from './review-state-picker.mjs';
import { readCheckIn, writeCheckIn, clearCheckIn, checkInFields } from './check-in.mjs';
import { TODAY, trendObservationDate, metrics, homeStates, homeFixture, observations, selectedObservation, displayValue, valuesForDate, phaseWeeks, changePhase, phaseOnDate, readiness, saveMeasurement, calendarCells } from './home-model.mjs';

const $ = q => document.querySelector(q);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paths = {
  calendar: '<rect x="4" y="5" width="16" height="16" rx="1"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/>',
  settings: '<path d="M4 6h5M13 6h7M4 12h10M18 12h2M4 18h2M10 18h10"/><circle cx="11" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', down: '<path d="m7 10 5 5 5-5"/>',
  left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>', heart: '<path d="M12 21 4 13C-3 5 7 0 12 7c5-7 15-2 8 6Z"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
  workout: '<path d="M2 12h20" stroke-width="1.5"/><path d="M7 5v14M17 5v14M4 9v6M20 9v6" stroke-width="2.1"/>',
  nutrition: '<path d="M12 7C4 2 1 10 5 17c2 5 5 4 7 3 2 1 5 2 7-3 4-7 1-15-7-10ZM12 7c0-4 3-5 6-5"/>',
  sleep: '<path d="M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z"/>',
  profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-9 16-9 16 0Z"/>',
};
const icon = name => `<svg class="icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.right}</svg>`;
const btn = (text, action, kind = 'text', data = '') => `<button type="button" class="btn ${kind}" data-action="${action}" ${data}>${text}</button>`;
const p = (text, kind = 'supporting') => `<p class="${kind}">${text}</p>`;
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
let s, example = 'returning', size = [390, 844], dark = false, large = false, toastTimer;

function choose(value, useShared = false) {
  setReviewState(document.querySelector('#example'), homeStates.map(([id, title]) => [id, title]), value);
  example = value; s = homeFixture(value); dark = value === 'dark'; large = value === 'large';
  const shared = useShared ? readCheckIn() : null; if (!useShared) clearCheckIn(); if (shared) Object.assign(s, shared);
  $('#example').value = value; $('#dark').checked = dark; $('#large').checked = large; $('#unit').value = 'kg';
  if (useShared) applySharedPreferences();
  render(false);
}
function applySharedPreferences() { const prefs = readNotebookPreferences(); const p = prefs?.profile; if (p?.training) s.training = structuredClone(p.training); if (p?.diet) s.diet = structuredClone(p.diet); if (p?.phaseHistory) s.phaseHistory = structuredClone(p.phaseHistory); s.profileName = p?.name ?? 'Daniel'; s.profilePhoto = p?.photo ?? false; if (prefs?.health) { const h = prefs.health; s.connected = h.available && h.consent && (h.sleep || h.body); } }
function logo() {
  // Preserve the existing production wordmark and gradient; the notebook study is not a rebrand.
  return '<svg class="home-logo" viewBox="0 0 132 41" role="img" aria-label="Lastrep"><defs><linearGradient id="home-brand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a90e2"/><stop offset="1" stop-color="#7b61ff"/></linearGradient></defs><text x="0" y="31" font-family="sans-serif" font-size="36" font-weight="bold" fill="url(#home-brand)">lastrep</text></svg>';
}
function heading(title, action = '') { return `<div class="home-section-heading"><h3>${title}</h3>${action}</div>`; }
function phaseButton(kind, label) {
  const phase = s[kind], week = phaseWeeks(phase.since);
  return `<button class="phase-selector" data-action="open" data-modal="${kind}" aria-label="Change ${label.toLowerCase()} phase"><span class="home-eyebrow">${label}</span><strong>${esc(phase.phase)}${icon('down')}</strong><small>${week ? `Week ${week}` : 'Start date not recorded'}</small></button>`;
}
function nextWorkout() {
  if (!s.hasWorkouts && !s.dismissedWelcome) return `<section class="home-panel panel-outline">${heading('Get started', '<button class="icon-button close" data-action="dismiss-welcome" aria-label="Dismiss Get started">×</button>')}${p('Start your first workout or build a routine to use again.')}<div class="section-stack first-workout-actions">${btn('Start workout', 'workout', 'primary')}${btn('Create routine', 'builder')}</div></section>`;
  return `<section class="next-workout" aria-label="Next workout"><span class="home-eyebrow">${s.planned ? 'Your workout' : 'Your next session'}</span><h2>${s.planned ? 'Chest + Triceps' : 'Start a workout'}</h2>${p(s.planned ? `4 exercises · 11 working sets${s.started ? ' · 1 set complete' : ''}` : "Choose a routine or build today's workout.")}${btn(s.planned && s.started ? 'Continue workout ' + icon('arrow') : 'Start workout ' + icon('arrow'), 'workout', 'primary')}</section>`;
}
function contextActions() {
  if (s.mealLogged && s.connected) return '';
  return `<section class="home-panel panel-outline">${heading("Complete today's picture")}${!s.mealLogged ? `<button class="context-action" data-action="meal">${icon('nutrition')}<span><strong>Log a meal</strong><small>No nutrition recorded today</small></span>${icon('right')}</button>` : ''}${!s.connected ? `<button class="context-action" data-action="health">${icon('heart')}<span><strong>Connect health data</strong><small>Optional sleep and body-data sync</small></span>${icon('right')}</button>` : ''}</section>`;
}
function bodyChart(rows, selected) {
  const width = Math.max(330, (rows.length - 1) * 64 + 64), scale = large ? 2 : 1;
  const values = rows.map(r => r[s.metric]), lo = Math.min(...values), range = Math.max(1, Math.max(...values) - lo);
  const points = rows.map((r, i) => ({ ...r, x: rows.length === 1 ? width / 2 : 32 + i * 64, y: 92 - (r[s.metric] - lo) / range * 64 }));
  return `<div class="body-chart-scroll" role="region" tabindex="0" aria-label="${metrics.find(m => m[0] === s.metric)[1]} history, scroll to earlier measurements"><svg class="body-chart" style="width:${width * scale}px" viewBox="0 0 ${width} 140" role="group" aria-label="Recorded measurements"><path class="axis" d="M16 104H${width - 16}"/>${points.length > 1 ? `<polyline class="trend" points="${points.map(r => `${r.x},${r.y}`).join(' ')}"/>` : ''}${points.map((r, i) => `<circle class="point ${r.date === selected.date ? 'selected' : ''}" cx="${r.x}" cy="${r.y}" r="4"/><circle class="point-hit" cx="${r.x}" cy="${r.y}" r="22" tabindex="0" role="button" aria-pressed="${r.date === selected.date}" aria-label="${dateLabel(r.date)}, ${displayValue(r[s.metric], s.metric, s.unit)} ${s.metric === 'bodyFat' ? 'percent' : s.unit}" data-action="select-point" data-date="${r.date}"/><text x="${r.x}" y="128" text-anchor="middle">${!i || r.date.slice(0, 7) !== rows[i - 1].date.slice(0, 7) ? shortDate(r.date) : Number(r.date.slice(-2))}</text>`).join('')}</svg></div>`;
}
function progress() {
  const rows = observations(s.records, s.metric), selected = selectedObservation(s);
  return `<section class="home-panel" id="home-progress">${heading('Progress', btn('+ Add/edit', 'measurement'))}<div class="metric-tabs" aria-label="Body measurement type">${metrics.map(([key, label]) => `<button class="metric-tab ${s.metric === key ? 'selected' : ''}" aria-pressed="${s.metric === key}" data-action="metric" data-key="${key}">${label}</button>`).join('')}</div>${selected ? `<div class="selected-measurement"><strong>${displayValue(selected[s.metric], s.metric, s.unit)}<small>${s.metric === 'bodyFat' ? '%' : s.unit}</small></strong><span class="supporting">${shortDate(selected.date)}${selected.date === rows.at(-1).date ? ' · Latest' : ''}</span></div>${bodyChart(rows, selected)}${p(selected.source + (rows.length > 1 ? ' · Recorded observations, equally spaced' : ' · One recorded observation'), 'chart-hint')}${!s.connected ? p('Saved account data · Sync not connected', 'chart-hint') : ''}` : `<div class="empty-records"><h4>No ${s.metric === 'weight' ? 'weight' : metrics.find(m => m[0] === s.metric)[1].toLowerCase()} measurements yet</h4>${p('Add a measurement when you have one. No daily entry needed.')}</div>`}</section>`;
}
function recovery() {
  const score = readiness(s);
  return `<section class="home-panel panel-outline">${heading('Readiness', '<button class="icon-button" data-action="open" data-modal="readiness" aria-label="About readiness">?</button>')}${score == null ? `<div class="empty-records"><h4>Not enough information yet</h4>${p('Sleep and a recovery check-in help complete this summary.')}</div>` : `<div class="readiness-head"><strong>${score}%</strong><span>${score >= 75 ? 'Ready' : score >= 50 ? 'Neutral' : 'Recover'}</span></div>${p('A summary of your recovery inputs, not a workout prescription.')}`}<div class="readiness-inputs">${[['Sleep', s.sleep == null ? '—' : `${s.sleep} h`], ['Soreness', s.ratings.soreness === '' ? '—' : `${s.ratings.soreness}/10`], ['Fatigue', s.ratings.fatigue === '' ? '—' : `${s.ratings.fatigue}/10`], ['Motivation', s.ratings.motivation === '' ? '—' : `${s.ratings.motivation}/10`]].map(([label, value]) => `<button data-action="${label === 'Sleep' ? 'sleep' : 'open'}" ${label !== 'Sleep' ? 'data-modal="check-in"' : ''}><span>${label}</span><strong>${value}</strong></button>`).join('')}</div>${btn('Edit recovery check-in', 'open', 'text', 'data-modal="check-in"')}</section>`;
}
const weeklyRows = [
  ['Workouts', '2', 'This week · 1 fewer than last week'],
  ['Avg. session volume', '6,004 kg', 'This week · 9% lower than last week'],
  ['Avg. logged calories', '2,480 kcal', 'Logged days this week · 120 kcal higher'],
  ['Avg. sleep', '6.7 h', 'Recorded nights this week · 0.3 h lower'],
];
const weekSessions = {
  current: [['2026-10-12', 'Chest + Triceps', 3247], ['2026-10-14', 'Posterior legs', 8760]],
  previous: [['2026-10-06', 'Back + Biceps', 8000], ['2026-10-08', 'Chest + Triceps', 3247], ['2026-10-10', 'Anterior legs', 8600]],
};
function contributionGrid() {
  const days = Array.from({ length: 28 }, (_, i) => new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10));
  const sessions = [['2026-10-01', 'Chest + Triceps', 3247], ['2026-10-04', 'Posterior legs', 8760], ...weekSessions.current, ...weekSessions.previous];
  const selected = sessions.find(row => row[0] === (s.trendDate ?? '2026-10-14'));
  return `<h3>Training distribution</h3>${p('Sep 21–Oct 18 · Columns are weeks, Monday to Sunday.', 'chart-hint')}<div class="contribution-wrap"><div class="contribution-labels"><span></span>${['Sep 21', 'Sep 28', 'Oct 5', 'Oct 12'].map(label => `<span>${label}</span>`).join('')}</div><div class="contribution-body"><div class="contribution-weekdays" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(label => `<span>${label}</span>`).join('')}</div><div class="contribution-grid">${days.map(date => {
    const session = sessions.find(row => row[0] === date), level = session ? session[2] < 4000 ? 1 : session[2] < 8500 ? 2 : 3 : 0;
    return `<button class="contribution-cell" data-action="contribution" data-date="${date}" data-level="${level}" aria-label="${dateLabel(date)}, ${session ? `${session[1]}, ${Math.round(Number(displayValue(session[2], 'weight', s.unit)))} ${s.unit} volume` : date > TODAY ? 'future date' : 'no workout recorded'}" aria-pressed="${date === (s.trendDate ?? '2026-10-14')}" ${date > TODAY ? 'disabled' : ''}></button>`;
  }).join('')}</div></div></div>${p('Darker = more recorded volume; not a score of workout quality.', 'chart-hint')}<div class="row-note">${p(`${shortDate(s.trendDate ?? '2026-10-14')} · ${selected ? `${selected[1]} · ${Math.round(Number(displayValue(selected[2], 'weight', s.unit))).toLocaleString('en-US')} ${s.unit} volume` : 'No workouts logged.'}`)}</div>`;
}
function trendDetail() {
  if (!s.hasWorkouts) return dialog(esc(s.trend), p('No records yet.'), btn('Done', 'close', 'primary'));
  const workouts = s.trend === 'Workouts', volume = s.trend === 'Avg. session volume';
  const calories = s.trend === 'Avg. logged calories';
  const number = n => Math.round(Number(displayValue(n, 'weight', s.unit))).toLocaleString('en-US');
  const columns = ['current', 'previous'].map(kind => {
    const sessions = weekSessions[kind], current = kind === 'current';
    const values = calories ? current ? [2520, 2440] : [2300, 2420] : current ? [7, 6.4] : [7.2, 6.8];
    const total = workouts ? `${sessions.length} sessions` : volume ? `${number(sessions.reduce((sum, r) => sum + r[2], 0) / sessions.length)} ${s.unit}` : `${(values.reduce((a, b) => a + b, 0) / values.length).toLocaleString('en-US')} ${calories ? 'kcal' : 'h'}`;
    return `<div class="week-column"><h3>${current ? 'This week' : 'Last week'}</h3>${p(current ? 'Oct 12–15 · In progress' : 'Oct 5–11 · Full week', 'chart-hint')}<strong class="week-total">${total}</strong>${(workouts || volume ? sessions.map(([date, name, kg]) => `<div class="week-session"><small>${shortDate(date)}</small><strong>${name}</strong>${volume ? p(`${number(kg)} ${s.unit}`, 'chart-hint') : ''}</div>`) : values.map((value, i) => `<div class="week-session"><small>${shortDate(trendObservationDate(current, i))}</small><strong>${value.toLocaleString('en-US')} ${calories ? 'kcal' : 'h'}</strong></div>`)).join('')}</div>`;
  }).join('');
  return dialog(esc(s.trend), `${p(workouts ? 'Completed sessions. This week is still in progress; a lower count is not automatically worse.' : volume ? 'Average volume per recorded resistance workout. Different exercises and workout lengths affect this value.' : calories ? 'Average of logged days, not a measure of your full intake when logging is incomplete.' : 'Average of recorded nights. Missing nights are not zeros.')}<div class="week-comparison">${columns}</div>${volume ? contributionGrid() : ''}${p('Synthetic examples for design review.', 'chart-hint')}`, btn('Done', 'close', 'primary'));
}
function weekly() {
  return `<section class="home-panel">${heading('Weekly Trends')}<div class="weekly-list">${weeklyRows.map(([label, value, hint]) => `<button class="weekly-item" data-action="weekly" data-key="${label}"><span>${label}<small>${s.hasWorkouts ? hint : 'No records yet'}</small></span><strong>${s.hasWorkouts ? (label === 'Avg. session volume' && s.unit === 'lbs' ? '13,235 lbs' : value) : '—'}</strong>${icon('right')}</button>`).join('')}</div></section>`;
}
function homePage() {
  if (s.loading) return `<div role="status" aria-label="Loading your account"><div class="skeleton short"></div><div class="skeleton tall"></div><section class="home-panel">${heading('Progress')}<div class="skeleton tall"></div></section><section class="home-panel">${heading('Readiness')}<div class="skeleton tall"></div></section></div>`;
  return `<div class="home-page-heading"><div><span class="home-eyebrow">Thursday, October 15</span><h1 class="editorial">Your daily record.</h1></div></div>${s.refreshFailed ? `<div class="refresh-notice" role="status">${p("Couldn't refresh. Showing saved records.")}${btn('Retry', 'retry')}</div>` : ''}<div class="phase-pair">${phaseButton('training', 'Training')}${phaseButton('diet', 'Diet')}</div>${nextWorkout()}${contextActions()}${progress()}${recovery()}${weekly()}`;
}
function dialog(title, body, footer = '') {
  return `<div class="overlay" data-action="outside"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="home-dialog-title"><header class="sheet-head"><h2 id="home-dialog-title">${title}</h2><button class="icon-button close" data-action="close" aria-label="Close dialog">×</button></header><div class="sheet-body">${body}</div>${footer ? `<footer class="sheet-footer">${footer}</footer>` : ''}</section></div>`;
}
function calendar() {
  const title = new Date(`${s.calendarMonth}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return dialog('Calendar', `<div class="calendar-toolbar"><button class="icon-button" data-action="month" data-step="-1" aria-label="Previous month">${icon('left')}</button><h3>${title}</h3><button class="icon-button" data-action="month" data-step="1" aria-label="Next month">${icon('right')}</button></div><div class="calendar-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => `<span class="calendar-weekday" aria-label="${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}">${label}</span>`).join('')}${calendarCells(s.calendarMonth).map(date => date ? `<button class="calendar-day ${date === TODAY ? 'today' : ''} ${date === s.calendarDate ? 'selected' : ''} ${s.workouts.some(w => w.date === date) ? 'recorded' : ''}" data-action="day" data-date="${date}" aria-label="${dateLabel(date)}${date === TODAY ? ', today' : ''}, ${s.workouts.some(w => w.date === date) ? 'workout recorded' : 'no workout recorded'}">${Number(date.slice(-2))}</button>` : '<span></span>').join('')}</div><div class="calendar-footer">${btn('Today', 'calendar-today')}${p('● Workout recorded', 'chart-hint')}</div>`);
}
function dayDetails() {
  const dayWorkouts = s.workouts.filter(w => w.date === s.calendarDate);
  const title = dayWorkouts[0]?.title;
  const priorTraining = phaseOnDate(s, 'training', s.calendarDate);
  const priorDiet = phaseOnDate(s, 'diet', s.calendarDate);
  const kg = value => displayValue(value, 'weight', s.unit);
  const chest = [['Bench press', `3 sets · ${kg(105)} ${s.unit} × 3 @ 10`], ['Incline dumbbell press', '3 sets · Mixed loads and reps'], ['Cable fly', `2 sets · ${kg(20)} ${s.unit} × 12`], ['Tricep pushdown', `3 sets · ${kg(35)} ${s.unit} × 10`]];
  const workoutRows = dayWorkouts.map(workout => {
    const title = workout.title;
    const exercises = title === 'Chest + Triceps' ? chest : title === 'Posterior legs' ? [['Seated leg curl', '3 sets · 12 reps'], ['Romanian deadlift', '3 sets · 8 reps'], ['Standing calf raise', '3 sets · 15 reps']] : title === 'Anterior legs' ? [['Leg press', '3 sets · 10 reps'], ['Leg extension', '3 sets · 12 reps'], ['Standing calf raise', '3 sets · 15 reps']] : [['Chest-supported row', '3 sets · 10 reps'], ['Lat pulldown', '3 sets · 12 reps'], ['Dumbbell curl', '3 sets · 10 reps']];
    const duration = workout.durationMin == null ? 'Duration not recorded' : `${Math.floor(workout.durationMin / 60)} h ${workout.durationMin % 60} min`;
    return `<section class="saved-workout"><div class="saved-workout-heading"><h3>${esc(title)}</h3>${btn('Edit details', 'workout-edit', 'text', `data-id="${workout.id}" aria-label="Edit details for ${esc(title)}"`)}</div>${p(`${duration} · ${title === 'Chest + Triceps' ? '11' : '9'} sets`, 'chart-hint')}${exercises.map(([name, detail]) => `<div class="day-exercise"><h4>${name}</h4>${p(detail)}</div>`).join('')}</section>`;
  }).join('');
  return dialog(title ? 'Workout Day' : 'Rest Day', `${s.workoutSaved ? '<p class="workout-saved" role="status">' + icon('check') + 'Workout details updated</p>' : ''}${p(dateLabel(s.calendarDate))}<div class="day-phases"><span>Training<strong>${priorTraining}</strong></span><span>Diet<strong>${priorDiet}</strong></span></div>${title ? workoutRows : p('No workouts logged.')}`, btn('Back to calendar', 'calendar', 'primary'));
}
function selectedWorkout() { return s.workouts.find(w => w.id === s.editWorkoutId); }
function workoutDirty() {
  try { const next = workoutDetails(s.workoutDraft, TODAY), old = selectedWorkout(); return next.date !== old.date || next.durationMin !== old.durationMin; }
  catch { return true; }
}
function workoutEditor() {
  const workout = selectedWorkout(), draft = s.workoutDraft;
  return dialog('Edit workout details', `<div class="workout-editor-intro"><h3>${esc(workout.title)}</h3>${p('Update this saved workout.', 'chart-hint')}</div><div class="workout-date-field"><span id="workout-date-label">Workout date</span><button class="workout-date-button" data-action="workout-date" aria-labelledby="workout-date-label workout-date-value"><span id="workout-date-value">${dateLabel(draft.date)}</span>${icon('calendar')}</button></div><fieldset class="workout-duration"><legend>Duration</legend><div class="workout-duration-fields">${['hours', 'minutes'].map(key => `<label for="workout-${key}"><input id="workout-${key}" data-workout-field="${key}" value="${esc(draft[key])}" inputmode="numeric" maxlength="2" placeholder="—" aria-describedby="workout-duration-hint workout-edit-error"><span>${key === 'hours' ? 'Hours' : 'Minutes'}</span></label>`).join('<span class="workout-duration-colon" aria-hidden="true">:</span>')}</div><p id="workout-duration-hint" class="chart-hint">${workout.durationMin == null ? 'No duration was recorded. Leave both fields blank to keep it that way.' : 'Tap a number to edit the duration.'}</p></fieldset><p id="workout-edit-error" class="form-error" role="alert">${esc(s.workoutError || '')}</p>`, btn(s.workoutError?.startsWith("Couldn't") ? 'Try again' : 'Save changes', 'workout-save', 'primary', workoutDirty() ? '' : 'disabled') + btn('Cancel', 'close'));
}
function workoutDatePicker() {
  const month = new Date(`${s.workoutMonth}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return dialog('Workout date', `<div class="calendar-toolbar"><button class="icon-button" data-action="workout-month" data-step="-1" aria-label="Previous month">${icon('left')}</button><h3>${month}</h3><button class="icon-button" data-action="workout-month" data-step="1" aria-label="Next month">${icon('right')}</button></div><div class="calendar-grid">${['M','T','W','T','F','S','S'].map(d => `<span class="calendar-weekday">${d}</span>`).join('')}${calendarCells(s.workoutMonth).map(date => date ? `<button class="calendar-day ${date === s.workoutDraft.date ? 'selected' : ''}" data-action="workout-pick-date" data-date="${date}" aria-label="${dateLabel(date)}" aria-pressed="${date === s.workoutDraft.date}" ${date > TODAY ? 'disabled' : ''}>${Number(date.slice(-2))}</button>` : '<span></span>').join('')}</div>`, btn('Cancel', 'close'));
}

function measurement() {
  const date = s.mode === 'edit' ? s.editDate : TODAY;
  return dialog('Body composition data', `<div class="measurement-mode"><button class="${s.mode === 'add' ? 'selected' : ''}" data-action="measurement-mode" data-mode="add" aria-pressed="${s.mode === 'add'}">Add today<small>${shortDate(TODAY)}</small></button>${s.editDate ? `<button class="${s.mode === 'edit' ? 'selected' : ''}" data-action="measurement-mode" data-mode="edit" aria-pressed="${s.mode === 'edit'}">Edit ${shortDate(s.editDate)}<small>Recorded data</small></button>` : ''}</div>${p(`${s.mode === 'edit' ? 'Editing' : 'Adding for'} ${dateLabel(date)}`)}<div>${metrics.map(([key, label, unit]) => {
    const last = observations(s.records, key).at(-1), fallback = ({ weight: 80.15, bodyFat: 18.5, leanMass: 65.3, skeletalMuscle: 34.2 })[key];
    const placeholder = `e.g. ${displayValue(last?.[key] ?? fallback, key, s.unit)}`;
    const fullLabel = key === 'leanMass' ? 'Lean body mass' : key === 'skeletalMuscle' ? 'Skeletal muscle mass' : label;
    return `<div class="measurement-line"><div class="measurement-label"><label for="measure-${key}">${fullLabel}</label>${['leanMass', 'skeletalMuscle'].includes(key) ? `<button class="help" data-action="definition" data-key="${key}" aria-label="About ${fullLabel}" aria-expanded="${s.definition === key}"><span>?</span></button>` : '<span class="help-slot" aria-hidden="true"></span>'}</div><input id="measure-${key}" data-measure="${key}" inputmode="decimal" value="${esc(s.form[key] ?? '')}" placeholder="${placeholder}" aria-label="${fullLabel}" aria-describedby="measurement-message"><span class="unit">${unit === '%' ? '%' : s.unit}</span></div>${s.definition === key ? p(key === 'leanMass' ? 'Everything other than body fat, including muscle, bone, organs and water.' : 'Muscle attached to bones that produces movement. It is only part of lean body mass.', 'definition') : ''}`;

  }).join('')}</div><p id="measurement-message" class="${s.error ? 'form-error' : 'chart-hint'}" role="${s.error ? 'alert' : 'note'}">${esc(s.error || 'Blank fields are not recorded. All changes in this prototype are temporary.')}</p>${s.mode === 'edit' ? btn('Delete data for ' + shortDate(date), 'open', 'text danger', 'data-modal="delete"') : ''}`, btn('Save data', 'save-measurement', 'primary') + btn('Cancel', 'close'));
}
function phaseDialog(kind) {
  return dialog(kind === 'training' ? 'Training phase' : 'Diet phase', `${p('Current: ' + s[kind].phase + (phaseWeeks(s[kind].since) ? ` · Week ${phaseWeeks(s[kind].since)}` : ''))}${p('Changing phase starts week 1 today. Home and Profile use the same selection.')}<div>${(kind === 'training' ? ['Hypertrophy', 'Strength', 'Power'] : ['Cut', 'Maintain', 'Bulk']).map(phase => `<button class="phase-option" data-action="phase" data-kind="${kind}" data-value="${phase}" aria-pressed="${s[kind].phase === phase}">${phase}${s[kind].phase === phase ? icon('check') : ''}</button>`).join('')}</div>`, btn('Cancel', 'close'));
}
function checkIn() {
  const draft = s.checkInDraft ?? { ratings: s.ratings, pain: s.pain ?? 'None', activity: s.activity ?? '', note: s.note ?? '' };
  return dialog('Recovery check-in', checkInFields(draft), btn('Save check-in', 'save-check-in', 'primary') + btn('Cancel', 'close'));
}

function modal() {
  switch (s.modal) {
    case 'calendar': return calendar();
    case 'day': return dayDetails();
    case 'workout-edit': return workoutEditor();
    case 'workout-date': return workoutDatePicker();
    case 'training': case 'diet': return phaseDialog(s.modal);
    case 'measurement': return measurement();
    case 'delete': return dialog('Delete body data?', `${p(`Delete all body measurements saved for ${dateLabel(s.editDate)} in this mock session?`)}${p('This does not delete records from a connected health service.')}`, btn('Delete data', 'delete-measurement', 'danger') + btn('Keep data', 'keep-data', 'primary'));
    case 'check-in': return checkIn();
    case 'readiness': return dialog('About readiness', `${p('This summary combines sleep (30%), soreness (30%), fatigue (30%) and motivation (10%). Lower soreness and fatigue raise the score.')}${p('Ready: 75% or higher. Neutral: 50–74%. Recover: below 50%. Missing inputs do not become zeros.')}${p('This is a fitness summary, not medical clearance or a promise of performance. Review your actual workout in Today’s Plan on Workout.')}`, btn('Done', 'close', 'primary'));
    case 'weekly': return trendDetail();
    case 'profile': return dialog('Profile', `<div class="profile-identity"><div class="profile-portrait" role="img" aria-label="Profile photo fallback: Daniel's initial">D</div><strong class="profile-name">Daniel</strong>${p('Training for steady progress, one session at a time.')}${p('Premium', 'chart-hint')}</div>${heading('Current phases')}<div class="phase-pair">${phaseButton('training', 'Training')}${phaseButton('diet', 'Diet')}</div>${p('The initial is the fallback for a missing profile photo. The description is user-provided profile text, not private recovery notes.', 'chart-hint')}`, btn('Back to Home', 'close', 'primary'));
    case 'health': return dialog('Health sync', `${p(s.connected ? 'Connected on this mock device.' : 'Not connected on this mock device.')}${p('Saved account records remain visible when sync is disconnected. Connecting is optional and requires the existing consent and permission flow in the real app.')}${p('This preview cannot grant permissions or read health data.', 'chart-hint')}`, btn('Back to Home', 'close', 'primary'));
    case 'meal': return dialog('Log a meal', `${p('The Nutrition study has its own food diary fixture. Open it to review logging, or mark a meal logged in this Home fixture to review the conditional action disappearing.')}`, '<a class="btn primary" href="./nutrition.html">Review Nutrition study</a>' + btn('Mark meal logged in Home mock', 'meal-logged') + btn('Back', 'close'));
    case 'sleep': return dialog('Sleep', `${p(s.sleep == null ? 'No saved sleep data.' : 'Saved sleep · Oct 15, 2026 · 6.7 h')}${p(s.connected ? 'Sync connected on this mock device.' : 'Sync not connected. This saved account record remains available.')}${p('The Sleep study uses its own illustrative records.', 'chart-hint')}`, '<a class="btn primary" href="./sleep.html">Review Sleep study</a>' + btn('Back', 'close'));
    case 'settings': return dialog('Settings', p('Settings is outside this Home mockup. Existing subscription, legal and preference flows are retained for native implementation.'), btn('Back to Home', 'close', 'primary'));
    default: return '';
  }
}
function tabs() {
  return `<nav class="bottom-tabs" aria-label="App destinations">${['Home', 'Workout', 'Nutrition', 'Sleep', 'Profile'].map(name => ['Workout', 'Nutrition', 'Sleep'].includes(name) ? `<a class="tab home-tab-link" href="${name === 'Workout' ? './' : name === 'Nutrition' ? './nutrition.html' : './sleep.html'}">${icon(name.toLowerCase())}${name}</a>` : `<button class="tab ${name === 'Home' ? 'active' : ''}" ${name === 'Home' ? 'aria-current="page"' : ''} data-action="${name.toLowerCase()}">${icon(name.toLowerCase())}${name}</button>`).join('')}</nav>`;
}
function render(preserve = true) {
  const old = $('.home-device .viewport'), scroll = old?.scrollTop ?? 0;
  const sheetScroll = $('.home-device .sheet-body')?.scrollTop ?? 0;
  const oldChart = $('.body-chart-scroll'), chartState = oldChart && { left: oldChart.scrollLeft, width: oldChart.scrollWidth, viewport: oldChart.clientWidth, selection: oldChart.querySelector('.point.selected')?.getAttribute('cx') };
  const active = document.activeElement, focused = active?.dataset?.measure ? { key: active.dataset.measure, start: active.selectionStart, end: active.selectionEnd } : null;
  $('#state-title').textContent = homeStates.find(row => row[0] === example)?.[1] ?? 'Home';
  $('#state-description').textContent = homeStates.find(row => row[0] === example)?.[2] ?? '';
  $('#stage').innerHTML = `<div class="frame-wrap"><h3>Home / ${s.hasWorkouts ? esc(s.profileName ?? 'Daniel') : 'First session'}</h3><section class="device home-device ${dark ? 'dark' : ''} ${large ? 'large-text' : ''}" style="--width:${size[0]}px;--height:${size[1]}px" aria-label="Interactive Home prototype"><div class="system-bar" aria-hidden="true"><span>9:41</span><span>LTE&nbsp;&nbsp;92%</span></div><header class="home-header">${logo()}<div class="home-header-actions"><button class="icon-button" data-action="calendar" aria-label="Open calendar">${icon('calendar')}</button><button class="icon-button" data-action="open" data-modal="settings" aria-label="Open Settings">${icon('settings')}</button><button class="avatar" data-action="open" data-modal="profile" aria-label="Open profile">${s.profilePhoto ? demoAvatar() : esc((s.profileName ?? 'Daniel')[0])}</button></div></header><div class="viewport" tabindex="0" aria-label="Scrollable Home"><div class="page-content">${homePage()}</div></div>${tabs()}${s.modal ? modal() : ''}${s.toast ? `<div class="toast" role="status"><span>${esc(s.toast)}</span><button data-action="dismiss-toast" aria-label="Dismiss notification">×</button></div>` : ''}</section><p class="frame-caption">${size.join(' × ')} / ${dark ? 'Dark' : 'Paper'} / ${large ? '200%' : '100%'} text. Synthetic data only.</p></div>`;
  $('.home-device .viewport').scrollTop = preserve ? scroll : 0;
  const sheet = $('.home-device .sheet-body'); if (sheet) sheet.scrollTop = preserve ? sheetScroll : 0;
  const chart = $('.body-chart-scroll'), dot = chart?.querySelector('.point.selected');
  if (chart && dot) {
    if (preserve && chartState && chartState.width === chart.scrollWidth && chartState.viewport === chart.clientWidth && chartState.selection === dot.getAttribute('cx')) chart.scrollLeft = chartState.left;
    else { const r = dot.getBoundingClientRect(), c = chart.getBoundingClientRect(); chart.scrollLeft += r.left + r.width / 2 - c.left - chart.clientWidth / 2; }
  }
  if (preserve && focused) { const input = $(`[data-measure="${focused.key}"]`); input?.focus({ preventScroll: true }); input?.setSelectionRange(focused.start, focused.end); }
  else if (s.modal) $('.sheet-head .close')?.focus({ preventScroll: true });
}
function notify(message) { s.toast = message; clearTimeout(toastTimer); render(); toastTimer = setTimeout(() => { s.toast = ''; render(); }, 4500); }
function open(modalName) { s.error = ''; s.modal = modalName; if (modalName === 'check-in') s.checkInDraft = structuredClone({ ratings: s.ratings, pain: s.pain ?? 'None', activity: s.activity ?? '', note: s.note ?? '' }); render(false); }
function close() { s.modal = s.modal === 'workout-date' ? 'workout-edit' : s.modal === 'workout-edit' ? 'day' : s.modal === 'day' ? 'calendar' : s.modal === 'delete' ? 'measurement' : ''; s.error = ''; render(false); }
function beginMeasurement() { const selected = selectedObservation(s); s.editDate = selected?.date ?? null; s.mode = 'add'; s.form = {}; s.addDraft = {}; s.editDraft = valuesForDate(s.records, s.editDate, s.unit); s.definition = ''; open('measurement'); }

$('#stage').addEventListener('input', event => {
  const el = event.target;
  if (el.dataset.workoutField) {
    s.workoutDraft[el.dataset.workoutField] = el.value;
    const save = $('[data-action="workout-save"]'); if (save) save.disabled = !workoutDirty();
  }
  if (el.dataset.measure) { s.form[el.dataset.measure] = el.value; s.error = ''; }
  if (el.dataset.rating) { s.checkInDraft ??= structuredClone({ ratings: s.ratings, pain: s.pain ?? 'None', activity: s.activity ?? '', note: s.note ?? '' }); s.checkInDraft.ratings[el.dataset.rating] = Number(el.value); document.querySelector('#rating-' + el.dataset.rating).textContent = el.value + '/10'; el.setAttribute('aria-valuetext', el.value + ' out of 10'); }
  if (el.dataset.draft && s.checkInDraft) s.checkInDraft[el.dataset.draft === 'dailyNote' ? 'note' : el.dataset.draft] = el.value;
});
$('#stage').addEventListener('click', event => {
  const el = event.target.closest('[data-action]'); if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'outside': if (event.target === el) close(); return;
    case 'open': if (d.modal === 'profile' || d.modal === 'settings') { location.href = `./${d.modal}.html`; return; } open(d.modal); return;
    case 'close': close(); return;
    case 'home': s.modal = ''; $('.home-device .viewport').scrollTop = 0; return;
    case 'workout': window.location.href = s.planned ? './#active' : './#empty'; return;
    case 'builder': window.location.href = './#empty'; return;
    case 'nutrition': case 'meal': open('meal'); return;
    case 'profile': location.href = './profile.html'; return;
    case 'health': location.href = './profile.html#health'; return;
    case 'sleep': open(d.action); return;
    case 'meal-logged': s.mealLogged = true; s.modal = ''; notify('Meal marked logged in this mock session.'); return;
    case 'dismiss-welcome': s.dismissedWelcome = true; render(); return;
    case 'dismiss-toast': s.toast = ''; render(); return;
    case 'retry': s.refreshFailed = false; notify('Mock refresh complete. Records are unchanged.'); return;
    case 'metric': s.metric = d.key; s.selected = observations(s.records, s.metric).at(-1)?.date ?? null; render(); return;
    case 'select-point': s.selected = d.date; render(); return;
    case 'measurement': beginMeasurement(); return;
    case 'measurement-mode':
      if (s.mode === 'add') s.addDraft = { ...s.form }; else s.editDraft = { ...s.form };
      s.mode = d.mode; s.form = { ...(d.mode === 'add' ? s.addDraft : s.editDraft) }; s.error = ''; render(); return;
    case 'definition': s.definition = s.definition === d.key ? '' : d.key; render(); return;
    case 'save-measurement':
      try { saveMeasurement(s); s.modal = ''; notify('Body data saved in this mock session.'); }
      catch (error) { s.error = error.message; render(); } return;
    case 'keep-data': s.modal = 'measurement'; render(false); return;
    case 'delete-measurement': s.records = s.records.filter(row => row.date !== s.editDate); s.selected = observations(s.records, s.metric).at(-1)?.date ?? null; s.modal = ''; notify('Selected date removed from this mock session.'); return;
    case 'phase': changePhase(s, d.kind, d.value); writeNotebookPreferences({ profile: { training: s.training, diet: s.diet, phaseHistory: s.phaseHistory } }); s.modal = ''; notify('Phase updated in this mock Home and Profile.'); return;
    case 'workout-edit': s.editWorkoutId = d.id; s.workoutDraft = workoutDraft(selectedWorkout()); s.workoutError = ''; s.workoutSaved = false; s.modal = 'workout-edit'; render(false); return;
    case 'workout-date': s.workoutMonth = s.workoutDraft.date.slice(0, 7); s.modal = 'workout-date'; render(false); return;
    case 'workout-month': { const date = new Date(`${s.workoutMonth}-01T12:00:00`); date.setMonth(date.getMonth() + Number(d.step)); s.workoutMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; render(false); return; }
    case 'workout-pick-date': s.workoutDraft.date = d.date; s.workoutError = ''; s.modal = 'workout-edit'; render(false); return;
    case 'workout-save': {
      try {
        const changes = workoutDetails(s.workoutDraft, TODAY);
        Object.assign(selectedWorkout(), changes); s.calendarDate = changes.date; s.calendarMonth = changes.date.slice(0, 7);
        s.workoutSaved = true; s.modal = 'day'; s.workoutError = ''; render(false);
      } catch (error) { s.workoutError = error.message; render(); }
      return;
    }
    case 'calendar': s.modal = 'calendar'; render(false); return;
    case 'calendar-today': s.calendarMonth = TODAY.slice(0, 7); s.calendarDate = TODAY; render(false); return;
    case 'month': { const date = new Date(`${s.calendarMonth}-01T12:00:00`); date.setMonth(date.getMonth() + Number(d.step)); s.calendarMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; render(false); return; }
    case 'day': s.workoutSaved = false; s.calendarDate = d.date; s.modal = 'day'; render(false); return;
    case 'pain': s.checkInDraft ??= structuredClone({ ratings: s.ratings, pain: s.pain ?? 'None', activity: s.activity ?? '', note: s.note ?? '' }); s.checkInDraft.pain = d.value; render(); return;
    case 'save-check-in': {
      const ratings = s.checkInDraft?.ratings ?? s.ratings;
      if (Object.values(ratings).some(v => v !== '' && (!Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 10))) { s.error = 'Use whole numbers from 0 to 10, or leave a rating blank.'; render(); return; }
      Object.assign(s, s.checkInDraft ?? { ratings }); writeCheckIn(s); s.modal = ''; notify('Recovery check-in saved in this mock session.'); return;
    }
    case 'contribution': s.trendDate = d.date; render(); return;
    case 'weekly': s.trend = d.key; open('weekly'); return;
    default: return;
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && s.modal) { close(); return; }
  if (['Enter', ' '].includes(event.key) && event.target.matches('.point-hit')) { event.preventDefault(); s.selected = event.target.dataset.date; render(); return; }
  if (event.key !== 'Tab' || !s.modal) return;
  const items = [...document.querySelectorAll('.sheet button,.sheet input,.sheet [tabindex="0"]')].filter(el => !el.disabled);
  const index = items.indexOf(document.activeElement);
  if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
  else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0]?.focus(); }
});
$('#example').innerHTML = homeStates.map(([id, title]) => `<option value="${id}">${title}</option>`).join('');
$('#example').addEventListener('change', event => choose(event.target.value));
$('#viewport').addEventListener('change', event => { size = event.target.value.split(',').map(Number); render(); });
$('#dark').addEventListener('change', event => { dark = event.target.checked; render(); });
$('#large').addEventListener('change', event => { large = event.target.checked; render(); });
$('#unit').addEventListener('change', event => { s.unit = event.target.value; s.modal = ''; render(); });
$('#reset').addEventListener('click', () => choose(example));
const initial = window.location.hash.slice(1);
choose(homeStates.some(row => row[0] === initial) ? initial : 'returning', true);

window.addEventListener('pageshow', event => { if (event.persisted) { const shared = readCheckIn(); if (shared) { Object.assign(s, shared); render(); } } });

window.addEventListener('pageshow', event => { if (event.persisted) { applySharedPreferences(); render(); } });
