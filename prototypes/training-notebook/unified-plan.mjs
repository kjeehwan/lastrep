import { routineEditorHeader } from './program-routine-editor.mjs';
import { ensurePrograms } from './program-library.mjs';
import { initialProgramDays, routineById } from './unified-program.mjs';
import { renderWorkoutEntry, entryDialog, handleEntry, entryInput, entryRoutines } from './workout-entry.mjs';
import { renderProgramStrip, renderProgramDialog, handleProgram } from './unified-program-ui.mjs';
import { renderUnifiedChanges, renderMissingInputs, missingInputsInvalid } from './unified-review-ui.mjs';
import { createCheckInDraft, painValidation, writeCheckIn, readCheckIn } from './check-in.mjs';
import { fixture, exerciseFromCatalog, effortValue } from './model.mjs';
import { notebookIcon as icon } from './notebook-icons.mjs';
import { displayWeight, nextProgressPrescription, renderProgressOptions, beginProgressWeights } from './progression-settings.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => structuredClone(value);
const group = "Unified Today's Plan";
export const unifiedStates = [
  ['paused','Resume a saved program','Preview resuming Day 4 today, preserving completed days and excluding time away.'],
  ['entry','Workout choices / active program','Continue your program, create a new one, or train outside your program.'],
  ['newuser','Workout choices / new user','No program or routines are pre-made. Start workout or create your first program.'],
  ['resume','Workout choices / unfinished workout','Resume your unfinished workout or keep it while choosing another path.'],
  ['planned','Review planned workout','A single review combines exercise progression with today’s condition. Select individual changes, Apply, then Undo.'],
  ['empty','Plan from program','No workout is open. Preview the scheduled Chest + Triceps session before loading it.'],
  ['rest','Scheduled rest day','Day 3 is rest. Previewing other days leaves today and the current draft untouched.'],
  ['off','Program off / choose a routine','No program strip or invented schedule. Choose a saved routine before reviewing it.'],
  ['keep','Keep your plan','No justified changes. Keeping the planned workout is a complete result.'],
  ['recording','Workout in progress','Completed sets and sets with recorded effort are protected. Only untouched working sets may change.'],
  ['pain','Pain / separate review','Reported shoulder discomfort blocks automatic progression of pressing, even with otherwise positive recovery.'],
  ['missing','Missing today’s inputs','Yesterday’s check-in is not treated as today’s. Answer only the missing questions, or keep your plan.'],
  ['reset','Recent load reset','Old 90 kg performance is excluded after a recent reduction to 70 kg. Progress from the rebuilding baseline.'],
  ['deload','Consider a deload week','Repeated difficulty and recovery inputs support a sample seven-day deload. Week number alone does not trigger it.'],
  ['return','After a deload','Review the preserved normal prescription. Returning does not automatically increase loads.'],
  ['different','Different workout already open','The program schedules Chest + Triceps, but Back + Biceps is open. Review the open workout without replacing it.'],
].map(([key,title,description])=>[group,`layout-minimal-today-${key}`,`Today’s Plan / ${title}`,description]);

