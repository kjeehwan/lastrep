import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './model.mjs';
import { setupUnified } from './unified-plan.mjs';
import { socialState } from './sharing-social.mjs';
import { sharingState } from './sharing.mjs';
import { ensurePrograms } from './program-library.mjs';
import { handleEntry, renderWorkoutEntry, entryDialog } from './workout-entry.mjs';
import { workoutPlanPreview } from './sharing.mjs';
import { programSharingStates, setupProgramSharing, snapshotProgram, importSharedProgram, handleProgramSharing, programSharingDialog } from './program-sharing.mjs';

function state(kind='receive') {
  const s={exercises:fixture(),social:socialState(),sharing:sharingState()};
  setupUnified(s,kind==='newuser'?'layout-minimal-today-newuser':'layout-minimal-today-entry');
  setupProgramSharing(s,`layout-minimal-program-share-${kind}`);return s;
}
test('snapshots share routine prescriptions, not run progress or personal records',()=>{
  const s=state();const record=ensurePrograms(s.unified)[0];record.days[0].completed=true;
  const snapshot=snapshotProgram(s,record);
  assert.equal(snapshot.days.length,7);assert.equal(snapshot.routines.length,5);
  assert.equal(snapshot.days[0].completed,undefined);assert.equal(snapshot.startedAt,undefined);
  const ex=snapshot.routines[0].plan[0];
  assert.ok(ex.targets);assert.equal(ex.previous,undefined);assert.equal(ex.notes,undefined);
  assert.ok(ex.sets.every(set=>set.done===undefined&&set.rpe===undefined));
});
test('saving creates independent routine identities and preserves active program and workout',()=>{
  const s=state(),u=s.unified;const active=u.activeProgramId,workout=structuredClone(s.exercises);
  handleProgramSharing(s,'ps-save');const saved=s.programSharing.saved;
  assert.notEqual(saved.id,active);assert.equal(u.activeProgramId,active);assert.deepEqual(s.exercises,workout);
  assert.equal(u.customRoutines.length,5);assert.ok(saved.days.filter(day=>!day.rest).every(day=>u.customRoutines.some(routine=>routine.id===day.routineId)));
  const sourceWeight=s.programSharing.incoming.routines[0].plan[0].sets[0].weight;
  u.customRoutines[0].plannedExercises[0].sets[0].weight='999';
  assert.equal(s.programSharing.incoming.routines[0].plan[0].sets[0].weight,sourceWeight);
  const count=u.programs.length;handleProgramSharing(s,'ps-save');assert.equal(u.programs.length,count);
});
test('repeated routine assignments create one copy and name equality never determines identity',()=>{
  const s=state(),snapshot=structuredClone(s.programSharing.incoming);snapshot.days.push({...snapshot.days[0]});
  snapshot.routines[1].name=snapshot.routines[0].name;
  let id=0;const saved=importSharedProgram(s.unified,snapshot,()=>String(++id));
  assert.equal(s.unified.customRoutines.length,5);
  assert.equal(saved.days[0].routineId,saved.days.at(-1).routineId);
  assert.notEqual(saved.days[0].routineId,saved.days[1].routineId);
});
test('a new user saves all included routines, then explicitly confirms starting',()=>{
  const s=state('newuser');assert.equal(s.unified.programs.length,0);
  handleProgramSharing(s,'ps-save');assert.equal(s.unified.activeProgramId,null);
  handleProgramSharing(s,'ps-start');assert.equal(s.modal,'ps-start');assert.equal(s.unified.activeProgramId,null);
  handleProgramSharing(s,'ps-start-confirm');assert.equal(s.unified.activeProgramId,s.programSharing.saved.id);assert.equal(s.unified.today,0);
});
test('switching programs keeps the existing workout untouched',()=>{
  const s=state();s.exercises=fixture();const workout=structuredClone(s.exercises);
  handleProgramSharing(s,'ps-save');const before=s.unified.activeProgramId;
  handleProgramSharing(s,'ps-start');assert.equal(s.unified.activeProgramId,before);
  handleProgramSharing(s,'ps-start-confirm');assert.notEqual(s.unified.activeProgramId,before);assert.deepEqual(s.unified.savedWorkout.exercises,workout);assert.equal(s.exercises.length,0);
});
test('multi-recipient delivery is a frozen snapshot and respects omitted weights',()=>{
  const s=state('send');handleProgramSharing(s,'ps-weights');
  handleProgramSharing(s,'ps-select',{person:'maya'});handleProgramSharing(s,'ps-select',{person:'alex'});handleProgramSharing(s,'ps-deliver');
  const sent=s.programSharing.sent[0];assert.deepEqual(sent.recipients.map(person=>person.name),['Alex','Maya']);
  assert.ok(sent.snapshot.routines.flatMap(routine=>routine.plan).flatMap(ex=>ex.sets).every(set=>set.weight===''));
  s.programSharing.snapshot.name='Changed later';assert.notEqual(sent.snapshot.name,'Changed later');
});
test('accepting a request adds it to the mixed inbox without importing it',()=>{
  const s=state('requests'),count=s.unified.programs.length;
  handleProgramSharing(s,'ps-accept',{id:'request-program'});
  assert.equal(s.programSharing.requests.length,0);assert.equal(s.programSharing.inbox[0].title,'Upper / Lower');assert.equal(s.unified.programs.length,count);
  handleProgramSharing(s,'ps-receive-open',{id:'request-program'});handleProgramSharing(s,'ps-save');assert.equal(s.programSharing.saved.name,'Upper / Lower');
});
test('every review state renders a nonempty dialog and has unique navigation controls',()=>{
  const shell=(title,body,footer)=>`<section class="sheet "><h2>${title}</h2>${body}${footer}</section>`;
  for(const [,id] of programSharingStates){const s=state(id.split('-').at(-1));const html=programSharingDialog(s,{shell});assert.ok(html.includes('ps-sheet'));assert.ok(!html.includes('undefined'));}
  const s=state('send');handleProgramSharing(s,'ps-search');
  assert.ok(!programSharingDialog(s,{shell}).includes('data-person="alex"'));
  s.programSharing.query='al';const html=programSharingDialog(s,{shell});
  assert.ok(html.includes('Alex'));assert.ok(!html.includes('data-person="ben"'));
});

