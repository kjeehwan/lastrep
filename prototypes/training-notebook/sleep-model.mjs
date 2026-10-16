// Synthetic diary records. No health service, account or native permission calls.
import { rebuildSleepDays, commitSleepSession, importSleepSessions, mockWearableSessions } from './sleep-sessions.mjs';
export const SLEEP_DAY = '2026-10-15';
export const sleepStates = [
  ['overview', 'Sleep journal', 'Recorded duration, a personal target and recent nights.'],
  ['empty', 'No saved sleep', 'Manual entry is available without health access.'],
  ['disconnected-saved', 'Disconnected / saved data', 'Saved account records remain visible; this device is not connected.'],
  ['disconnected-empty', 'Disconnected / no data', 'Connect health data or record sleep manually.'],
  ['permission', 'Sleep permission removed', 'Previously saved records are not erased by revoking device access.'],
  ['unavailable', 'Health Connect needs setup', 'Install/update guidance, without pretending every device supports health sync.'],
  ['unsupported', 'Health sync not supported', 'Manual logging remains available; installing an app cannot fix an unsupported device.'],
  ['stale', 'Older saved record', 'Do not describe an older night as last night.'],
  ['sparse', 'Missing nights', 'Missing records are gaps, not zero-hour nights.'],
  ['manual', 'Manually recorded night', 'Manual duration has an explicit source, not a Health Connect badge.'],
  ['log', 'Record sleep', 'Set bedtime and wake time on the dial or type exact times.'],
  ['edit', 'Edit recorded duration', 'Recorded amount is prefilled; Cancel leaves it unchanged.'],
  ['invalid', 'Invalid duration', 'Retain the draft and show a useful field error.'],
  ['save-error', 'Manual save failed', 'Keep the entry available for retry.'],
  ['sync-confirm', 'Confirm sync account', 'Import only after reviewing the destination account.'],
  ['syncing', 'Sync in progress', 'Keep saved duration visible during sync.'],
  ['sync-empty', 'Sync / no new records', 'A successful check is not a newly recorded night.'],
  ['sync-error', 'Sync failed', 'Keep saved records and distinguish failure from no new data.'],
  ['loading', 'Loading account records', 'Neutral placeholders, not a flash of empty history.'],
  ['load-error', 'Load failed / saved records', 'Show saved records with an explicit refresh error.'],
  ['offline', 'Offline / saved records', 'Saved history remains visible; sync is unavailable offline.'],
  ['calendar', 'Choose a sleep date', 'Select a date directly from the shared calendar pattern.'],
  ['history', 'Recorded nights', 'Readable date, duration and source for each saved night.'],
  ['split-night', 'Split night / two manual sessions', '23:00–03:00 and 04:00–07:00 add up to seven hours.'],
  ['night-nap', 'Overnight sleep plus nap', 'A later session adds to the day rather than replacing the night.'],
  ['wearable-split', 'Wearable / split sessions', 'Separate provider sessions are retained with their source.'],
  ['provider-overlap', 'Wearable / overlapping sources', 'Overlapping intervals count once, with a review notice.'],
  ['overlap-entry', 'Manual session / overlap review', 'Confirm which entries to replace; never silently overwrite.'],
  ['session-detail', 'Session details', 'Individual duration, times and source, with manual correction controls.'],
  ['exclude-session', 'Remove a session from Lastrep', 'Exclusion does not delete the original health-service record.'],
  ['setup', 'Health Connect setup guide', 'Practical steps for installing/updating, connecting a source and granting access.'],
  ['dark', 'Dark paper', 'The same quiet journal hierarchy on charcoal paper.'],
  ['large', '200% text', 'Reflow summaries and enlarge chart labels and targets.'],
];
export function shiftSleepDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10);
}
export function durationText(hours) {
  if (hours == null) return 'Not recorded';
  const minutes = Math.round(hours * 60); return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
export function targetDelta(hours, target) {
  if (hours == null) return 'No duration recorded for this date.';
  const minutes = Math.round((hours - target) * 60);
  return minutes === 0 ? 'Matches your target' : `${Math.abs(minutes)} min ${minutes < 0 ? 'below' : 'above'} your target`;
}
export function sleepFixture(id = 'overview') {
  const durations = [7.1, 6.4, 7.5, 7, 6.8, 7.3, 6.2, 7.2, 6.5, 7.1, null, 7.4, 6.9, 6.7];
  const records = durations.flatMap((hours, i) => hours == null ? [] : [{ date: shiftSleepDate(SLEEP_DAY, i - 13), hours, source: 'health', saved: 'Oct 15, 08:12' }]);
  const s = { records, selected: SLEEP_DAY, target: 7, connection: 'connected', lastSync: 'Oct 15, 08:12', offline: false, loading: false, refreshError: false, notice: '', modal: '', draft: '', error: '', syncing: false, showHistory: false, historyCount: 5, month: '2026-10', syncConfirmed: false, followLatest: true, entryMode: 'duration', bedtime: '', wakeTime: '', startOffset: -1 };
  if (['empty', 'disconnected-empty'].includes(id)) { s.records = []; s.lastSync = null; }
  if (['disconnected-empty', 'disconnected-saved', 'empty'].includes(id)) s.connection = 'disconnected';
  if (id === 'permission') s.connection = 'permission';
  if (id === 'unavailable') s.connection = 'unavailable';
  if (id === 'unsupported') s.connection = 'unsupported';
  if (id === 'stale') { s.records = records.filter(row => row.date <= '2026-10-11'); s.lastSync = 'Oct 11, 08:10'; }
  if (id === 'sparse') s.records = records.filter((_, i) => [0, 4, 9, 12].includes(i));
  if (id === 'manual') Object.assign(s.records.at(-1), { hours: 7.5, source: 'manual', saved: 'Oct 15, 09:05' });
  if (['edit', 'invalid', 'save-error'].includes(id)) { s.modal = 'entry'; s.draft = id === 'invalid' ? '25' : String(s.records.at(-1).hours); }
  if (id === 'log') { s.records = records.filter(row => row.date !== SLEEP_DAY); s.modal = 'entry'; s.entryMode = 'times'; }
  if (id === 'invalid') s.error = 'Enter more than 0 and no more than 24 hours.';
  if (id === 'save-error') s.error = 'Could not save. Your entry is kept. Try again.';
  if (id === 'sync-confirm') s.modal = 'sync-confirm';
  if (id === 'syncing') s.syncing = true;
  if (id === 'sync-empty') { s.notice = 'Sleep checked at 18:30. No new records were found.'; s.lastSync = 'Oct 15, 18:30'; }
  if (id === 'sync-error') s.notice = 'Could not sync sleep. Your saved records are unchanged.';
  if (id === 'loading') s.loading = true;
  if (id === 'load-error') s.refreshError = true;
  if (id === 'offline') s.offline = true;
  if (id === 'calendar') s.modal = 'calendar';
  if (id === 'history') s.showHistory = true;
  if (id === 'setup') { s.connection = 'unavailable'; s.modal = 'setup'; }
  s.serial = 0;
  s.sessions = s.records.map(row => ({ ...row, id: `saved-${row.date}`, kind: row.source === 'health' ? 'legacy-total' : 'duration' }));
  s.editingSessionId = ['edit', 'invalid', 'save-error'].includes(id) ? `saved-${SLEEP_DAY}` : null;
  if (['split-night', 'night-nap', 'wearable-split', 'provider-overlap', 'overlap-entry', 'session-detail', 'exclude-session'].includes(id)) {
    s.sessions = s.sessions.filter(row => row.date !== SLEEP_DAY);
    const incoming = mockWearableSessions();
    if (['split-night', 'night-nap'].includes(id)) {
      s.sessions.push(...incoming.map((row, i) => ({ ...row, origin: undefined, originLabel: undefined, externalId: undefined, id: `manual-fixture-${i}`, date: row.wakeDate, hours: i === 0 ? 4 : 3, source: 'manual', kind: 'session' })));
      if (id === 'night-nap') s.sessions.push({ id: 'manual-nap', date: SLEEP_DAY, source: 'manual', kind: 'session', bedDate: SLEEP_DAY, bedtime: '13:00', wakeDate: SLEEP_DAY, wakeTime: '14:30', hours: 1.5, saved: 'Oct 15, 15:00' });
    } else importSleepSessions(s, incoming);
    if (id === 'provider-overlap') importSleepSessions(s, [{ ...incoming[0], externalId: 'second-provider', origin: 'mock.other', originLabel: 'Second tracker · example', wakeTime: '07:00' }]);
    if (id === 'overlap-entry') { s.entryMode = 'times'; s.bedDate = SLEEP_DAY; s.bedtime = '02:00'; s.wakeDate = SLEEP_DAY; s.wakeTime = '04:00'; s.datesExplicit = true; s.modal = 'entry'; }
    if (['session-detail', 'exclude-session'].includes(id)) { s.detailId = s.sessions.find(row => row.date === SLEEP_DAY).id; s.modal = id === 'session-detail' ? 'session' : 'exclude'; }
  }
  rebuildSleepDays(s);
  return s;
}
export const selectedSleep = s => s.records.find(row => row.date === s.selected) ?? null;
export function sleepWindow(s) {
  return Array.from({ length: 14 }, (_, i) => { const date = shiftSleepDate(SLEEP_DAY, i - 13); return { date, record: s.records.find(row => row.date === date) ?? null }; });
}
export function weeklySleep(s) {
  const dates = Array.from({ length: 7 }, (_, i) => shiftSleepDate(s.selected, i - 6));
  const rows = s.records.filter(row => dates.includes(row.date));
  return { count: rows.length, average: rows.length ? rows.reduce((sum, row) => sum + row.hours, 0) / rows.length : null, met: rows.filter(row => row.hours >= s.target).length };
}
export function saveSleep(s, options = {}) {
  const raw = s.draft.trim(), interval = s.entryMode === 'times' ? sleepInterval(s) : null;
  const hours = interval ? interval.hours : Number(raw);
  if ((!interval && !raw) || !Number.isFinite(hours) || hours <= 0 || hours > 24) throw Error('Enter more than 0 and no more than 24 hours.');
  const date = interval?.endDate ?? s.selected;
  const row = { date, hours, source: 'manual', kind: interval ? 'session' : 'duration', saved: 'Oct 15, 18:30', ...(interval ? { bedtime: s.bedtime, wakeTime: s.wakeTime, bedDate: interval.startDate, wakeDate: interval.endDate } : {}) };
  return commitSleepSession(s, row, options.replaceConflicts);
}
export function timeMinutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [h, m] = time.split(':').map(Number); return h * 60 + m;
}
export function minutesTime(minutes) {
  const value = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function sleepInterval(s) {
  const start = timeMinutes(s.bedtime), end = timeMinutes(s.wakeTime);
  if (start == null || end == null) throw Error('Set both times using the dial or HH:MM fields.');
  const startDate = s.bedDate ?? shiftSleepDate(s.selected, s.startOffset), endDate = s.wakeDate ?? s.selected;
  if (![startDate, endDate].every(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date)) throw Error('Choose valid bedtime and wake dates.');
  if (endDate > SLEEP_DAY) throw Error('Wake date cannot be in the future.');
  const minutes = end - start + (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 60000;
  if (minutes <= 0 || minutes > 1440) throw Error('Check the times and bedtime date. Duration must be more than 0 and no more than 24 hours.');
  return { hours: minutes / 60, startDate, endDate };
}
export function inferSleepDates(s) {
  if (s.datesExplicit) return;
  s.wakeDate ??= s.selected;
  const start = timeMinutes(s.bedtime), end = timeMinutes(s.wakeTime);
  s.bedDate = shiftSleepDate(s.wakeDate, start != null && end != null && start < end ? 0 : -1);
}
export function saveSleepTarget(s) {
  const raw = s.targetDraft?.trim(), hours = Number(raw);
  if (!raw || !Number.isFinite(hours) || hours <= 0 || hours > 24 || Math.round(hours * 10) === 0) throw Error('Enter more than 0 and no more than 24 hours.');
  s.target = Math.round(hours * 10) / 10;
}
