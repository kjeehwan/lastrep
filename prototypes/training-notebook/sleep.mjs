import './input-behavior.mjs';
import { readNotebookPreferences, writeNotebookPreferences } from './notebook-preferences.mjs';
import { rebuildSleepDays, sessionsForDate, importSleepSessions, mockWearableSessions, excludeSleepSession, sleepConflicts } from './sleep-sessions.mjs';
import { SLEEP_DAY, sleepStates, sleepFixture, selectedSleep, sleepWindow, weeklySleep, durationText, targetDelta, shiftSleepDate, saveSleep, timeMinutes, minutesTime, sleepInterval, inferSleepDates, saveSleepTarget } from './sleep-model.mjs';
import { calendarCells } from './home-model.mjs';
import { notebookIcon as icon } from './notebook-icons.mjs';
import { setReviewState } from './review-state-picker.mjs';

const $ = query => document.querySelector(query);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateText = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const p = (text, cls = 'supporting') => `<p class="${cls}">${text}</p>`;
const btn = (text, action, cls = 'text', attrs = '', disabled = false) => `<button class="btn ${cls}" data-action="${action}" ${attrs} ${disabled ? 'disabled' : ''}>${text}</button>`;
const heading = (title, action = '') => `<div class="sleep-section-head"><h3>${title}</h3>${action}</div>`;
let s, example = 'overview', size = [390, 844], dark = false, large = false, syncTimer, toastTimer;
function choose(id) {
  clearTimeout(syncTimer); clearTimeout(toastTimer);
  example = id; s = sleepFixture(id); if (id === 'overview') { const prefs = readNotebookPreferences(); if (prefs?.profile?.sleepTarget) s.target = Number(prefs.profile.sleepTarget); if (prefs?.health) { const h = prefs.health; s.connection = !h.available ? 'unavailable' : !h.consent ? 'disconnected' : !h.sleep ? 'permission' : 'connected'; } } inferSleepDates(s); dark = id === 'dark'; large = id === 'large';
  $('#dark').checked = dark; $('#large').checked = large;
  setReviewState($('#example'), sleepStates.map(([id, title]) => [id, title]), id); render(false);
}
function durationMarkup(hours) {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}<small> h </small>${String(minutes % 60).padStart(2, '0')}<small> min</small>`;
}
function dates() {
  return `<div class="sleep-date"><button class="icon-button" data-action="day" data-step="-1" aria-label="Previous date">${icon('left')}</button><button class="selected-date" data-action="calendar">${s.selected === SLEEP_DAY ? 'Today · ' : ''}${dateText(s.selected)}${icon('down')}</button><button class="icon-button" data-action="day" data-step="1" aria-label="Next date" ${s.selected >= SLEEP_DAY ? 'disabled' : ''}>${icon('right')}</button></div>`;
}
const sourceLabel = source => ({ health: 'Health Connect', manual: 'Manual entry', mixed: 'Manual + Health Connect' })[source] ?? 'Saved data';
function sessionTime(row) {
  return row.bedtime ? `${dateText(row.bedDate).replace(', 2026', '')}, ${row.bedtime} → ${dateText(row.wakeDate).replace(', 2026', '')}, ${row.wakeTime}` : row.kind === 'legacy-total' ? 'Saved daily total · times unavailable' : 'Duration only · times unavailable';
}
function sessionList() {
  const rows = sessionsForDate(s), excluded = sessionsForDate(s, s.selected, true);
  if (!rows.length && !excluded.length) return '';
  const item = row => `<button class="sleep-session-row" data-action="session" data-id="${esc(row.id)}"><span>${esc(sessionTime(row))}</span><strong>${durationText(row.hours)}</strong><small>${esc(row.originLabel ?? sourceLabel(row.source))}${row.excluded ? ' · Excluded from totals' : row.needsReview ? ' · Needs review' : ''}</small></button>`;
  return `<section class="sleep-section">${heading('Sleep entries')}${selectedSleep(s)?.needsReview ? `<div class="sleep-notice">${p('Some entries may describe the same sleep. Overlapping time is counted only once. Entries with unknown times are not added to timed entries until reviewed.')}</div>` : ''}${rows.map(item).join('')}${excluded.length ? btn(s.showExcluded ? 'Hide excluded entries' : `View excluded entries (${excluded.length})`, 'show-excluded') : ''}${s.showExcluded ? excluded.map(item).join('') : ''}</section>`;
}
function sessionDialog() {
  const row = s.sessions.find(row => row.id === s.detailId);
  if (!row) return dialog('Entry unavailable', p('This sleep entry is no longer available.'), btn('Close', 'close'));
  return dialog(row.kind === 'legacy-total' ? 'Saved daily total' : 'Sleep session', `${p(esc(sessionTime(row)))}<p class="sleep-interval-preview">${durationText(row.hours)}</p>${p(esc(row.originLabel ?? sourceLabel(row.source)))}${row.kind === 'legacy-total' ? p('This older record contains only a daily total. Individual sessions cannot be reconstructed from it.') : ''}${row.needsReview ? p(`Only ${durationText(row.countedHours)} adds to this day’s total. Overlapping or unverified time is not added again.`) : ''}${row.source === 'health' ? p('Corrections and exclusions affect Lastrep only. The original record in your health service is unchanged.') : ''}<p class="sleep-error" role="alert">${esc(s.error)}</p>`, row.excluded ? btn('Restore entry', 'restore', 'primary') + btn('Close', 'close') : btn(row.source === 'health' ? 'Correct in Lastrep' : 'Edit session', 'edit-session', 'primary') + btn(row.source === 'health' ? 'Exclude from totals' : 'Delete entry', 'ask-exclude', 'danger') + btn('Close', 'close'));
}
function summary() {
  const row = selectedSleep(s);
  return `<section aria-label="Selected sleep record">${p('Total for ' + dateText(s.selected), 'sleep-kicker')}<div class="sleep-duration ${row ? '' : 'no-record'}">${row ? durationMarkup(row.hours) : 'Not recorded'}</div><div class="sleep-summary">${p(targetDelta(row?.hours ?? null, s.target))}${row ? p(`${sourceLabel(row.source)} · ${row.sessionCount ? `${row.sessionCount} ${row.sessionCount === 1 ? 'session' : 'sessions'} · ` : ''}Saved ${esc(row.saved)}`) : p('Add the duration yourself, or sync supported health data.')}<div class="sleep-target"><button class="sleep-target-edit" data-action="target" aria-label="Edit sleep target">Your target · ${durationText(s.target)}</button></div></div><div class="sleep-entry-action">${btn(row ? 'Add sleep session' : 'Record sleep', 'entry', row ? 'text' : 'primary')}</div></section>`;
}
function trend() {
  const values = weeklySleep(s), window = sleepWindow(s), max = Math.max(10, s.target + 1, ...s.records.map(row => row.hours));
  const period = `${dateText(shiftSleepDate(s.selected, -6)).replace(', 2026', '')}–${dateText(s.selected).replace(', 2026', '')}`;
  return `<section class="sleep-section">${heading('Daily sleep', btn(s.showHistory ? 'Hide records' : 'View records', 'history'))}<div class="sleep-chart-selection" aria-live="polite"><span>${dateText(s.selected)}</span><strong>${selectedSleep(s) ? durationText(selectedSleep(s).hours) : 'Not recorded'}</strong></div>${p(`Dashed line · your ${s.target} h target`)}${s.records.length ? `<div class="sleep-chart-wrap" tabindex="0" aria-label="Scrollable sleep chart; latest nights shown first on opening"><div class="sleep-chart" style="--target-y:${(1 - s.target / max) * 100}%">${window.map(({ date, record }, i) => `<button class="sleep-night" data-action="select-night" data-date="${date}" aria-pressed="${date === s.selected}" aria-label="${dateText(date)}: ${record ? durationText(record.hours) : 'Not recorded'}"><span class="sleep-plot">${record ? `<span class="sleep-bar" style="--bar-height:${record.hours / max * 100}%"></span>` : '<span class="sleep-gap"></span>'}</span><span class="sleep-night-date">${i === 0 || date.endsWith('-01') ? dateText(date).replace(', 2026', '') : Number(date.slice(-2))}</span></button>`).join('')}</div></div>${p('Tap a night to review it. Gaps mean no saved record.', 'sleep-chart-caption')}` : p('Your recorded nights will appear here. Missing nights are never counted as zero.')}<div class="sleep-week-summary"><div><strong>${values.average == null ? '—' : durationText(values.average)}</strong><span>Average · ${period}</span></div><div><strong>${values.count} of 7</strong><span>Days recorded</span></div></div>${p(values.count ? `${values.met} of ${values.count} recorded days met your target.${values.count < 7 ? ` ${7 - values.count} ${7 - values.count === 1 ? 'day has' : 'days have'} no entry.` : ''}` : 'Record a night to start a weekly comparison.')}${s.showHistory ? `<div class="sleep-records">${[...s.records].reverse().slice(0, s.historyCount).map(row => `<button class="sleep-history-row" data-action="record" data-date="${row.date}"><span>${dateText(row.date)}</span><strong>${durationText(row.hours)}</strong><small>${sourceLabel(row.source)}</small></button>`).join('') || p('No saved records yet.')}${s.records.length > s.historyCount ? btn(`View ${Math.min(5, s.records.length - s.historyCount)} more`, 'more-records') : ''}</div>` : ''}</section>`;
}
function connection() {
  const labels = { connected: 'Connected on this device', disconnected: 'Not connected on this device', permission: 'Sleep permission needed', unavailable: 'Health Connect needs setup', unsupported: 'Health sync is not supported on this device' };
  const messages = { connected: 'Sleep records can be read with your consent and device permission.', disconnected: 'Saved account records remain available. No new health data is read here.', permission: 'Sleep access was removed. Previously saved records remain available.', unavailable: 'Install or update Health Connect, connect your sleep-tracking app, then allow Lastrep to read sleep.', unsupported: 'You can still record sleep manually and view saved account data.' };
  return `<section class="sleep-section">${heading('Health sync')}${p(labels[s.connection])}${p(messages[s.connection])}<div class="sleep-data-line"><span>Last sync on this device</span><strong>${s.lastSync ? esc(s.lastSync) : 'Not synced'}</strong></div><div class="sleep-sync-actions">${s.connection === 'connected' ? btn(s.syncing ? 'Syncing…' : 'Sync sleep', 'sync', '', '', s.syncing || s.offline) : s.connection === 'unavailable' ? btn('Set up Health Connect', 'setup') : s.connection === 'unsupported' ? '' : btn(s.connection === 'disconnected' ? 'Connect health data' : 'Review health access', 'health')}${s.connection === 'connected' ? btn('Manage', 'health') : ''}</div>${s.syncing ? p('Simulated check in progress. Saved records stay visible.') : ''}</section>`;
}
function notices() {
  return `${s.offline ? `<div class="sleep-notice" role="status">${p('You’re offline. Showing saved records. Reconnect to sync; saving is unavailable in this offline example.')}</div>` : ''}${s.refreshError ? `<div class="sleep-notice" role="status">${p('Could not refresh sleep. Showing your saved records.')}${btn('Retry', 'refresh')}</div>` : ''}${s.notice ? `<div class="sleep-notice" role="status">${p(esc(s.notice))}${example === 'sync-error' ? btn('Try again', 'sync') : ''}</div>` : ''}${s.records.length && s.records.at(-1).date < SLEEP_DAY ? `<div class="sleep-notice">${p(`Latest saved night · ${dateText(s.records.at(-1).date)}. No record for today.`)}</div>` : ''}`;
}
function dialog(title, body, footer = '') {
  return `<div class="overlay" data-action="outside"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sleep-dialog-title"><header class="sheet-head"><h2 id="sleep-dialog-title">${title}</h2><button class="icon-button close" data-action="close" aria-label="Close dialog">×</button></header><div class="sheet-body">${body}</div>${footer ? `<footer class="sheet-footer">${footer}</footer>` : ''}</section></div>`;
}
function calendar() {
  const selected = s.modal === 'entry-date' ? s[s.dateField] : s.selected;
  const title = new Date(`${s.month}-01T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  return dialog(s.modal === 'entry-date' ? (s.dateField === 'bedDate' ? 'Bedtime date' : 'Wake date') : 'Sleep date', `<div class="sleep-calendar-head"><button class="icon-button" data-action="month" data-step="-1" aria-label="Previous month">${icon('left')}</button><h3>${title}</h3><button class="icon-button" data-action="month" data-step="1" aria-label="Next month">${icon('right')}</button></div><div class="sleep-calendar-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => `<span class="sleep-weekday">${day}</span>`).join('')}${calendarCells(s.month).map(date => date == null ? '<span></span>' : `<button class="sleep-calendar-day ${date === selected ? 'selected' : ''} ${date === SLEEP_DAY ? 'today' : ''} ${s.records.some(row => row.date === date) ? 'recorded' : ''}" data-action="date" data-date="${date}" aria-label="${dateText(date)}" aria-pressed="${date === selected}" ${date > SLEEP_DAY ? 'disabled' : ''}>${Number(date.slice(-2))}</button>`).join('')}</div>`, btn('Today', 'date', '', `data-date="${SLEEP_DAY}"`));
}
function modal() {
  switch (s.modal) {
    case 'session': return sessionDialog();
    case 'exclude': { const row = s.sessions.find(row => row.id === s.detailId); return dialog(row?.source === 'health' ? 'Exclude this entry?' : 'Delete this entry?', `${p(esc(row ? sessionTime(row) : ''))}${p('Only this entry is removed from Lastrep totals. Other sessions are kept. Imported records are not deleted from Health Connect.')}`, btn('Remove from totals', 'exclude', 'danger') + btn('Cancel', 'close')); }
    case 'overlap': return dialog('Review possible duplicate sleep', `${p('The new entry may describe sleep that is already recorded. Review the entries below before replacing them.')}${(s.conflictIds ?? []).map(id => s.sessions.find(row => row.id === id)).filter(Boolean).map(row => `<div class="sleep-conflict-row">${p(esc(sessionTime(row)))}${p(`${durationText(row.hours)} · ${esc(sourceLabel(row.source))}`)}</div>`).join('')}${p('Replacing excludes only the listed entries from Lastrep totals. Other sessions and the original health-service records are unchanged.')}`, btn('Replace listed entries', 'replace-conflicts', 'primary') + btn('Back to edit', 'back-to-entry'));
    case 'calendar': case 'entry-date': return calendar();
    case 'entry': return entryDialog();
    case 'sync-confirm': return dialog('Import sleep to this account?', `${p('Destination · demo@example.test')}${p('Import this device’s Health Connect sleep records into the signed-in account.')}${p('Design simulation only. No health access or upload occurs.')}`, btn('Import sleep', 'confirm-sync', 'primary') + btn('Simulate importing split sessions', 'import-split') + btn('Cancel', 'close'));
    case 'health': return dialog('Health sync / Profile', `${p('In the app, this action opens the Health sync section in Profile to review consent, device permissions and connection status.')}${p('This is a destination preview, not a permission request. Saved sleep records are unaffected.')}`, btn('Simulate connected access', 'simulate-connect', 'primary') + btn('Simulate disconnected access', 'simulate-disconnect') + btn('Back', 'close'));
    case 'setup': return dialog('Set up Health Connect', `<ol class="sleep-setup-steps"><li>Open Health Connect in your Android device settings. Install or update it if your supported device prompts you to.</li><li>In your sleep-tracking app, enable sharing sleep records with Health Connect.</li><li>Return to Lastrep → Profile → Health sync. Connect and allow Sleep access.</li></ol>${p('Health Connect availability depends on the device. If it is not supported, you can record sleep manually.')}${p('Prototype only: no settings or store app is opened.')}`, btn('Simulate setup complete', 'simulate-connect', 'primary') + btn('Back', 'close'));
    case 'target': return dialog('Sleep target', `<label class="sleep-field"><span>Daily target in hours</span><input inputmode="decimal" data-target value="${esc(s.targetDraft)}" placeholder="e.g. 7.5" aria-describedby="target-error"></label><p class="sleep-error" id="target-error" role="alert">${esc(s.error)}</p>${p('Uses the same preference as Profile. Saved targets are shared with Profile in this browser tab; no account data is changed.') }`, btn('Save target', 'save-target', 'primary') + btn('Cancel', 'close'));
    default: return '';
  }
}
function entryDialog() {
  const row = s.sessions.find(row => row.id === s.editingSessionId);
  const modes = `<div class="sleep-entry-modes">${[['times', 'Sleep / wake times'], ['duration', 'Duration only']].map(([mode, title]) => `<button data-action="entry-mode" data-mode="${mode}" aria-pressed="${s.entryMode === mode}">${title}</button>`).join('')}</div>`;
  const fields = s.entryMode === 'times' ? `<div class="sleep-clock" aria-label="24-hour sleep time selector"><div data-clock-drawing>${clockDrawing()}</div></div><div class="sleep-clock-fields">${[['bedtime', 'Bedtime', '23:00'], ['wakeTime', 'Wake time', '07:00']].map(([key, title, example]) => `<div class="sleep-time-field"><label class="sleep-field"><span>${title}</span><input data-sleep-time="${key}" inputmode="numeric" maxlength="5" placeholder="${example}" value="${esc(s[key])}" aria-label="${title} in 24-hour HH:MM format"></label><button class="sleep-time-date" data-action="entry-date" data-field="${key === 'bedtime' ? 'bedDate' : 'wakeDate'}" aria-label="Change ${title.toLowerCase()} date">${dateText(key === 'bedtime' ? s.bedDate : s.wakeDate)}${icon('down')}</button></div>`).join('')}</div><p class="supporting" data-interval-date>${intervalDate()}</p>${p('Drag B for bedtime or W for wake time, or type 24-hour times. Arrow keys adjust a focused handle by 5 minutes.')}` : `<label class="sleep-field"><span>Duration in hours</span><input inputmode="decimal" data-duration value="${esc(s.draft)}" placeholder="e.g. 7.5" aria-describedby="duration-preview duration-error" ${s.error ? 'aria-invalid="true"' : ''}></label>${row && !row.bedtime ? p('Bedtime and wake time are not available for this record. The saved duration is shown without inventing times.') : ''}`;
  return dialog(row ? 'Edit sleep session' : 'Record sleep', `${p(`Night ending ${dateText(s.entryMode === 'times' ? s.wakeDate : s.selected)}`)}${modes}${fields}<p class="sleep-interval-preview" id="duration-preview" aria-live="polite">${s.entryMode === 'times' ? intervalPreview() : preview()}</p><p class="sleep-error" id="duration-error" role="alert">${esc(s.error)}</p>${p(s.entryMode === 'times' ? 'Calculated from your times; this does not subtract time awake during the interval.' : 'Saved as a manual duration.')}${row?.source === 'health' ? p('Saving creates a manual correction for this entry in Lastrep. It does not edit Health Connect or replace other sessions.') : ''}`, btn('Save session', 'save', 'primary') + btn('Cancel', 'close'));
}
function intervalPreview() {
  try { return durationText(sleepInterval(s).hours); } catch (error) { return s.bedtime && s.wakeTime ? error.message : 'Set bedtime and wake time to calculate duration.'; }
}
function intervalDate() {
  return `${dateText(s.bedDate)} ${s.bedtime || '—'} → ${dateText(s.wakeDate)} ${s.wakeTime || '—'}`;
}
function clockDrawing() {
  const center = 130, radius = 86, circumference = 2 * Math.PI * radius;
  let interval; try { interval = sleepInterval(s); } catch { /* Incomplete drafts have no duration arc. */ }
  const start = timeMinutes(s.bedtime);
  const arc = interval ? `<circle cx="130" cy="130" r="86" fill="none" stroke="var(--accent)" stroke-width="12" stroke-dasharray="${interval.hours / 24 * circumference} ${circumference}" transform="rotate(${start / 4 - 90} 130 130)"/>` : '';
  return `<svg viewBox="0 0 260 260" aria-label="24-hour dial; midnight at top"><circle cx="130" cy="130" r="86" fill="none" stroke="var(--rule)" stroke-width="12"/>${Array.from({ length: 24 }, (_, hour) => { const angle = hour * Math.PI / 12; return `<path d="M${130 + Math.sin(angle) * 99} ${130 - Math.cos(angle) * 99}L${130 + Math.sin(angle) * 103} ${130 - Math.cos(angle) * 103}" stroke="var(--border)"/>`; }).join('')}${arc}${[[130, 20, '00'], [242, 136, '06'], [130, 248, '12'], [18, 136, '18']].map(([x, y, text]) => `<text x="${x}" y="${y}" text-anchor="middle">${text}</text>`).join('')}<text x="130" y="128" text-anchor="middle" class="clock-center-label">${interval ? durationText(interval.hours) : 'Set sleep'}</text><text x="130" y="148" text-anchor="middle" class="clock-center-label">${interval ? 'Duration' : 'times'}</text>${[['bedtime', 'Bedtime', 1380], ['wakeTime', 'Wake time', 420]].map(([key, title, fallback]) => { const minutes = timeMinutes(s[key]), angle = (minutes ?? fallback) * Math.PI / 720, x = center + Math.sin(angle) * radius, y = center - Math.cos(angle) * radius; return `<g data-clock-handle="${key}" role="slider" tabindex="0" aria-label="${title}" aria-valuemin="0" aria-valuemax="1439" aria-valuenow="${minutes ?? fallback}" aria-valuetext="${s[key] || 'Not set'}" transform="translate(${x} ${y})"><circle r="22" fill="transparent"/><circle r="12" fill="var(--surface)" stroke="var(--accent)" stroke-width="2" ${minutes == null ? 'stroke-dasharray="3 2"' : ''}/><text text-anchor="middle" y="4" class="clock-handle-label">${key === 'bedtime' ? 'B' : 'W'}</text></g>`; }).join('')}</svg>`;
}
function updateClock(syncInputs = false) {
  $('[data-clock-drawing]').innerHTML = clockDrawing();
  for (const key of ['bedtime', 'wakeTime']) { const input = $(`[data-sleep-time="${key}"]`); if (syncInputs || document.activeElement !== input) input.value = s[key]; }
  document.querySelectorAll('[data-action="entry-date"]').forEach(button => { button.innerHTML = dateText(s[button.dataset.field]) + icon('down'); });
  $('[data-interval-date]').textContent = intervalDate(); $('#duration-preview').textContent = intervalPreview(); $('#duration-error').textContent = ''; s.error = '';
}
function preview() {
  const hours = Number(s.draft); return s.draft.trim() && Number.isFinite(hours) && hours > 0 && hours <= 24 ? `${durationText(hours)} · 7.5 hours means 7 h 30 min.` : 'Use decimal hours, for example 7.5 for 7 h 30 min.';
}
function tabs() {
  return `<nav class="bottom-tabs" aria-label="App destinations">${[['Home', './home.html'], ['Workout', './'], ['Nutrition', './nutrition.html'], ['Sleep', ''], ['Profile', './profile.html']].map(([name, href]) => href ? `<a class="tab tab-link" href="${href}">${icon(name.toLowerCase())}${name}</a>` : `<button class="tab ${name === 'Sleep' ? 'active' : ''}" data-action="${name === 'Sleep' ? 'top' : 'health'}" ${name === 'Sleep' ? 'aria-current="page"' : ''}>${icon(name.toLowerCase())}${name}</button>`).join('')}</nav>`;
}
function render(preserve = true) {
  const y = $('.sleep-device .viewport')?.scrollTop ?? 0, chartX = $('.sleep-chart-wrap')?.scrollLeft ?? 0, sheetY = $('.sheet-body')?.scrollTop ?? 0;
  $('#state-title').textContent = sleepStates.find(row => row[0] === example)[1];
  $('#state-description').textContent = sleepStates.find(row => row[0] === example)[2];
  $('#stage').innerHTML = `<div class="frame-wrap"><h3>Sleep / Recovery journal</h3><section class="device sleep-device ${dark ? 'dark' : ''} ${large ? 'large-text' : ''}" style="--width:${size[0]}px;--height:${size[1]}px" aria-label="Interactive Sleep prototype"><div class="system-bar" aria-hidden="true"><span>9:41</span><span>LTE&nbsp;&nbsp;92%</span></div><header class="toolbar notebook-toolbar"><div><button class="icon-button" data-action="home" aria-label="Back to Home">${icon('left')}</button><h2 class="toolbar-title">Sleep</h2><span aria-hidden="true"></span></div></header><div class="viewport" tabindex="0" aria-label="Scrollable sleep journal"><div class="page-content">${s.loading ? `<div role="status">${p('Loading saved sleep…')}<div class="sleep-skeleton"></div><div class="sleep-skeleton"></div></div>` : dates() + notices() + summary() + sessionList() + trend() + connection()}</div></div>${tabs()}${modal()}${s.toast && !s.modal ? `<div class="toast" role="status"><span>${esc(s.toast)}</span><button class="icon-button" data-action="dismiss" aria-label="Dismiss notification">×</button></div>` : ''}</section><p class="frame-caption">${size.join(' × ')} / ${dark ? 'Dark' : 'Paper'} / ${large ? '200%' : '100%'} text. Illustrative data only.</p></div>`;
  $('.sleep-device .viewport').scrollTop = preserve ? y : 0;
  const chart = $('.sleep-chart-wrap');
  if (chart) chart.scrollLeft = !preserve || s.followLatest ? chart.scrollWidth : chartX;
  if ($('.sheet-body')) $('.sheet-body').scrollTop = preserve ? sheetY : 0;
  if (s.modal) $('.sheet-head .close')?.focus({ preventScroll: true });
}
function close() { const returning = s.modal === 'entry-date'; s.modal = returning || s.modal === 'overlap' ? 'entry' : s.modal === 'exclude' ? 'session' : ''; s.error = ''; render(); if (returning) $('.sheet-body').scrollTop = s.entryScroll ?? 0; }
function prepareEntry(id = null) {
  const row = s.sessions.find(row => row.id === id);
  s.editingSessionId = row?.id ?? null;
  s.draft = row ? String(row.hours) : ''; s.entryMode = !row || row.bedtime ? 'times' : 'duration';
  s.bedtime = row?.bedtime ?? ''; s.wakeTime = row?.wakeTime ?? ''; s.bedDate = row?.bedDate; s.wakeDate = row?.wakeDate ?? s.selected;
  s.datesExplicit = !!row?.bedDate; inferSleepDates(s); s.error = ''; s.modal = 'entry'; render();
}
function attemptSave(replaceConflicts = false) {
  if (s.offline) { s.error = 'You’re offline. Your entry is kept; reconnect before saving.'; s.modal = 'entry'; render(); return; }
  try { saveSleep(s, { replaceConflicts }); s.modal = ''; notify('Session saved. Other sleep entries are kept.'); }
  catch (error) { s.error = error.message; if (error.code === 'sleep-overlap') { s.conflictIds = error.sessionIds; s.modal = 'overlap'; } else s.modal = 'entry'; render(); }
}
function notify(text) { clearTimeout(toastTimer); s.toast = text; render(); toastTimer = setTimeout(() => { s.toast = ''; render(); }, 4000); }
function sync() {
  if (s.syncing || s.offline || s.connection !== 'connected') return;
  if (!s.syncConfirmed) { s.modal = 'sync-confirm'; render(); return; }
  s.syncing = true; s.notice = ''; render();
  const active = s;
  syncTimer = setTimeout(() => { if (s !== active) return; s.syncing = false; s.lastSync = 'Oct 15, 18:30'; if (s.syncFixture === 'split') { importSleepSessions(s, mockWearableSessions()); s.notice = 'Two provider sessions imported or updated. Repeated sync does not add duplicates.'; } else s.notice = 'Sleep checked at 18:30. No new records were found.'; render(); }, 650);
}
$('#stage').addEventListener('click', event => {
  const el = event.target.closest('[data-action]'); if (!el || el.disabled) return;
  const d = el.dataset;
  switch (d.action) {
    case 'outside': if (el === event.target) close(); return;
    case 'home': location.href = './home.html'; return;
    case 'close': close(); return;
    case 'calendar': s.month = s.selected.slice(0, 7); s.modal = 'calendar'; render(); return;
    case 'month': { const date = new Date(`${s.month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + Number(d.step)); s.month = date.toISOString().slice(0, 7); render(); return; }
    case 'date': if (s.modal === 'entry-date') { s[s.dateField] = d.date; s.datesExplicit = true; s.modal = 'entry'; s.error = ''; render(); $('.sheet-body').scrollTop = s.entryScroll ?? 0; } else { s.selected = d.date; close(); } return;
    case 'day': s.selected = shiftSleepDate(s.selected, Number(d.step)); render(); return;
    case 'select-night': s.selected = d.date; render(); return;
    case 'record': s.selected = d.date; render(); $('.viewport').scrollTop = 0; return;
    case 'history': s.showHistory = !s.showHistory; s.historyCount = 5; render(); return;
    case 'more-records': s.historyCount += 5; render(); return;
    case 'entry': prepareEntry(); return;
    case 'edit-session': prepareEntry(s.detailId); return;
    case 'session': s.detailId = d.id; s.error = ''; s.modal = 'session'; render(); return;
    case 'show-excluded': s.showExcluded = !s.showExcluded; render(); return;
    case 'ask-exclude': s.modal = 'exclude'; render(); return;
    case 'exclude': excludeSleepSession(s, s.detailId); s.modal = ''; notify('Entry removed from Lastrep totals.'); return;
    case 'restore': { const row = s.sessions.find(row => row.id === s.detailId), editing = s.editingSessionId; s.editingSessionId = row.id; const conflicts = sleepConflicts(s, row); s.editingSessionId = editing; if (conflicts.length) { s.error = 'This entry overlaps another entry. Review that entry before restoring.'; render(); return; } row.excluded = false; rebuildSleepDays(s); s.modal = ''; notify('Entry restored.'); return; }
    case 'entry-mode': if (s.entryMode === 'times' && d.mode === 'duration') { try { s.draft = String(Number(sleepInterval(s).hours.toFixed(5))); } catch { /* Keep an existing duration draft if times are incomplete. */ } } s.entryMode = d.mode; s.error = ''; render(); return;
    case 'entry-date': s.entryScroll = $('.sheet-body').scrollTop; s.dateField = d.field; s.month = s[d.field].slice(0, 7); s.modal = 'entry-date'; s.error = ''; render(); $('.sheet-body').scrollTop = 0; return;
    case 'setup': s.modal = 'setup'; render(); return;
    case 'save': attemptSave(); return;
    case 'replace-conflicts': attemptSave(true); return;
    case 'back-to-entry': s.modal = 'entry'; s.error = ''; render(); return;
    case 'health': location.href = './profile.html#health'; return;
    case 'target': s.targetDraft = String(s.target); s.error = ''; s.modal = 'target'; render(); return;
    case 'save-target': try { saveSleepTarget(s); writeNotebookPreferences({ profile: { sleepTarget: String(s.target) } }); s.modal = ''; notify('Sleep target updated in this mock journal.'); } catch (error) { s.error = error.message; render(); } return;
    case 'simulate-connect': s.connection = 'connected'; close(); return;
    case 'simulate-disconnect': s.connection = 'disconnected'; close(); return;
    case 'sync': sync(); return;
    case 'import-split': s.syncFixture = 'split'; s.syncConfirmed = true; s.modal = ''; sync(); return;
    case 'confirm-sync': s.syncConfirmed = true; s.modal = ''; sync(); return;
    case 'refresh': s.refreshError = false; render(); return;
    case 'top': $('.viewport').scrollTop = 0; return;
    case 'dismiss': s.toast = ''; render(); return;
    default: return;
  }
});
$('#stage').addEventListener('input', event => {
  if (event.target.hasAttribute('data-target')) { s.targetDraft = event.target.value; s.error = ''; $('#target-error').textContent = ''; return; }
  if (event.target.dataset.sleepTime) { s[event.target.dataset.sleepTime] = event.target.value; inferSleepDates(s); updateClock(); return; }
  if (!event.target.hasAttribute('data-duration')) return;
  s.draft = event.target.value; s.error = ''; $('#duration-preview').textContent = preview(); $('#duration-error').textContent = ''; event.target.removeAttribute('aria-invalid');
});
let clockDrag = null;
$('#stage').addEventListener('pointerdown', event => {
  const handle = event.target.closest('[data-clock-handle]'), clock = event.target.closest('.sleep-clock');
  if (!handle || !clock) return;
  event.preventDefault(); clockDrag = { clock, key: handle.dataset.clockHandle, id: event.pointerId }; clock.setPointerCapture(event.pointerId); moveClock(event);
});
function moveClock(event) {
  if (!clockDrag || event.pointerId !== clockDrag.id) return;
  const rect = clockDrag.clock.getBoundingClientRect(), x = event.clientX - rect.left - rect.width / 2, y = event.clientY - rect.top - rect.height / 2;
  const angle = (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI);
  s[clockDrag.key] = minutesTime(Math.round(angle / (2 * Math.PI) * 1440 / 5) * 5); inferSleepDates(s); updateClock(true);
}
$('#stage').addEventListener('pointermove', moveClock);
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#stage').addEventListener(type, () => { clockDrag = null; });
$('#stage').addEventListener('keydown', event => {
  const handle = event.target.closest('[data-clock-handle]');
  if (!handle || !['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
  event.preventDefault(); const key = handle.dataset.clockHandle, current = timeMinutes(s[key]) ?? (key === 'bedtime' ? 1380 : 420);
  s[key] = minutesTime(current + (['ArrowUp', 'ArrowRight'].includes(event.key) ? 5 : -5)); inferSleepDates(s); updateClock(); $(`[data-clock-handle="${key}"]`).focus();
});
for (const type of ['pointerdown', 'wheel', 'keydown']) $('#stage').addEventListener(type, event => {
  if (event.target.closest('.sleep-chart-wrap')) s.followLatest = false;
}, { passive: true });
document.addEventListener('keydown', event => {
  if (!s.modal) return;
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key !== 'Tab') return;
  const nodes = [...document.querySelectorAll('.sleep-device .sheet button:not(:disabled), .sleep-device .sheet input, .sleep-device [data-clock-handle]')];
  const index = nodes.indexOf(document.activeElement);
  if (event.shiftKey && index <= 0) { event.preventDefault(); nodes.at(-1)?.focus(); }
  else if (!event.shiftKey && index === nodes.length - 1) { event.preventDefault(); nodes[0]?.focus(); }
});
$('#example').addEventListener('change', event => choose(event.target.value));
$('#viewport').addEventListener('change', event => { size = event.target.value.split(',').map(Number); render(); });
$('#dark').addEventListener('change', event => { dark = event.target.checked; render(); });
$('#large').addEventListener('change', event => { large = event.target.checked; render(); });
$('#reset').addEventListener('click', () => choose(example));
const initial = location.hash.slice(1);
choose(sleepStates.some(row => row[0] === initial) ? initial : 'overview');
