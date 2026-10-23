import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestWarmups, rememberWarmups, newWarmups, insertWarmups, warmupError, setDisplayRows } from './warmup.mjs';

const pattern = [{ fixed: 20, reps: 4 }, { ratio: .6, reps: 4 }, { ratio: .8, reps: 2 }];
test('the example ramp adapts while keeping its fixed first weight', () => {
  const rows = suggestWarmups(100, pattern);
  assert.deepEqual(rows.map(row => [row.weight, row.reps]), [['20', '4'], ['60', '4'], ['80', '2']]);
  assert.deepEqual(suggestWarmups(120, rememberWarmups(rows, 100)).map(row => row.weight), ['20', '70', '95']);
  assert.equal(warmupError(rows, 100), '');
});
test('removed optional rows stay removed from the remembered setup', () => {
  const rows = suggestWarmups(100, pattern).slice(0, 2);
  assert.deepEqual(suggestWarmups(120, rememberWarmups(rows, 100)).map(row => row.weight), ['20', '70']);
});
test('existing warm-ups are matched by occurrence, not inserted again', () => {
  const rows = suggestWarmups(100, pattern);
  assert.deepEqual(newWarmups(rows, [rows[0]]), rows.slice(1));
  assert.equal(newWarmups([rows[0], rows[0]], [rows[0]]).length, 1);
  assert.equal(suggestWarmups(100, [{ fixed: 20, reps: 4 }, { fixed: 20, reps: 4 }]).length, 2);
});
test('an explicitly added row may repeat an existing warm-up', () => {
  const existing = { weight: '20', reps: '4' };
  const manual = { ...existing, manual: true };
  assert.deepEqual(newWarmups([existing, manual], [existing]), [manual]);
});
test('insertion leaves existing working and completed warm-up sets unchanged', () => {
  const existing = [{ weight: '20', reps: '4', type: 'warmup', done: true, rpe: '' }, { weight: '100', reps: '8', type: 'normal', done: false, rpe: '8' }];
  const before = structuredClone(existing);
  const result = insertWarmups(existing, newWarmups(suggestWarmups(100, pattern), existing.filter(row => row.type === 'warmup')));
  assert.deepEqual(existing, before);
  assert.deepEqual(result[0], existing[0]);
  assert.deepEqual(result.at(-1), existing[1]);
  assert.deepEqual(result.slice(1, 3).map(row => [row.type, row.done]), [['warmup', false], ['warmup', false]]);
});
test('missing reference, invalid weights and partial reps cannot be applied', () => {
  assert.deepEqual(suggestWarmups('', pattern), []);
  for (const rows of [[{ weight: 'abc', reps: '4' }], [{ weight: '101', reps: '4' }], [{ weight: '20', reps: '1.5' }], [{ weight: '', reps: '4' }]]) assert.ok(warmupError(rows, 100));
  assert.ok(warmupError([], ''));
});
test('warm-ups do not consume working-set numbers or previous-performance entries', () => {
  const warmup = { weight: '20', reps: '4', type: 'warmup' };
  const normal = { weight: '100', reps: '8', type: 'normal' };
  const previous = [warmup, { weight: '90', reps: '8' }, { weight: '85', reps: '10' }, { weight: '80', reps: '12' }];
  const rows = setDisplayRows({ sets: [warmup, warmup, warmup, normal, normal, normal], previous });
  assert.deepEqual(rows.map(row => row.marker), ['W', 'W', 'W', 1, 2, 3]);
  assert.deepEqual(rows.map(row => row.previous?.weight), [undefined, undefined, undefined, '90', '85', '80']);
  const mixed = setDisplayRows({ sets: [normal, warmup, normal], previous });
  assert.deepEqual(mixed.map(row => row.marker), [1, 'W', 2]);
  assert.equal(mixed[2].previous.weight, '85');
});
