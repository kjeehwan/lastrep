import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, summary, lastText, effortValue, guidanceChanges, moveExercise, exerciseFromCatalog, setUnit, states } from './model.mjs';
test('approved fixture preserves uneven sets and blank new effort', () => {
  const e = fixture(); assert.deepEqual(e[1].sets.map(s => s.weight), ['30', '28', '28']);
  assert.ok(e.every(x => x.sets.every(s => s.rpe === ''))); assert.equal(e[2].sets[0].weight, '');
});
test('Last includes recorded effort and respects RIR', () => {
  assert.equal(lastText(fixture()[0].previous[0]), '105 × 3 @ 10');
  assert.equal(lastText(fixture()[0].previous[0], 'RIR'), '105 × 3 @ 0');
  assert.equal(lastText(fixture()[1].previous[0]), '30 × 8'); assert.equal(effortValue('', 'RIR'), '');
});
test('Apply preserves completed and warmup sets and respects uneven working loads', () => {
  const input = fixture(); input[1].sets[2].type = 'warmup'; const after = guidanceChanges(input);
  assert.equal(after[0].sets[0].weight, '100'); assert.equal(after[0].sets[1].weight, '95');
  assert.equal(after[1].sets[0].weight, '30'); assert.equal(after[1].sets[0].reps, '6');
  assert.equal(after[1].sets[1].weight, '28'); assert.equal(after[1].sets[1].reps, '8');
  assert.equal(after[1].sets[2].weight, '28'); assert.equal(input[0].sets[1].weight, '100');
});
test('summary uses actual completed sets, not planned volume', () => assert.deepEqual(summary(fixture()), { total: 11, completed: 1, volumeKg: 500 }));
test('reorder boundary is safe and a move preserves every exercise', () => {
  assert.deepEqual(moveExercise(fixture(), 'bench', -1), fixture()); assert.equal(moveExercise(fixture(), 'bench', 1)[1].id, 'bench');
});
test('new exercise does not inherit old effort or completion', () => {
  assert.ok(exerciseFromCatalog('bench').sets.every(s => !s.done && s.rpe === ''));
  assert.equal(exerciseFromCatalog('treadmill').mode, 'cardio'); assert.equal(exerciseFromCatalog('new', 'V Squat').custom, true);
});
test('unit conversion preserves blank loads and returns approximately original values', () => {
  assert.equal(setUnit(fixture()[2], 'lbs').sets[0].weight, '');
  assert.ok(Math.abs(Number(setUnit(setUnit(fixture()[0], 'lbs'), 'kg').sets[0].weight) - 100) < .01);
});
test('review states are unique and cover required groups', () => {
  assert.equal(new Set(states.map(s => s[1])).size, states.length);
  assert.equal(new Set(states.map(s => s[0])).size, 7);
});
