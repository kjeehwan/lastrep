const copy=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields=['title','source','exercises','selectedId','page','selected','keyboard','keyboardAlpha','rest','builder','plan','planBefore','planAfter','progression','targetDraft','warmup','undoSet','elapsed','clockStart'];
const unifiedFields=['entryScreen','sessionMode','activeRoutineId','status','notice','expanded','changes','selected','declined'];
export function beginProgramRoutine(s){
 const u=s.unified,editor={state:{},unified:{}};
 for(const key of fields)editor.state[key]=copy(s[key]);
 for(const key of unifiedFields)editor.unified[key]=copy(u[key]);
 u.routineEditor=editor;u.entryScreen=false;u.sessionMode='single';u.status='none';u.notice='';
 Object.assign(s,{title:'',source:'',exercises:[],selectedId:'',page:'workout',selected:[],keyboard:false,rest:null,builder:true,modal:'',elapsed:0,clockStart:null});
}
function restore(s){const u=s.unified,editor=u.routineEditor;Object.assign(s,editor.state);Object.assign(u,editor.unified);u.routineEditor=null;s.keyboard=false;s.modal='we-assign';}
export function routineEditorHeader(s){
 return `<section class="session-heading layout-heading up-heading"><div class="editable-session-title"><input data-session-title aria-label="Routine name" placeholder="Name your routine" maxlength="100" value="${esc(s.title)}"><button class="icon-button" data-action="edit-session-title" aria-label="Edit routine name"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 16 12-12 4 4L8 20H4v-4ZM14 6l4 4"/></svg></button></div>${s.unified.routineEditor.error?`<p class="form-error routine-editor-error" role="alert">${esc(s.unified.routineEditor.error)}</p>`:''}</section>`;
}
export function routineEditorDialog(s,{shell,button}){
 if(s.modal!=='we-routine-discard')return null;
 return shell('Discard routine draft?','<p>Your program setup and unfinished workout will stay unchanged.</p>',button('Keep editing','close','primary')+button('Discard draft','we-routine-discard-confirm','danger'));
}
export function handleProgramRoutine(s,action,d){
 const u=s.unified;if(!u.routineEditor)return false;
 if(action==='home'){if(s.exercises.length||s.title.trim())s.modal='we-routine-discard';else restore(s);return true;}
 if(action==='we-routine-discard-confirm'){restore(s);return true;}
 if(action==='open'&&d.modal==='finish'){
  const invalid=s.exercises.some(e=>e.sets.some(row=>['weight','reps'].some(key=>row[key]!==''&&(!Number.isFinite(Number(row[key]))||Number(row[key])<0||key==='reps'&&!Number.isInteger(Number(row[key]))))));
  if(!s.title.trim()||!s.exercises.length||invalid){u.routineEditor.error=invalid?'Check the set weights and whole-number reps.':'Name your routine and add at least one exercise.';s.keyboard=false;return true;}
  const exercises=copy(s.exercises).map(e=>({...e,previous:[],sets:e.sets.map(row=>({...row,done:false,rpe:''}))}));
  const r={id:'local-'+crypto.randomUUID(),name:s.title.trim(),exercises:exercises.map(e=>e.id),plannedExercises:exercises,detail:exercises.map(e=>e.name).join(' · ')};
  (u.customRoutines??=[]).push(r);const day=u.newDay;restore(s);u.programDraft.days[day]={routineId:r.id,title:r.name,rest:false,completed:false,skipped:false};s.modal='we-create';return true;
 }
 return false;
}
