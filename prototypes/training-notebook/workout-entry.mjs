import { beginProgramRoutine, handleProgramRoutine, routineEditorDialog } from './program-routine-editor.mjs';
import { ensurePrograms, storeProgramDraft, activateProgram, renderProgramLibrary, handleProgramLibrary } from './program-library.mjs';
import { notebookIcon as icon } from './notebook-icons.mjs';
import { programRoutines } from './unified-program.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=value=>structuredClone(value);
export const entryRoutines=u=>[...(u.newUser?[]:programRoutines),...(u.customRoutines??[])];
export const entryRoutine=(u,id)=>entryRoutines(u).find(r=>r.id===id);
const blankDay=()=>({routineId:null,title:'Unassigned',rest:false,completed:false,skipped:false});
export function renderWorkoutEntry(s) {
 const u=s.unified;ensurePrograms(u);const hasDraft=s.exercises.length||u.savedWorkout;
 const row=(title,detail,action,primary=false)=>`<button class="we-choice ${primary?'we-primary':''}" data-action="${action}"><span><strong>${title}</strong><small>${detail}</small></span>${icon('right')}</button>`;
 return `<section class="up-heading we-entry"><span class="supporting">${esc(s.date)}</span><h1 class="editorial">Your workout</h1><p class="supporting">Choose how you want to train.</p><div class="we-choices">${hasDraft?row('Resume workout',esc(s.exercises.length?s.title:u.savedWorkout.title),'we-resume',true):''}${s.exercises.length&&u.savedWorkout?row('Resume saved workout',esc(u.savedWorkout.title),'we-resume-saved'):''}${u.enabled?row('Continue program',`${esc(u.programName)} · Week ${Math.floor((Date.parse(u.dateKey)-Date.parse(u.programStartedAt))/604800000)+1}<br>Day ${u.today+1} · ${esc(u.days[u.today].title)}`,'we-continue',!hasDraft):''}${row('Create program','Build a schedule and assign your routines.','we-create')}${row('Start workout','Train outside your program.','we-single',!u.enabled&&!hasDraft)}${row('My programs','Browse programs and saved drafts.','we-programs')}<div class="we-entry-footer">${hasDraft?'<p class="supporting">Your unfinished workout is kept when you choose another path.</p>':''}${u.notice?`<p class="supporting" role="status">${esc(u.notice)}</p>`:''}<p class="mock-disclaimer">Design example. Changes stay in this browser session.</p></div></div></section>`;
}
export function entryDialog(s,{shell,button}) {
 const editor=routineEditorDialog(s,{shell,button});if(editor)return editor;
 const library=renderProgramLibrary(s,{shell,button,routine:id=>entryRoutine(s.unified,id)});if(library)return library;
 const u=s.unified,b=button,stack=body=>`<div class="up-stack">${body}</div>`,draft=u.programDraft;
 switch(s.modal){
 case 'we-create':return shell('Create program',stack(`<label class="field"><span>Program name</span><input data-we-name aria-label="Program name" value="${esc(draft.name)}" placeholder="Name your program" maxlength="60"></label><label class="field"><span>Days per cycle</span><select data-we-length aria-label="Days per cycle">${Array.from({length:14},(_,i)=>`<option ${draft.days.length===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label><p class="supporting">Assign a routine or choose Rest for each day. You can save an unfinished setup.</p><div class="up-program-day-list">${draft.days.map((day,i)=>b(`Day ${i+1} · ${esc(day.title)}${icon('right')}`,'we-assign','up-text-row',{value:i})).join('')}</div>${u.enabled?`<p class="supporting">${esc(u.programName)} stays active until you start this program.</p>`:''}${s.exercises.length?'<p class="supporting">Starting this program keeps your unfinished workout.</p>':''}${u.entryError?`<p class="form-error" role="alert">${esc(u.entryError)}</p>`:''}`),b('Start program','we-start','primary')+b('Save for later','we-save')+b('Cancel','we-cancel'));
 case 'we-assign':return shell(`Routine for Day ${u.newDay+1}`,stack(`<div class="up-routine-list">${[['','Unassigned'],['rest','Rest day'],...entryRoutines(u).map(r=>[r.id,r.name])].map(([id,name])=>b(`<span><strong>${esc(name)}</strong>${entryRoutine(u,id)?`<small>${esc(entryRoutine(u,id).detail)}</small>`:''}</span>${icon('right')}`,'we-pick','up-routine-choice',{'routine-id':id})).join('')}</div>${!entryRoutines(u).length?'<p class="supporting">No saved routines yet. Create one here to assign it.</p>':''}${b('<span aria-hidden="true">+</span>Create routine','we-routine','we-create-routine')}`),b('Back to program','we-back','primary'));
 case 'we-draft-limit':return shell('Two workouts are open',stack('<p>Resume your saved workout before starting another. Both current drafts are kept.</p>'),b('Back to choices','we-choices','primary'));
 default:return null;
 }
}
function preserveWorkout(s){
 const u=s.unified;if(!s.exercises.length)return true;
 if(u.savedWorkout){s.modal='we-draft-limit';return false;}
 u.savedWorkout=copy({title:s.title,source:s.source,exercises:s.exercises,activeRoutineId:u.activeRoutineId,sessionMode:u.sessionMode});
 s.exercises=[];s.title='';s.source='';u.activeRoutineId=null;u.status='none';return true;
}
export function handleEntry(s,action,d) {
 const u=s.unified;
 const editorAction=handleProgramRoutine(s,action,d);if(editorAction)return editorAction;
 const libraryAction=handleProgramLibrary(s,action,d,{preserveWorkout});if(libraryAction)return libraryAction;
 switch(action){
 case 'home':if(!u.entryScreen){u.entryScreen=true;s.keyboard=false;s.modal='';return true;}return false;
 case 'we-choices':u.entryScreen=true;s.modal='';return true;
 case 'we-resume':if(!s.exercises.length&&u.savedWorkout){const saved=u.savedWorkout;Object.assign(s,{title:saved.title,source:saved.source,exercises:saved.exercises});u.activeRoutineId=saved.activeRoutineId;u.sessionMode=saved.sessionMode;u.savedWorkout=null;}u.entryScreen=false;s.modal='';return true;
 case 'we-resume-saved':{const saved=u.savedWorkout;if(!saved)return true;u.savedWorkout=s.exercises.length?copy({title:s.title,source:s.source,exercises:s.exercises,activeRoutineId:u.activeRoutineId,sessionMode:u.sessionMode}):null;Object.assign(s,{title:saved.title,source:saved.source,exercises:saved.exercises});u.activeRoutineId=saved.activeRoutineId;u.sessionMode=saved.sessionMode;u.entryScreen=false;s.modal='';return true;}
 case 'we-single':case 'we-continue':if(!preserveWorkout(s))return true;u.entryScreen=false;u.sessionMode=action==='we-single'?'single':'program';u.notice='';u.status='none';s.modal='';return true;
 case 'we-create':ensurePrograms(u);u.programReturn=s.modal==='we-programs'?'we-programs':'';u.editingProgramId=null;u.createBefore=null;u.programDraft={name:'',days:Array.from({length:7},blankDay)};u.entryError='';s.modal='we-create';return true;
 case 'open':if(d.modal==='routines'){s.modal='up-routines';return true;}return false;
 case 'we-cancel':u.programDraft=copy(u.createBefore);s.modal=u.programReturn||'';return true;
 case 'we-save':{const record=storeProgramDraft(u);u.viewedProgramId=record.id;u.notice=u.enabled?'Program setup saved for later. Your active program is unchanged.':'Program setup saved for later.';u.programDraft=null;s.modal='we-programs';return true;}
 case 'we-assign':u.newDay=Number(d.value);s.modal='we-assign';return true;
 case 'we-pick':{const r=entryRoutine(u,d.routineId);u.programDraft.days[u.newDay]=d.routineId==='rest'?{...blankDay(),title:'Rest',rest:true}:r?{...blankDay(),routineId:r.id,title:r.name}:blankDay();s.modal='we-create';return true;}
 case 'we-back':s.modal='we-create';return true;
 case 'we-routine':beginProgramRoutine(s);return true;
 case 'we-start':if(!u.programDraft.name.trim()||u.programDraft.days.some(day=>!day.rest&&!day.routineId)||!u.programDraft.days.some(day=>day.routineId)){u.entryError='Name your program, assign each day or mark it Rest, and include at least one routine.';return true;}if(!preserveWorkout(s))return true;const record=storeProgramDraft(u);activateProgram(u,record);u.programDraft=null;u.editingProgramId=null;u.notice='New program started.';s.modal='';return true;
 default:return false;
 }
}
export function entryInput(s,el){
 const u=s.unified;
 if(el.hasAttribute('data-we-name')){u.programDraft.name=el.value;return 'live';}
 if(el.hasAttribute('data-we-length')){const length=Number(el.value);if(length>u.programDraft.days.length)while(u.programDraft.days.length<length)u.programDraft.days.push(blankDay());else u.programDraft.days.length=length;return true;}
 return false;
}