const normal = (weight,reps) => ({weight:String(weight),reps:String(reps),rpe:'',done:false,type:'normal'});
const protectedRow = row => row.done || String(row.rpe ?? '').trim() !== '';
const untouched = row => row.type !== 'warmup' && !protectedRow(row);
const signature = s => JSON.stringify({exercises:s.exercises,title:s.title,day:s.unified.today,days:s.unified.days,enabled:s.unified.enabled,inputs:s.unified.inputs,pain:s.unified.pain,painArea:s.unified.painArea,fatigue:s.unified.highFatigue,ratings:s.ratings,activity:s.activity,note:s.note,shift:s.unified.shiftDays});
export function unifiedRoutine(routineId = 'chest-barbell',records) {
  const record=records?records.find(r=>r.id===routineId):routineById(routineId);if(!record)return [];
  if(record.plannedExercises)return clone(record.plannedExercises);
  const ids=record.exercises;
  const names={'dumbbell-curl':'Dumbbell curl',squat:'Barbell squat','leg-press':'Leg press','dumbbell-bench':'Dumbbell bench press','romanian-deadlift':'Romanian deadlift','shoulder-press':'Dumbbell shoulder press'};
  return ids.map(id=>{
    const e = fixture().find(item=>item.id===id) ?? exerciseFromCatalog(id,names[id]);
    const bench=id==='bench', weight=bench?80:id==='fly'?20:35, reps=bench?8:12;
    e.tempo='3-0-1-0';e.unit='kg';e.targets={min:bench?6:12,max:bench?8:18,rpe:8};e.notes='';
    e.previous=Array.from({length:3},()=>({...normal(weight,reps),rpe:'8'}));
    e.sets=[...(bench?[{...normal(20,4),type:'warmup'}]:[]),...Array.from({length:3},()=>normal(weight,reps))];
    e.availableWeights={mode:'regular',unit:'kg',minimum:bench?20:5,increment:2.5};
    e.progressOptions={repSteps:[6,8,10,12,15,18],preferredIncreaseKg:bench?5:null,weightIncreaseKg:bench?10:2.5};
    return e;
  });
}
export function setupUnified(s,id) {
  const kind=id.split('-').at(-1);
  s.exercises=unifiedRoutine();s.title='Chest + Triceps';s.source=s.title;s.date='Thu, Oct 29';s.elapsed=0;
  s.unified={kind,enabled:kind!=='off',today:kind==='rest'?2:0,preview:0,days:initialProgramDays().map((day,index)=>({...day,completed:kind==='rest'&&index<2})),inputs:kind==='missing'?'yesterday':'today',pain:kind==='pain',painArea:kind==='pain'?'shoulder':null,status:'none',expanded:[],unchanged:false,changes:[],selected:[],declined:[],trainingWeek:kind==='deload'?6:3,dietWeek:kind==='deload'?7:4,notice:'',deloadActive:false,deloadDeclined:false};
  Object.assign(s.unified,{programName:'7-day program',programStartedAt:kind==='rest'?'2026-10-13':'2026-10-15',dateKey:kind==='return'?'2026-11-05':'2026-10-29',shiftFrom:Infinity,shiftDays:0,pausedToday:false,activeRoutineId:kind==='different'?'back':['empty','rest','off'].includes(kind)?null:'chest-barbell'});
  s.unified.templateDays=clone(s.unified.days);
  s.unified.preview=s.unified.today;
  Object.assign(s.unified,{entryScreen:['entry','newuser','resume','paused'].includes(kind),sessionMode:'program',newUser:kind==='newuser',customRoutines:[]});
  if(kind==='newuser'){s.unified.enabled=false;s.unified.days=[];s.unified.templateDays=[];s.unified.programName='';}
  if(kind==='pain')Object.assign(s,{pain:'Shoulder',painSide:'Both',painSeverity:'Mild',painTrigger:'Pressing'});
  if(['empty','rest','off','entry','newuser','paused'].includes(kind)){s.exercises=[];s.title='';s.source='';s.unified.activeRoutineId=null;}
  if(kind==='paused'){s.date='Mon, Nov 2';s.unified.dateKey='2026-11-02';ensurePrograms(s.unified);s.unified.programs.push({id:'previous-program',status:'saved',name:'Previous 7-day program',startedAt:'2026-10-01',scheduleDateKey:'2026-10-15',today:3,days:initialProgramDays().map((day,index)=>({...day,completed:index<3})),templateDays:initialProgramDays(),shiftDays:0,shiftFrom:Infinity,pausedToday:false});}
  if(kind==='different'){s.title='Back + Biceps';s.source=s.title;s.exercises=unifiedRoutine('back');}
  if(kind==='recording'){s.exercises[0].sets[1].done=true;s.exercises[0].sets[1].rpe='8';s.exercises[0].sets[2].rpe='8.5';}
  if(kind==='reset'){s.exercises[0].previous.forEach(row=>row.weight='70');s.exercises[0].sets.filter(row=>row.type!=='warmup').forEach(row=>row.weight='70');}
  if(kind==='return'){s.date='Thu, Nov 5';s.unified.trainingWeek=7;s.unified.dietWeek=8;}
  s.selectedId=s.exercises[0]?.id ?? 'bench';s.modal='';
}

