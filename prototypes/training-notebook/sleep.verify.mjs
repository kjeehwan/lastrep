import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLEEP_DAY, sleepStates, sleepFixture, durationText, targetDelta, selectedSleep, sleepWindow, weeklySleep, saveSleep, shiftSleepDate, timeMinutes, minutesTime, sleepInterval, inferSleepDates, saveSleepTarget } from './sleep-model.mjs';
import { importSleepSessions, mockWearableSessions, sessionsForDate, excludeSleepSession } from './sleep-sessions.mjs';

test('duration uses rounded minutes, including rollover', () => {
  assert.equal(durationText(6.7), '6 h 42 min'); assert.equal(durationText(7.999), '8 h 00 min'); assert.equal(durationText(null), 'Not recorded');
});
test('missing sleep is not zero and delta is relative to the personal target', () => {
  assert.equal(targetDelta(null, 7), 'No duration recorded for this date.');
  assert.equal(targetDelta(6.7, 7), '18 min below your target'); assert.equal(targetDelta(7, 7), 'Matches your target');
});
test('disconnection and revoked permissions preserve saved account records', () => {
  const base = sleepFixture();
  for (const id of ['disconnected-saved', 'permission', 'unavailable']) assert.deepEqual(sleepFixture(id).records, base.records);
});
test('chart represents missing nights explicitly rather than inventing zero records', () => {
  const window = sleepWindow(sleepFixture()); assert.equal(window.length, 14); assert.equal(window.at(-1).date, SLEEP_DAY);
  assert.equal(window.find(row => row.date === '2026-10-12').record, null);
});
test('weekly average excludes missing days and reports actual coverage', () => {
  const summary = weeklySleep(sleepFixture()); assert.equal(summary.count, 6); assert.equal(summary.met, 3);
  assert.ok(Math.abs(summary.average - (7.2 + 6.5 + 7.1 + 7.4 + 6.9 + 6.7) / 6) < .00001);
  const empty = weeklySleep(sleepFixture('empty')); assert.equal(empty.average, null); assert.equal(empty.count, 0);
});
test('weekly comparison follows selected date rather than always saying today', () => {
  const s = sleepFixture(); s.selected = '2026-09-15'; assert.equal(weeklySleep(s).count, 0);
});
test('manual edit changes only selected date without fabricating a sync', () => {
  const s = sleepFixture(), copy = structuredClone(s.records), sync = s.lastSync;
  s.selected = '2026-10-14'; s.editingSessionId = 'saved-2026-10-14'; s.draft = '7.5'; saveSleep(s);
  assert.equal(selectedSleep(s).hours, 7.5); assert.equal(selectedSleep(s).source, 'manual'); assert.equal(s.lastSync, sync);
  assert.deepEqual(s.records.filter(row => row.date !== s.selected), copy.filter(row => row.date !== s.selected));
});
test('new manual record fills one gap and repeated save never duplicates a date', () => {
  const s = sleepFixture('log'); s.entryMode = 'duration'; s.draft = '8'; const count = s.records.length; saveSleep(s); saveSleep(s);
  assert.equal(s.records.length, count + 1); assert.equal(s.records.filter(row => row.date === SLEEP_DAY).length, 1);
});
test('invalid manual entries do not mutate records', () => {
  for (const raw of ['', '0', '-1', '25', 'abc', 'Infinity']) { const s = sleepFixture(), copy = structuredClone(s.records); s.draft = raw; assert.throws(() => saveSleep(s)); assert.deepEqual(s.records, copy); }
});
test('stale data has no invented record for today', () => {
  const s = sleepFixture('stale'); assert.equal(selectedSleep(s), null); assert.equal(s.records.at(-1).date, '2026-10-11');
});
test('date stepping is stable at month and year boundaries', () => {
  assert.equal(shiftSleepDate('2026-01-01', -1), '2025-12-31'); assert.equal(shiftSleepDate('2026-10-31', 1), '2026-11-01');
});
test('states are unique and all construct valid fixtures', () => {
  assert.equal(new Set(sleepStates.map(row => row[0])).size, sleepStates.length);
  for (const [id] of sleepStates) { const s = sleepFixture(id); assert.equal(s.selected, SLEEP_DAY); assert.ok(s.records.every(row => row.hours > 0 && row.hours <= 24)); }
});
test('clock times validate strict HH:MM and wrap without losing midnight', () => {
  assert.equal(timeMinutes('00:00'), 0); assert.equal(timeMinutes('23:59'), 1439);
  for (const value of ['', '24:00', '12:60', '9:30', 'abc']) assert.equal(timeMinutes(value), null);
  assert.equal(minutesTime(1440), '00:00'); assert.equal(minutesTime(-5), '23:55');
});
test('overnight sleep uses explicit bedtime date, not an implicit AM/PM guess', () => {
  const s = { selected: '2026-01-01', bedtime: '23:00', wakeTime: '07:30', startOffset: -1 };
  assert.deepEqual(sleepInterval(s), { hours: 8.5, startDate: '2025-12-31', endDate: '2026-01-01' });
  s.startOffset = 0; assert.throws(() => sleepInterval(s));
});
test('same-day naps and explicit 24-hour intervals calculate correctly', () => {
  const s = { selected: SLEEP_DAY, bedtime: '13:00', wakeTime: '14:30', startOffset: 0 };
  assert.equal(sleepInterval(s).hours, 1.5); s.wakeTime = '13:00'; assert.throws(() => sleepInterval(s));
  s.startOffset = -1; assert.equal(sleepInterval(s).hours, 24);
});
test('clock save retains known times and never fabricates imported timing', () => {
  const s = sleepFixture('log'); s.bedtime = '23:00'; s.wakeTime = '06:30';
  const row = saveSleep(s); assert.equal(row.hours, 7.5); assert.equal(row.bedtime, '23:00'); assert.equal(row.bedDate, '2026-10-14');
  assert.equal(sleepFixture().records.at(-1).bedtime, undefined);
});
test('automatic dates distinguish naps and overnight sleep until dates are explicitly chosen', () => {
  const s = sleepFixture('log'); Object.assign(s, { bedtime: '23:00', wakeTime: '07:00' }); inferSleepDates(s);
  assert.equal(s.bedDate, '2026-10-14'); assert.equal(s.wakeDate, '2026-10-15');
  s.bedtime = '13:00'; s.wakeTime = '14:30'; inferSleepDates(s); assert.equal(s.bedDate, s.wakeDate);
  s.datesExplicit = true; s.bedDate = '2026-10-13'; inferSleepDates(s); assert.equal(s.bedDate, '2026-10-13');
});
test('changing wake date cannot overwrite a different saved night', () => {
  const s = sleepFixture('log'), before = structuredClone(s.records); Object.assign(s, { bedtime: '23:00', wakeTime: '07:00', bedDate: '2026-10-13', wakeDate: '2026-10-14' });
  assert.throws(() => saveSleep(s), error => error.code === 'sleep-overlap'); assert.deepEqual(s.records, before);
});
test('editing explicit wake date relocates only the edited record', () => {
  const s = sleepFixture(); Object.assign(s, { editingSessionId: 'saved-2026-10-15', entryMode: 'times', bedtime: '23:00', wakeTime: '07:00', bedDate: '2026-10-11', wakeDate: '2026-10-12' });
  saveSleep(s); assert.equal(s.selected, '2026-10-12'); assert.equal(s.records.filter(row => row.date === '2026-10-15').length, 0);
  assert.equal(s.records.find(row => row.date === '2026-10-14').hours, 6.9);
});
test('split night retains two sessions and excludes the awake hour', () => {
  const s = sleepFixture('split-night'); assert.equal(sessionsForDate(s).length, 2); assert.equal(selectedSleep(s).hours, 7); assert.equal(selectedSleep(s).sessionCount, 2);
});
test('adding a nap preserves both overnight sessions and adds to daily total', () => {
  const s = sleepFixture('split-night'); Object.assign(s, { editingSessionId: null, entryMode: 'times', bedDate: SLEEP_DAY, bedtime: '13:00', wakeDate: SLEEP_DAY, wakeTime: '14:30' });
  saveSleep(s); assert.equal(selectedSleep(s).hours, 8.5); assert.equal(sessionsForDate(s).length, 3);
});
test('manual edit changes one session and leaves its sibling unchanged', () => {
  const s = sleepFixture('split-night'), first = sessionsForDate(s)[0], second = structuredClone(sessionsForDate(s)[1]);
  Object.assign(s, { editingSessionId: first.id, entryMode: 'times', bedDate: first.bedDate, bedtime: first.bedtime, wakeDate: first.wakeDate, wakeTime: '02:30' }); saveSleep(s);
  assert.equal(selectedSleep(s).hours, 6.5); assert.deepEqual(sessionsForDate(s).find(row => row.id === second.id), second);
});
test('overlap requires explicit review before changing any records', () => {
  const s = sleepFixture('overlap-entry'), copy = structuredClone(s.sessions);
  assert.throws(() => saveSleep(s), error => error.code === 'sleep-overlap' && error.sessionIds.length === 1); assert.deepEqual(s.sessions, copy);
  saveSleep(s, { replaceConflicts: true }); assert.equal(sessionsForDate(s).length, 2); assert.equal(selectedSleep(s).hours, 5);
});
test('unknown-time legacy total is not silently added to a new timed session', () => {
  const s = sleepFixture(); Object.assign(s, { entryMode: 'times', bedDate: SLEEP_DAY, bedtime: '13:00', wakeDate: SLEEP_DAY, wakeTime: '14:00' });
  assert.throws(() => saveSleep(s), error => error.code === 'sleep-overlap'); assert.equal(selectedSleep(s).hours, 6.7);
});
test('provider stable IDs make repeat sync idempotent and update changed records', () => {
  const s = sleepFixture(); importSleepSessions(s, mockWearableSessions()); importSleepSessions(s, mockWearableSessions());
  assert.equal(sessionsForDate(s).length, 2); assert.equal(selectedSleep(s).hours, 7);
  importSleepSessions(s, [{ ...mockWearableSessions()[1], wakeTime: '07:30' }]); assert.equal(sessionsForDate(s).length, 2); assert.equal(selectedSleep(s).hours, 7.5);
});
test('same interval from different providers is never counted twice', () => {
  const s = sleepFixture('wearable-split'), incoming = mockWearableSessions(); importSleepSessions(s, incoming.map(row => ({ ...row, origin: 'mock.other' })));
  assert.equal(selectedSleep(s).hours, 7); assert.equal(selectedSleep(s).needsReview, true); assert.equal(sessionsForDate(s).length, 4);
});
test('partial overlaps count only the union, retaining original source records', () => {
  const s = sleepFixture('provider-overlap'); assert.equal(selectedSleep(s).hours, 8); assert.equal(sessionsForDate(s).length, 3); assert.equal(selectedSleep(s).needsReview, true);
});
test('provider exclusion survives another sync and does not erase the source row', () => {
  const s = sleepFixture('wearable-split'), id = sessionsForDate(s)[0].id; excludeSleepSession(s, id); importSleepSessions(s, mockWearableSessions());
  assert.equal(selectedSleep(s).hours, 3); assert.equal(s.sessions.find(row => row.id === id).excluded, true);
});
test('manual correction survives provider resync without counting original twice', () => {
  const s = sleepFixture('wearable-split'), row = sessionsForDate(s)[0]; Object.assign(s, { editingSessionId: row.id, entryMode: 'times', bedDate: row.bedDate, bedtime: row.bedtime, wakeDate: row.wakeDate, wakeTime: '02:30' });
  saveSleep(s); importSleepSessions(s, mockWearableSessions()); assert.equal(selectedSleep(s).hours, 6.5); assert.equal(sessionsForDate(s).length, 2);
});
test('deleting one session recalculates that day without deleting the others', () => {
  const s = sleepFixture('night-nap'); excludeSleepSession(s, 'manual-nap'); assert.equal(selectedSleep(s).hours, 7); assert.equal(sessionsForDate(s).length, 2);
});
test('invalid provider batch leaves the existing ledger unchanged', () => {
  const s = sleepFixture(), before = structuredClone(s.sessions); assert.throws(() => importSleepSessions(s, [mockWearableSessions()[0], { externalId: 'bad' }])); assert.deepEqual(s.sessions, before);
});
test('overlap across wake dates contributes time only once across daily totals', () => {
  const s = sleepFixture('empty'); importSleepSessions(s, [
    { externalId: 'a', origin: 'mock.health', bedDate: '2026-10-14', bedtime: '23:00', wakeDate: '2026-10-14', wakeTime: '23:30', saved: 'Oct 15, 08:12' },
    { externalId: 'b', origin: 'mock.other', bedDate: '2026-10-14', bedtime: '23:15', wakeDate: '2026-10-15', wakeTime: '00:30', saved: 'Oct 15, 08:12' },
  ]); assert.equal(s.records.reduce((sum, row) => sum + row.hours, 0), 1.5);
});
test('editing a manual correction keeps its original-provider reference', () => {
  const s = sleepFixture('wearable-split'), row = sessionsForDate(s)[0]; Object.assign(s, { editingSessionId: row.id, entryMode: 'times', bedDate: row.bedDate, bedtime: row.bedtime, wakeDate: row.wakeDate, wakeTime: '02:30' });
  const correction = saveSleep(s); s.wakeTime = '02:15'; const second = saveSleep(s);
  assert.equal(second.id, correction.id); assert.equal(second.corrects, row.id); importSleepSessions(s, mockWearableSessions()); assert.equal(selectedSleep(s).hours, 6.25);
});
test('target save validates before mutation and uses Profile decimal precision', () => {
  const s = sleepFixture(); for (const value of ['', '0', '-1', '25', 'abc', '0.01']) { s.targetDraft = value; assert.throws(() => saveSleepTarget(s)); assert.equal(s.target, 7); }
  s.targetDraft = '7.54'; saveSleepTarget(s); assert.equal(s.target, 7.5);
});
test('incomplete and over-24-hour clock entries never mutate saved records', () => {
  for (const [bedtime, wakeTime] of [['', '07:00'], ['23:00', ''], ['06:00', '07:00']]) {
    const s = sleepFixture('log'), before = structuredClone(s.records); Object.assign(s, { bedtime, wakeTime }); assert.throws(() => saveSleep(s)); assert.deepEqual(s.records, before);
  }
});