test('continue imported program loads its prescribed sets and keeps the prior workout resumable',()=>{
  const s=state(),before=structuredClone({title:s.title,exercises:s.exercises});
  assert.ok(before.exercises.length);
  handleProgramSharing(s,'ps-save');handleProgramSharing(s,'ps-start-confirm');
  handleEntry(s,'we-continue',{});
  assert.equal(s.title,'Chest + Triceps');assert.equal(s.exercises.length,3);
  assert.equal(s.exercises[0].sets.filter(row=>row.type!=='warmup').length,3);
  assert.equal(s.exercises[0].sets[1].weight,'80');
  assert.deepEqual(s.exercises[0].targets,{min:6,max:8,rpe:8});
  assert.deepEqual(s.unified.savedWorkout.exercises,before.exercises);
  handleEntry(s,'we-resume-saved',{});
  assert.equal(s.title,before.title);assert.deepEqual(s.exercises,before.exercises);
  assert.equal(s.unified.sessionMode,'single');
  assert.equal(s.unified.savedWorkout.title,'Chest + Triceps');
});

test('continue from imported program details loads the same sets without replacing the prior workout',()=>{
  const s=state();const before=structuredClone(s.exercises);
  handleProgramSharing(s,'ps-save');handleProgramSharing(s,'ps-start-confirm');handleProgramSharing(s,'ps-view-saved');
  handleEntry(s,'we-program-activate',{});
  assert.equal(s.exercises[0].name,'Bench press');assert.equal(s.exercises[0].sets[1].weight,'80');
  assert.deepEqual(s.unified.savedWorkout.exercises,before);
});

test('one resume entry opens a picker with separate and program workout identities',()=>{
  const s=state();handleProgramSharing(s,'ps-save');handleProgramSharing(s,'ps-start-confirm');handleEntry(s,'we-continue',{});
  const html=renderWorkoutEntry(s);assert.equal((html.match(/data-action="we-resume"/g)||[]).length,1);assert.ok(!html.includes('Resume saved workout'));
  const before=structuredClone(s.exercises);handleEntry(s,'we-resume',{});assert.equal(s.modal,'we-resume-picker');assert.deepEqual(s.exercises,before);
  const shell=(title,body,footer)=>title+body+footer,button=(label,action)=>`<button data-action="${action}">${label}</button>`;
  const picker=entryDialog(s,{shell,button});assert.match(picker,/7-day strength split · Day 1/);assert.match(picker,/Back \+ Biceps/);assert.match(picker,/Separate workout/);
  handleEntry(s,'we-resume-saved',{});assert.equal(s.title,'Back + Biceps');assert.equal(s.unified.sessionMode,'single');
});

test('routine preview groups identical working sets but preserves different warm-up prescriptions',()=>{
  const s=state(),plan=s.programSharing.incoming.routines[0].plan;
  const html=workoutPlanPreview({plan,weights:true},String).exercises;
  assert.match(html,/Warm-up · 20 kg × 4 reps<br>3 sets · 8 reps · 80 kg/);
  const mixed=structuredClone(plan);mixed[0].sets[2].reps='6';
  const changed=workoutPlanPreview({plan:mixed,weights:true},String).exercises;
  assert.match(changed,/Set 2 · 80 kg × 6 reps/);assert.ok(!changed.includes('3 sets · 8 reps · 80 kg'));
});
