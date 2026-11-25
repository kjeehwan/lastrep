import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTopBackoff, topBackoffReview, applyTopBackoff, undoTopBackoff, handleTopBackoff, groupTargets, targetGroups } from './top-backoff.mjs';
import { setDisplayRows } from './warmup.mjs';
const fixture=(suffix='')=>{const s={};setupTopBackoff(s,'layout-minimal-top-backoff'+suffix);return s;};
test('reviews top and back-off sets independently',()=>{const s=fixture(),groups=topBackoffReview(s).groups;assert.deepEqual(groups[0].change,{weight:'132.5',reps:'6'});assert.equal(groups[1].change,null);});
test('applying selected groups preserves warm-ups, back-offs and recorded effort',()=>{const s=fixture();s.exercises[0].sets.unshift({type:'warmup',weight:'60',reps:'5',rpe:'',done:true});const before=structuredClone(s.exercises);assert.equal(applyTopBackoff(s),true);assert.deepEqual(s.exercises[0].sets[0],before[0].sets[0]);assert.deepEqual(s.exercises[0].sets.slice(2),before[0].sets.slice(2));assert.equal(s.exercises[0].sets[1].rpe,'');assert.equal(undoTopBackoff(s),true);assert.deepEqual(s.exercises,before);});
test('back-off target override can qualify independently of the top set selection',()=>{const s=fixture();s.topBackoff.targets.backoff.rpe=9;s.topBackoff.selected.top=false;assert.equal(applyTopBackoff(s),true);assert.equal(s.exercises[0].sets[0].weight,'130');assert.deepEqual(s.exercises[0].sets.slice(1).map(row=>row.reps),['10','10']);});
test('deselecting the only qualifying change does not apply anything',()=>{const s=fixture(),before=structuredClone(s.exercises);s.topBackoff.selected.top=false;assert.equal(applyTopBackoff(s),false);assert.deepEqual(s.exercises,before);});
test('missing history, recovery holds, recording and mixed arrangements block increases',()=>{for(const suffix of ['-history','-recovery','-recording'])assert.equal(topBackoffReview(fixture(suffix)).groups.some(group=>group.change),false);const s=fixture();s.exercises[0].sets[2].weight='105';assert.equal(applyTopBackoff(s),false);});
test('undo does not overwrite subsequent user edits',()=>{const s=fixture();applyTopBackoff(s);s.exercises[0].sets[1].reps='9';assert.equal(undoTopBackoff(s),false);assert.equal(s.exercises[0].sets[1].reps,'9');});
test('target edits are staged and invalid effort cannot commit',()=>{const s=fixture();handleTopBackoff(s,'tb-edit-group',{group:'top'},'RPE');s.topBackoff.draft={...s.topBackoff.draft,min:'6',max:'8',effort:'20'};handleTopBackoff(s,'targets-done',{},'RPE');assert.equal(s.topBackoff.targets.top,null);assert.match(s.topBackoff.draft.error,/6 to 10/);assert.deepEqual(groupTargets(s,'top'),s.topBackoff.targets.default);});
test('role markers leave existing set markers unchanged',()=>{const s=fixture();assert.deepEqual(setDisplayRows(s.exercises[0]).map(row=>row.marker),['T','B','B']);assert.deepEqual(setDisplayRows({sets:[{type:'warmup'},{type:'normal'},{type:'drop'}]}).map(row=>row.marker),['W',1,'D']);});

test('role changes update target and review groups without rewriting history or values',()=>{
  const s=fixture(),before=structuredClone(s.exercises[0]),targets=structuredClone(s.topBackoff.targets);
  handleTopBackoff(s,'tb-role',{value:'normal'},'RPE');
  assert.deepEqual(targetGroups(s),['normal','backoff']);
  assert.deepEqual(topBackoffReview(s).groups.map(g=>g.role),['normal','backoff']);
  assert.equal(applyTopBackoff(s),false);
  assert.deepEqual(s.exercises[0].previous,before.previous);
  assert.deepEqual(s.topBackoff.targets,targets);
  assert.deepEqual(s.exercises[0].sets.map(({type,...values})=>values),before.sets.map(({type,...values})=>values));
  handleTopBackoff(s,'tb-role',{value:'top'},'RPE');
  assert.deepEqual(targetGroups(s),['top','backoff']);
  assert.ok(topBackoffReview(s).groups[0].change);
});

test('Normal mixed prescriptions and missing Normal history are explicit holds',()=>{
  const s=fixture();for(const row of s.exercises[0].sets)row.type='normal';
  assert.deepEqual(targetGroups(s),['normal']);
  assert.match(topBackoffReview(s).groups[0].reason,/Normal sets have mixed/);
  for(const row of s.exercises[0].sets)row.weight='130';
  assert.match(topBackoffReview(s).groups[0].reason,/No comparable Normal history/);
  s.exercises[0].previous=structuredClone(s.exercises[0].sets).map(row=>({...row,rpe:'8'}));
  assert.equal(applyTopBackoff(s),true);
  assert.ok(s.exercises[0].sets.every(row=>row.weight==='132.5'&&row.reps==='6'));
});

test('changing roles clears a stale applied review while retaining overrides',()=>{
  const s=fixture();applyTopBackoff(s);
  handleTopBackoff(s,'tb-role',{value:'normal'},'RPE');
  assert.equal(s.topBackoff.after,null);assert.equal(s.topBackoff.before,null);assert.equal(s.topBackoff.notice,'');
  assert.deepEqual(s.topBackoff.targets.backoff,{min:8,max:10,rpe:8});
});