export function unifiedHeader(s,{button},empty=false) {
  const u=s.unified, scheduled=u.days[u.today];
  if(u.routineEditor)return routineEditorHeader(s);
  if(u.entryScreen)return renderWorkoutEntry(s);
  const rows=s.exercises.filter(e=>e.mode!=='cardio').flatMap(e=>e.sets.map(row=>({...row,unit:e.unit})));
  const volume=Math.round(rows.reduce((total,row)=>total+(Number(row.weight)||0)*(Number(row.reps)||0)/(row.unit==='lbs'?2.2046226218:1),0));
  const recommendation=u.status==='stale'?'Review updated workout':u.status==='applied'?'View changes':s.exercises.length?'Review workout':'Plan today’s workout';
  return `<section class="session-heading layout-heading up-heading">${u.sessionMode==='single'?'':renderProgramStrip(s)}<div class="date-row"><span class="supporting">${s.date}</span>${s.exercises.length?'<span class="supporting">00:00</span>':''}</div>${empty?`<h1 class="editorial">${u.sessionMode==='single'?'Your workout':u.enabled?u.pausedToday?'Program resumes tomorrow':scheduled.skipped?'Session skipped':scheduled.rest?'Scheduled rest day':esc(scheduled.title):'Your next session'}</h1>`:`<div class="editable-session-title"><input data-session-title aria-label="Workout title" value="${esc(s.title)}" maxlength="100"><button class="icon-button" data-action="edit-session-title" aria-label="Edit workout title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 16 12-12 4 4L8 20H4v-4ZM14 6l4 4"/></svg></button></div>`}<div class="minimal-session-meta"><a href="./profile.html#training" class="supporting phase-link">Hypertrophy · Week ${u.trainingWeek} ${icon('down')}</a>${rows.length?`<span class="minimal-stats">&middot; ${rows.length} sets &middot; ${volume.toLocaleString('en-US')} kg</span>`:''}</div>${u.sessionMode!=='single'&&u.enabled&&s.exercises.length&&u.activeRoutineId!==scheduled.routineId?`<p class="supporting">Scheduled: Day ${u.today+1} · ${esc(scheduled.title)}</p>`:''}${u.deloadActive?'<p class="up-note">Deload · Oct 29–Nov 4</p>':''}${u.deloadActive&&u.deloadAfter===signature(s)?button('Undo deload','up-deload-undo'):''}<div class="up-plan-entry"><div><span class="up-entry-title">Today’s Plan</span><button class="icon-button" data-action="up-help" aria-label="About Today’s Plan">${icon('info')}</button></div>${button(recommendation,'up-review')}</div>${u.notice?`<p class="supporting" role="status">${esc(u.notice)}</p>`:''}${u.status==='applied'&&u.after===signature(s)?button('Undo changes','up-undo'):''}</section>`;
}

