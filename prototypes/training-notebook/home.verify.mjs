import { test } from 'node:test';
import { trendObservationDate } from './home-model.mjs';
import assert from 'node:assert/strict';
import { TODAY, homeFixture, homeStates, observations, selectedObservation, phaseWeeks, changePhase, phaseOnDate, readiness, saveMeasurement, valuesForDate, calendarCells } from './home-model.mjs';

test('returning account and empty account are distinct', () => {
  assert.equal(homeFixture().planned, true); assert.equal(homeFixture('new').hasWorkouts, false);
  assert.equal(readiness(homeFixture('new')), null); assert.equal(homeFixture('new').records.length, 0);
});
test('sparse metric selects its latest actual observation, not latest weight date', () => {
  const s = homeFixture('sparse'); assert.equal(selectedObservation(s).date, '2026-07-18');
  assert.equal(observations(s.records, 'leanMass').length, 0);
});
test('latest daily record is the only chart point for that date', () => {
  const s = homeFixture(); s.records.push({ date: TODAY, weight: 80.25 });
  assert.equal(observations(s.records, 'weight').filter(row => row.date === TODAY).length, 1);
  assert.equal(observations(s.records, 'weight').at(-1).weight, 80.25);
});
test('add today does not overwrite the selected older date', () => {
  const s = homeFixture(); s.selected = '2026-10-12'; s.form = { weight: '80.23' };
  saveMeasurement(s); assert.equal(s.records.find(row => row.date === '2026-10-12').weight, 80.35);
  assert.equal(observations(s.records, 'weight').at(-1).weight, 80.23);
});
test('editing selected date keeps other measurements and supports lbs roundtrip', () => {
  const s = homeFixture(); s.unit = 'lbs'; s.mode = 'edit'; s.editDate = '2026-07-18'; s.form = { weight: '180' };
  saveMeasurement(s); assert.equal(s.records.find(row => row.date === s.editDate).bodyFat, 18.5);
  assert.equal(valuesForDate(s.records, s.editDate, 'lbs').weight, '180');
});
test('invalid measurement never changes saved records', () => {
  const s = homeFixture(), before = JSON.stringify(s.records);
  for (const form of [{ weight: '-1' }, { bodyFat: '101' }, { weight: 'abc' }, {}]) { s.form = form; assert.throws(() => saveMeasurement(s)); }
  assert.equal(JSON.stringify(s.records), before);
});
test('phase changes start week 1 without rewriting the phase of past days', () => {
  const s = homeFixture(); assert.equal(phaseWeeks(s.training.since), 3);
  changePhase(s, 'training', 'Strength'); assert.equal(phaseWeeks(s.training.since), 1);
  assert.equal(phaseOnDate(s, 'training', '2026-10-12'), 'Hypertrophy');
  assert.equal(phaseOnDate(s, 'training', TODAY), 'Strength');
});
test('choosing current phase does not reset the week count', () => {
  const s = homeFixture(); changePhase(s, 'training', 'Hypertrophy'); assert.equal(s.training.since, '2026-10-01');
});
test('readiness treats missing values as missing, not zero', () => {
  const s = homeFixture(); assert.equal(readiness(s), 88); s.ratings.fatigue = ''; assert.equal(readiness(s), null);
});
test('calendar is Monday-first with correct days and month boundaries', () => {
  assert.equal(calendarCells('2026-10').slice(0, 3).every(x => x === null), true);
  assert.equal(calendarCells('2026-02').filter(Boolean).length, 28);
});
test('Home states are unique', () => assert.equal(new Set(homeStates.map(s => s[0])).size, homeStates.length));
test('weekly calorie and sleep dates are valid zero-padded dates for both weeks', () => {
  for (const current of [false, true]) for (const index of [0, 1]) {
    const date = trendObservationDate(current, index);
    assert.match(date, /^2026-10-\d{2}$/);
    assert.ok(Number.isFinite(new Date(`${date}T12:00:00`).getTime()));
  }
  assert.equal(trendObservationDate(false, 0), '2026-10-06');
  assert.equal(trendObservationDate(false, 1), '2026-10-07');
});
