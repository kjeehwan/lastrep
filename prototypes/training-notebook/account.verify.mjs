import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultProfile, accountFixture, profileStates, settingsStates, isDirty, phaseWeek, healthStatus, commitProfile, tdeeEstimate, applyTdee, restoreMessages } from './account-model.mjs';

test('saved Profile is clean; edits stage independently and returning to original clears dirty', () => {
  const s = accountFixture('profile'); assert.equal(isDirty(s), false); s.draft.name = 'Edited'; assert.equal(isDirty(s), true); assert.equal(s.saved.name, 'Daniel'); s.draft.name = 'Daniel'; assert.equal(isDirty(s), false);
});
test('phase start changes only on save; same phase does not restart', () => {
  const s = accountFixture('profile'), before = structuredClone(s.saved);
  s.draft.training.phase = 'Strength'; assert.equal(s.draft.training.since, '2026-10-01'); commitProfile(s); assert.equal(s.saved.training.since, '2026-10-15'); assert.equal(phaseWeek(s.saved.training.since), 1); assert.deepEqual(s.saved.diet, before.diet);
  const count = s.saved.phaseHistory.training.length; commitProfile(s); assert.equal(s.saved.phaseHistory.training.length, count);
});
test('failed validation never changes saved profile', () => {
  for (const [key, value] of [['name', ''], ['sleepTarget', '0'], ['sleepTarget', '25'], ['sleepTarget', 'abc'], ['protein', '-1']]) {
    const s = accountFixture('profile'), saved = structuredClone(s.saved); s.draft[key] = value; assert.throws(() => commitProfile(s)); assert.deepEqual(s.saved, saved);
  }
});
test('calorie, meal-name and body validation preserves saved values', () => {
  for (const mutate of [d=>d.calories.Cut='', d=>d.mealLabels[1]=d.mealLabels[0], d=>d.body.bodyFat='101', d=>d.body.weight='NaN']) {
    const s=accountFixture('profile'), before=structuredClone(s.saved); mutate(s.draft);assert.throws(()=>commitProfile(s));assert.deepEqual(s.saved,before);
  }
});
test('canonical mass and calorie values survive unit-preference changes', () => {
  const s=accountFixture('profile'), body=structuredClone(s.saved.body), calories=structuredClone(s.saved.calories);s.draft.units.weight='lbs';s.draft.units.energy='kJ';commitProfile(s);assert.deepEqual(s.saved.body,body);assert.deepEqual(s.saved.calories,calories);
});
test('TDEE matches existing equation and offsets without changing protein', () => {
  const d=defaultProfile();assert.equal(tdeeEstimate(d),2734);applyTdee(d);assert.deepEqual(d.calories,{Cut:'2334',Maintain:'2734',Bulk:'3034'});assert.equal(d.protein,'170');
});
test('incomplete TDEE input produces no estimate and cannot apply', () => {
  for (const mutate of [d=>d.tdee.age='',d=>d.tdee.height='99',d=>d.body.weight='',d=>d.body.weight='abc']) {const d=defaultProfile();mutate(d);assert.equal(tdeeEstimate(d),null);assert.throws(()=>applyTdee(d));}
});
test('consent and permissions are independent from stored record timestamps', () => {
  const s=accountFixture('profile'), records=[s.health.savedSleep,s.health.savedBody];s.health.consent=false;assert.equal(healthStatus(s.health),'Not connected');assert.deepEqual([s.health.savedSleep,s.health.savedBody],records);
  s.health.consent=true;s.health.sleep=false;s.health.body=false;assert.equal(healthStatus(s.health),'Permission needed');s.health.body=true;assert.equal(healthStatus(s.health),'Connected');s.health.available=false;assert.equal(healthStatus(s.health),'Unavailable on this device');
});
test('sleep preference precision matches existing Profile storage',()=>{const s=accountFixture('profile');s.draft.sleepTarget='7.54';commitProfile(s);assert.equal(s.saved.sleepTarget,'7.5');});
test('all four body metrics accept independent edits and preserve saved values until commit', () => {
  const s = accountFixture('profile');
  const before = structuredClone(s.saved.body);
  Object.assign(s.draft.body, { weight: '81.25', bodyFat: '18.1', lean: '66.54', skeletal: '36.2' });
  assert.deepEqual(s.saved.body, before);
  commitProfile(s);
  assert.equal(s.saved.body.lean, '66.54');
  assert.equal(s.saved.body.skeletal, '36.2');
});
test('removed Profile controls are not exposed as selectable review states', () => {
  assert.ok(!profileStates.some(([id]) => ['goal', 'meals'].includes(id)));
});
test('restore copy exactly matches the native source', () => {
  const source=readFileSync(new URL('../../src/billing/restoreFlow.ts',import.meta.url),'utf8');for(const message of Object.values(restoreMessages))assert.ok(source.includes(JSON.stringify(message)),message);
});
test('no active paid purchase does not revoke a manual Premium grant', () => { const s=accountFixture('settings','notFound');assert.equal(s.access,true);assert.equal(s.paid,false);assert.equal(s.feedback,restoreMessages.notFound); });
test('development build never masquerades as paid Play subscription',()=>{const s=accountFixture('settings','dev');assert.equal(s.dev,true);assert.equal(s.paid,false);});
test('all review states are unique and construct without mutating defaults',()=>{for(const [page,states]of [['profile',profileStates],['settings',settingsStates]]){assert.equal(new Set(states.map(row=>row[0])).size,states.length);for(const [id]of states)assert.equal(accountFixture(page,id).id,id);}assert.equal(defaultProfile().name,'Daniel');});

test('steps access is independent of other permissions and record availability', async () => {
  const { stepsAccessStatus } = await import('./account-model.mjs');
  const stepsOnly = accountFixture('profile', 'activity-only');
  assert.equal(stepsOnly.health.sleep, false);
  assert.equal(stepsOnly.health.body, false);
  assert.equal(healthStatus(stepsOnly.health), 'Connected');
  assert.equal(stepsAccessStatus(stepsOnly.health), 'Ready');
  assert.equal(stepsOnly.health.lastActivitySync, null);
  const missing = accountFixture('profile', 'activity-permission');
  assert.equal(healthStatus(missing.health), 'Connected');
  assert.equal(stepsAccessStatus(missing.health), 'Not allowed');
  missing.health.available = false;
  assert.equal(stepsAccessStatus(missing.health), 'Unavailable');
  assert.equal(stepsAccessStatus(accountFixture('profile', 'activity-connect').health), 'Not connected');
});