function discomfortAffects(s,e) {
  const u=s.unified;if(!u.pain)return false;
  if(!u.painArea)return true;
  const patterns={shoulder:/press|fly|raise|row|pull/i,elbow:/press|push|pull|curl|row/i,'wrist / hand':/press|push|pull|curl|row|deadlift/i,knee:/squat|leg press|leg extension|run/i,'hip / groin':/squat|deadlift|hip|lunge/i,'lower back':/deadlift|squat|row/i,'upper back':/row|pull|deadlift/i,'ankle / foot':/calf|squat|run/i};
  return patterns[u.painArea]?.test(e.name)??true;
}
function buildChanges(s) {
  const u=s.unified;
  if(u.inputs!=='today')return [];
  return s.exercises.flatMap(e=>{
    const rows=e.sets.filter(untouched);if(!rows.length)return [];
    if(discomfortAffects(s,e))return [{id:e.id,name:e.name,manual:true,before:'Planned sets',after:'Review this exercise',reason:`${s.painSeverity||'Reported'} ${u.painArea||'unspecified'} discomfort${s.painTrigger?` during ${s.painTrigger.toLowerCase()}`:''}. Automatic progression is withheld regardless of other recovery inputs.`}];
    if(['keep','return','different','deload'].includes(u.kind)||u.deloadActive)return [];
    if(u.highFatigue||u.highSoreness)return [];
    if(e.id==='pushdown')return [];
    const previousRows=e.previous.filter(row=>row.type!=='warmup');
    if(!e.targets || !previousRows.length || previousRows.some(row=>!row.rpe || Number(row.rpe)>e.targets.rpe || Number(row.reps)<e.targets.min))return [];
    if(new Set(previousRows.map(row=>`${row.weight}/${row.reps}`)).size>1 || new Set(e.sets.filter(row=>row.type!=='warmup').map(row=>`${row.weight}/${row.reps}`)).size>1)return [];
    if(rows.some(row=>row.weight!==previousRows[0].weight || row.reps!==previousRows[0].reps))return [];
    const p={kind:previousRows.every(row=>Number(row.reps)>=e.targets.max)?'weight':'reps',options:e.progressOptions};
    const next=nextProgressPrescription(e,p), previous=e.previous[0];
    if(next.type==='unavailable')return [];
    if(e.sets.some(row=>row.type!=='warmup'&&String(row.rpe??'').trim()!==''&&Number(row.rpe)>e.targets.rpe))return [];
    const weight=displayWeight(next.weightKg,e.unit);
    return [{id:e.id,name:e.name,weight:String(weight),reps:String(next.reps),before:`${rows.length} × ${rows[0].reps} at ${rows[0].weight} ${e.unit}`,after:`${rows.length} × ${next.reps} at ${weight} ${e.unit}`,reason:u.kind==='reset'&&e.id==='bench'?'Recent sessions rebuild from 70 kg. The older 90 kg result predates the load reduction and is excluded.':p.kind==='weight'?`All 3 previous working sets reached ${previous.reps} reps within target effort. Try an available increase and return to ${e.targets.min} reps.`:'All 3 previous working sets met the rep and effort goal. Try the next step in your rep sequence.'}];
  }).filter(change=>change.manual||!u.declined.includes(change.id));
}
function review(s) {
  const u=s.unified;
  if(u.status==='applied'&&u.after===signature(s)){s.modal='up-review';return;}
  u.changes=buildChanges(s);u.selected=u.changes.filter(c=>!c.manual).map(c=>c.id);u.status='review';u.reviewSignature=signature(s);s.modal='up-review';
}
export function syncUnifiedRecovery(s,confirmToday=false) {
  const u=s.unified;if(!u)return;
  u.pain=Boolean(s.pain&&s.pain!=='None');u.painArea=u.pain?s.pain.toLowerCase():null;
  u.highFatigue=Number(s.ratings.fatigue)>=7;u.highSoreness=Number(s.ratings.soreness)>=7;
  const complete=Object.values(s.ratings).every(value=>value!=='')&&Boolean(s.pain);
  if(!complete)u.inputs='partial';else if(confirmToday)u.inputs='today';
}
export function invalidateUnified(s) {
  if(!s.unified)return;
  if(['review','applied'].includes(s.unified.status)){s.unified.status='stale';s.unified.notice='Your workout changed. Review it again before applying advice.';}
}
function phaseContext(s) {return `<p class="supporting">Hypertrophy · Week ${s.unified.trainingWeek}<br>Bulk · Week ${s.unified.dietWeek}</p>`;}
export function unifiedDialog(s,scale,{shell,button}) {
  const u=s.unified, b=(label,action,kind='text',data={},disabled=false)=>button(label,action,kind,data,disabled), stack=body=>`<div class="up-stack">${body}</div>`;
  const entryContent=entryDialog(s,{shell,button});if(entryContent)return entryContent;
  const programContent=renderProgramDialog(s,{shell,button,routine:id=>unifiedRoutine(id,entryRoutines(u)),phase:phaseContext,effortScale:scale});if(programContent)return programContent;
  switch(s.modal){
    case 'up-help':return shell('About Today’s Plan',stack('<p>Plan your scheduled session or review the workout already open.</p><p>Exercise targets and recent performance inform progression. Today’s inputs can hold back an increase or change the session.</p><p class="supporting">Only selected changes are applied. Program days and recorded sets stay intact.</p>'),b('Done','close','primary'));
    case 'up-inputs':return renderMissingInputs(s,{shell,button});
    case 'up-basis':{
      const rating=(label,key)=>`<span>${label}: ${s.ratings[key]===''?'Not recorded':esc(s.ratings[key])+'/10'}</span>`;
      const checkInDate=u.inputs==='today'?'Today · '+u.dateKey.slice(5).replace('-','/') : u.inputs==='yesterday'?'Yesterday':'Incomplete';
      const pain=u.pain?[s.pain??u.painArea,s.painSide,s.painSeverity,s.painTrigger].filter(Boolean).map(esc).join(' · '):'No pain or discomfort reported';
      return shell('Review context',stack(`<section class="up-context-section"><h3>Recovery check-in</h3><p class="supporting">${checkInDate}</p><div class="supporting up-recovery-summary">${rating('Soreness','soreness')}${rating('Fatigue','fatigue')}${rating('Motivation','motivation')}</div><p class="supporting">${pain}</p>${b('Edit recovery check-in'+icon('right'),'up-inputs','up-edit-checkin')}</section><section class="up-context-section"><h3>Recent performance</h3><p class="supporting">Last 3 comparable completed sessions within 6 weeks.</p><p class="supporting">Matches exercise variation, equipment and working-set count. Excludes warm-ups and mixed prescriptions.</p>${u.kind==='reset'?'<p class="supporting">Earlier 90 kg results predate the load reduction. Only rebuilding sessions are considered.</p>':''}</section><section class="up-context-section"><h3>Training context</h3>${phaseContext(s)}<p class="supporting">Phase weeks alone do not trigger a deload. Sleep and nutrition are sample inputs in this mockup.</p></section>`),b('Back to review','up-back','primary'));
    }
    case 'up-deload':return shell('Deload week',stack(`<h3>Consider a lighter week</h3><p>Recent sessions repeatedly exceeded target effort, alongside persistent fatigue in this example.</p>${phaseContext(s)}<section class="up-preview"><h4>Oct 29–Nov 4 · 7 days</h4><p>Keep your scheduled routines and rest days.</p><p>3 working sets → 2 per exercise</p><p class="supporting">Keep current loads; aim for ${scale} ${effortValue(7,scale)} or easier. Adjust manually if needed.</p></section><p class="supporting">Normal routine prescriptions stay saved. On Nov 5, review your return without an automatic load increase.</p>`),b('Use deload week','up-deload-apply','primary')+b('Keep normal plan','up-deload-decline'));
    case 'up-review':{
      if(u.status==='stale'||u.status==='review'&&u.reviewSignature!==signature(s))return shell('Today’s Plan',stack('<h3>Review updated workout</h3><p>Your workout or inputs changed. Previous suggestions can no longer be applied.</p>'),b('Update review','up-update','primary')+b('Back to workout','close'));
      if(u.status==='applied')return shell('Today’s Plan',stack('<h3>Selected changes applied</h3><p class="supporting">Unselected exercises, warm-ups and recorded sets are preserved.</p>'),(u.after===signature(s)?b('Undo changes','up-undo'):'')+b('Back to workout','close','primary'));
      if(!s.exercises.length&&(u.sessionMode==='single'||!u.enabled))return shell('Today’s Plan',stack('<h3>Choose what to train</h3><p>Add exercises or choose a saved routine, then review the workout.</p>'),(entryRoutines(u).length?b('Choose a routine','up-choose','primary'):b('Add exercise','search','primary'))+b('Back to workout','close'));
      if(!s.exercises.length)return shell('Today’s Plan',stack(`<h3>${u.enabled&&u.pausedToday?'Program resumes tomorrow':u.enabled&&u.days[u.today].skipped?'Session skipped':u.enabled&&u.days[u.today].rest?'Scheduled rest day':u.enabled?'Plan today’s workout':'Choose what to train'}</h3>${phaseContext(s)}<p>${u.enabled?u.pausedToday?'Today is paused. Resume with the same routine tomorrow; later days shift forward.':u.days[u.today].skipped?'This session was skipped. Later days keep their dates.':u.days[u.today].rest?'Keep your scheduled rest day. No workout has been created.':`Day ${u.today+1} · ${esc(u.days[u.today].title)}`:'Choose a saved routine, or use Recommend from Workout.'}</p>`),u.enabled&&(u.pausedToday||u.days[u.today].rest||u.days[u.today].skipped)?b('Back to workout','close','primary'):b(u.enabled?'Preview scheduled workout':'Choose a routine',u.enabled?'up-preview-routine':'up-choose','primary',{'routine-id':u.days[u.today].routineId}));
      if(u.inputs!=='today')return shell('Today’s Plan',stack('<h3>Today’s check-in is incomplete</h3><p>Last check-in: yesterday, Oct 28. No increase is suggested from old or missing answers.</p>'+phaseContext(s)),b('Open recovery check-in','up-inputs','primary')+b('Keep my plan','up-keep'));
      const hasChanges=u.changes.length>0,hasAffected=u.changes.some(c=>c.manual),hasSuggestions=u.changes.some(c=>!c.manual),deload=u.kind==='deload'&&!u.deloadDeclined&&!hasAffected;
      const discomfortNote=u.pain?(hasAffected?'Flagged exercises are listed below. Open each for the reason; no automatic increase is suggested for them.':`No exercises were flagged by this mockup for your ${esc(u.painArea)} discomfort. This does not establish that they are pain-free or suitable today.`):'';
      return shell('Today’s Plan',stack(`<h3>${hasAffected?'Review affected exercises':deload?'Consider a lighter week':hasChanges?'Try the next prescription':u.pain?'No prescription changes':'Keep your plan'}</h3><p class="supporting">${esc(s.title)}${u.enabled&&u.sessionMode!=='single'?` · Day ${u.today+1}`:''}</p>${u.kind==='return'?'<p class="up-note">Deload complete. Review your preserved normal loads; no automatic increase.</p>':''}${u.kind==='recording'?'<p class="up-note">Recorded sets stay unchanged. Advice covers only untouched working sets.</p>':''}${discomfortNote?`<p class="up-note">${discomfortNote}</p>`:''}${u.highFatigue||u.highSoreness?'<p class="up-note">Today’s soreness or fatigue holds back progression.</p>':''}${deload?'<p>Repeated high effort and persistent fatigue support reviewing a seven-day deload.</p>':hasChanges?renderUnifiedChanges(s,scale):'<p>No prescription changes are suggested from the available performance and recovery inputs.</p>'}<div class="up-context">${b('Review context'+icon('right'),'up-basis','up-context-row')}</div>${u.pain?'<p class="supporting">This review does not establish readiness after injury.</p>':''}`),deload?b('Preview deload week','up-deload','primary')+b('Keep normal plan','up-deload-decline'):hasSuggestions?b('Apply selected changes','up-apply','primary',{},!u.selected.length)+b('Keep my plan','up-keep'):b('Back to workout','close','primary'));
    }
    case 'up-settings':return shell('Progression settings',stack(`<h3>${esc(s.exercises.find(e=>e.id===s.progression.id)?.name)}</h3>${renderProgressOptions(s.exercises.find(e=>e.id===s.progression.id),s.progression)}`),s.progression.editOption?b('Update suggestion','progression-save-options','primary')+b('Cancel edit','progression-cancel-options'):b('Done','up-settings-done','primary'));
    default:return null;
  }
}

export function unifiedInput(s,el) {
  const u=s.unified;if(!u)return false;
  if(u.routineEditor){u.routineEditor.error='';document.querySelector('.interactive .routine-editor-error')?.remove();}
  const result=entryInput(s,el);if(result)return result;
  if(el.hasAttribute('data-up-program-title')){u.programNameDraft=el.value;u.programNameError='';return 'live';}
  if(s.modal==='up-inputs'&&el.dataset.rating){u.inputDraft.ratings[el.dataset.rating]=Number(el.value);const output=document.querySelector('.interactive #rating-'+el.dataset.rating);if(output)output.textContent=el.value+'/10';el.setAttribute('aria-valuetext',el.value+' out of 10');const save=document.querySelector('.interactive [data-action="up-save-inputs"]');if(save)save.disabled=missingInputsInvalid(u);return 'live';}
  if(s.modal==='up-inputs'&&el.dataset.draft){u.inputDraft[el.dataset.draft==='dailyNote'?'note':el.dataset.draft]=el.value;return 'live';}
  if(el.hasAttribute('data-up-pain-note')){u.inputDraft.painNote=el.value;return 'live';}
  if(el.hasAttribute('data-up-select')){const id=el.dataset.upSelect;u.selected=el.checked?[...new Set([...u.selected,id])]:u.selected.filter(value=>value!==id);return true;}
  if(el.hasAttribute('data-up-enabled')){u.enabled=el.checked;invalidateUnified(s);return true;}
  if(el.hasAttribute('data-up-target')){u.scheduleTarget=Number(el.value);return true;}
  return false;
}
export function handleUnified(s,action,d,scale) {
  const u=s.unified;if(!u)return false;
  const entryResult=handleEntry(s,action,d);if(entryResult)return entryResult;
  if(s.modal==='up-inputs'&&['pain','pain-detail'].includes(action)){if(action==='pain'){u.inputDraft.pain=d.value;u.inputDraft.painSide='';}else u.inputDraft[d.key]=d.value;u.inputError='';return true;}
  const programAction=handleProgram(s,action,d);if(programAction)return programAction;
  switch(action){
    case 'review-plan':case 'up-review':case 'up-update':review(s);return true;
    case 'up-help':case 'up-basis':case 'up-deload':s.modal=action;return true;
    case 'up-day':u.preview=Number(d.value);s.modal='up-day';return true;
    case 'up-back':s.modal='up-review';return true;
    case 'up-expand':u.expanded=u.expanded.includes(d.value)?u.expanded.filter(id=>id!==d.value):[...u.expanded,d.value];return true;
    case 'up-unchanged':u.unchanged=!u.unchanged;return true;
    case 'up-choose':s.modal='up-routines';return true;

    case 'up-load':if(s.exercises.length){u.notice='Keep or discard your open workout before loading another.';s.modal='';return true;}s.exercises=unifiedRoutine(u.proposalRoutineId,entryRoutines(u));s.title=u.proposalTitle;s.source=s.title;u.activeRoutineId=u.proposalRoutineId;s.selectedId=s.exercises[0].id;u.status='none';u.notice='Routine loaded. Review its prescriptions for today.';s.modal='';return true;
    case 'up-keep':u.declined=[...new Set([...u.declined,...u.changes.map(c=>c.id)])];u.notice='Your plan is unchanged.';u.status='none';s.modal='';return true;
    case 'up-inputs':u.checkInReturn=s.modal;u.inputDraft=createCheckInDraft(readCheckIn()??s);u.inputError='';s.modal='up-inputs';return true;
    case 'up-cancel-checkin':u.inputDraft=null;s.modal=u.checkInReturn||'up-review';return true;
    case 'up-save-inputs':if(missingInputsInvalid(u)){u.inputError=painValidation(u.inputDraft)||'Use whole ratings from 0 to 10, or leave them blank.';return true;}Object.assign(s,clone(u.inputDraft));writeCheckIn(s);syncUnifiedRecovery(s,true);review(s);return true;
    case 'up-apply':{
      if(u.status!=='review'||u.reviewSignature!==signature(s))return true;
      const changes=u.changes.filter(c=>u.selected.includes(c.id)&&!c.manual);if(!changes.length)return true;
      u.before=clone(s.exercises);
      s.exercises.forEach(e=>{const c=changes.find(c=>c.id===e.id);if(c)e.sets=e.sets.map(row=>untouched(row)?{...row,weight:c.weight,reps:c.reps}:row);});
      u.declined=[...new Set([...u.declined,...u.changes.filter(c=>!u.selected.includes(c.id)).map(c=>c.id)])];
      u.status='applied';u.after=signature(s);u.notice='Selected changes applied.';s.modal='';return true;
    }
    case 'up-undo':if(u.status==='applied'&&u.after===signature(s)){s.exercises=clone(u.before);u.status='none';u.notice='Changes undone.';}s.modal='';return true;
    case 'up-schedule-open':u.scheduleMode='skip';u.scheduleTarget=u.days.findIndex((day,index)=>index!==u.preview&&day.rest);s.modal='up-schedule';return true;
    case 'up-schedule-mode':u.scheduleMode=d.value;u.scheduleTarget=u.days.findIndex((day,index)=>index!==u.preview&&(d.value!=='move'||day.rest));return true;
    case 'up-schedule-cancel':s.modal='up-day';return true;
    case 'up-schedule-apply':{
      const from=u.preview,target=Number(u.scheduleTarget),a=u.days[from],b=u.days[target];
      if(a.rest)return true;
      if(u.scheduleMode==='shift'){if(u.pausedToday)return true;u.shiftFrom=u.preview;u.shiftDays+=1;u.pausedToday=true;u.days[from]={...a,skipped:false};u.status='stale';u.notice='Today is paused. The same routine resumes tomorrow; every later day shifts forward. Your open workout is unchanged.';s.modal='';return true;}
      if(u.scheduleMode==='skip')u.days[from]={...a,skipped:true};
      else if(b&&(u.scheduleMode!=='move'||b.rest)){u.days[target]={...a,completed:false,skipped:false};u.days[from]=u.scheduleMode==='move'?{routineId:null,title:'Rest',rest:true,completed:false,skipped:false}:{...b,completed:false,skipped:false};}
      invalidateUnified(s);u.notice='Schedule updated. Other days and your open workout are unchanged.';s.modal='';return true;
    }
    case 'up-deload-apply':u.deloadBefore={exercises:clone(s.exercises),active:u.deloadActive};s.exercises.forEach(e=>{const index=e.sets.findLastIndex(untouched);if(index>=0)e.sets.splice(index,1);if(e.targets)e.targets.rpe=7;});u.deloadActive=true;u.status='none';u.deloadAfter=signature(s);u.notice='Deload week applied. Normal prescriptions are preserved.';s.modal='';return true;
    case 'up-deload-undo':if(u.deloadAfter===signature(s)){s.exercises=clone(u.deloadBefore.exercises);u.deloadActive=u.deloadBefore.active;u.deloadDeclined=true;u.notice='Normal plan restored.';}return true;
    case 'up-deload-decline':u.deloadDeclined=true;u.declined=s.exercises.map(e=>e.id);u.status='none';u.notice='Normal plan kept. Deload suggestion dismissed.';s.modal='';return true;
    case 'up-settings-open':{const e=s.exercises.find(e=>e.id===s.selectedId);s.progression={id:e.id,options:clone(e.progressOptions ?? {repSteps:[6,8,10,12,15,18],preferredIncreaseKg:null,weightIncreaseKg:2.5}),kind:'weight',editOption:''};s.modal='up-settings';return true;}
    case 'up-settings-done':{const e=s.exercises.find(e=>e.id===s.progression.id);e.progressOptions=clone(s.progression.options);s.progression=null;invalidateUnified(s);s.modal='';return true;}
    case 'progression-weights':if(s.modal==='up-settings'){beginProgressWeights(s.exercises.find(e=>e.id===s.progression.id),s.progression,true);s.modal='weights';return true;}return false;
    case 'exercise-weights':{const e=s.exercises.find(e=>e.id===s.selectedId);s.progression={id:e.id,options:clone(e.progressOptions ?? {repSteps:[6,8,10,12,15,18],preferredIncreaseKg:null,weightIncreaseKg:2.5}),kind:'weight',editOption:''};beginProgressWeights(e,s.progression,false);s.modal='weights';return true;}
    case 'up-review-settings':s.selectedId=d.id;return handleUnified(s,'up-settings-open',d,scale);
    case 'progression-save-options':return false;
    default:return false;
  }
}
