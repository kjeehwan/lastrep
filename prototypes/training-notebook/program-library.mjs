import { notebookIcon as icon } from './notebook-icons.mjs';
const copy=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snapshot=u=>({name:u.programName,days:copy(u.days),templateDays:copy(u.templateDays),startedAt:u.programStartedAt,today:u.today,shiftDays:u.shiftDays,shiftFrom:u.shiftFrom,pausedToday:u.pausedToday,scheduleDateKey:u.dateKey,occurrenceDates:copy(u.occurrenceDates??null)});
const addDays=(key,offset)=>{const date=new Date(key+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
const shortDate=key=>new Date(key+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
function savedDate(record,index){return addDays(record.occurrenceDates?.[index]??record.scheduleDateKey??record.startedAt,(record.occurrenceDates?.[index]?0:index-(record.today??0))+(index>=(record.shiftFrom??Infinity)?record.shiftDays??0:0));}
function completedDays(record){
 const history=copy(record.completedHistory??[]);
 record.days.forEach((day,index)=>{if(day.completed){const dateKey=savedDate(record,index);if(!history.some(item=>item.dateKey===dateKey&&item.dayNumber===index+1))history.push({dateKey,dayNumber:index+1,title:day.title,routineId:day.routineId});}});
 return history;
}
export function programResumePlan(record,dateKey){
 const length=record.days.length;let ordinal=record.today??0;
 while(ordinal<length&&(record.days[ordinal].completed||record.days[ordinal].skipped))ordinal++;
 const dayIndex=ordinal%length,nextCycle=ordinal>=length;
 const rows=Array.from({length:Math.min(length,7)},(_,offset)=>{const index=dayIndex+offset,day=index>=length||nextCycle?record.templateDays?.[index%length]??record.days[index%length]:record.days[index];return{dayNumber:index%length+1,title:day.title,dateKey:addDays(dateKey,offset)};});
 const occurrenceDates=record.days.map((day,index)=>!nextCycle&&(day.completed||day.skipped||index<dayIndex)?savedDate(record,index):addDays(dateKey,index-dayIndex));
 return {dayIndex,nextCycle,rows,occurrenceDates};
}
export function ensurePrograms(u){
 if(!u.programs){u.programs=[];u.activeProgramId=null;if(u.days.length&&u.programName){const id='initial-program';u.programs.push({id,status:'saved',...snapshot(u)});if(u.enabled)u.activeProgramId=id;}}
 const current=u.programs.find(p=>p.id===u.activeProgramId);
 if(current)Object.assign(current,snapshot(u));
 return u.programs;
}
export function storeProgramDraft(u){
 ensurePrograms(u);const id=u.editingProgramId??'program-'+crypto.randomUUID();
 const record={id,status:'draft',name:u.programDraft.name.trim(),days:copy(u.programDraft.days)};
 const index=u.programs.findIndex(p=>p.id===id);if(index<0)u.programs.push(record);else u.programs[index]=record;
 return record;
}
export function activateProgram(u,record,resume=false){
 const plan=resume?programResumePlan(record,u.dateKey):null;
 if(plan){
  const history=record.completedHistory??=[];
  record.days.forEach((day,index)=>{if(day.completed){const dateKey=savedDate(record,index);if(!history.some(item=>item.dateKey===dateKey&&item.dayNumber===index+1))history.push({dateKey,dayNumber:index+1,title:day.title,routineId:day.routineId});}});
  (record.resumptions??=[]).push({dateKey:u.dateKey,dayNumber:plan.dayIndex+1});
 }
 u.activeProgramId=record.id;record.status='saved';u.programName=record.name;u.days=copy(record.days);u.templateDays=copy(record.templateDays??record.days);
 if(plan?.nextCycle)u.days=u.templateDays.map(day=>({...day,completed:false,skipped:false}));
 u.programStartedAt=record.startedAt??u.dateKey;u.today=record.today??0;u.preview=u.today;u.shiftDays=record.shiftDays??0;u.shiftFrom=record.shiftFrom??Infinity;u.pausedToday=record.pausedToday??false;
 u.occurrenceDates=copy(plan?.occurrenceDates??record.occurrenceDates??null);
 if(plan){u.today=plan.dayIndex;u.preview=u.today;u.shiftDays=0;u.shiftFrom=Infinity;u.pausedToday=false;}
 u.enabled=true;u.sessionMode='program';u.entryScreen=false;u.status='none';u.notice='';u.deloadActive=false;u.deloadDeclined=false;
 Object.assign(record,snapshot(u));
}
export function restartProgram(u,record){
 const previous={...copy(record)};delete previous.runs;
 previous.completedHistory=completedDays(previous);
 (record.runs??=[]).push({...previous,endedAt:u.dateKey});
 record.days=copy(record.templateDays??record.days).map(day=>({...day,completed:false,skipped:false}));
 record.templateDays=copy(record.days);record.startedAt=u.dateKey;record.scheduleDateKey=u.dateKey;
 record.today=0;record.shiftDays=0;record.shiftFrom=Infinity;record.pausedToday=false;record.occurrenceDates=null;
 record.completedHistory=[];record.resumptions=[];
 activateProgram(u,record);u.notice='Program restarted from Day 1 today. Your previous run is kept.';
}
export function renderProgramLibrary(s,{shell,button,routine=()=>null}){
 const u=s.unified,b=button,stack=body=>`<div class="up-stack">${body}</div>`,rank=p=>p.id===u.activeProgramId?0:p.status==='draft'?1:2,list=[...(u.programs??[])].sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name)),record=list.find(p=>p.id===u.viewedProgramId);
 const label=p=>p.id===u.activeProgramId?(u.enabled?'Active':'Paused'):p.status==='draft'?'Saved for later':'Saved program';
 switch(s.modal){
 case 'we-programs':return shell('My programs',stack(list.length?`<div class="we-program-list">${list.map(p=>b(`<span><strong>${esc(p.name||'Untitled program')}</strong><small>${label(p)} · ${p.days.length}-day cycle</small></span>${icon('right')}`,'we-program-detail','we-program-row',{'program-id':p.id})).join('')}</div>`:'<p>No programs yet. Create your first program when you’re ready.</p>'),b('Create program','we-create','primary')+b('Done','close'));
 case 'we-program-detail':if(!record)return null;return shell(esc(record.name||'Untitled program'),stack(`<p class="supporting">${label(record)} · ${record.days.length}-day cycle</p><div class="we-program-days">${record.days.map((day,i)=>{const assigned=routine(day.routineId);return `<section class="we-program-day"><p class="supporting">Day ${i+1}</p><strong>${esc(day.title)}</strong>${assigned?`<p class="supporting">${esc(assigned.detail)}</p>`:day.routineId?'<p class="supporting">Routine unavailable</p>':''}</section>`;}).join('')}</div>${record.runs?.length?b(`Previous runs (${record.runs.length})${icon('right')}`,'we-program-runs','up-text-row'):''}${record.id!==u.activeProgramId&&u.activeProgramId?'<p class="supporting">Your current program stays active until you switch programs.</p>':''}`),`<div class="ps-program-actions">${[[record.id===u.activeProgramId&&u.enabled?'Continue':record.startedAt?'Resume':'Start','play',record.status==='draft'?'we-program-edit':'we-program-activate'],['Edit','edit','we-program-edit'],...(record.id===u.activeProgramId&&u.enabled?[['Stop','stop','we-program-stop']]:[]),...(record.startedAt?[['Restart','repeat','we-program-restart']]:[]),['Share','share','ps-begin'],['Delete','trash','we-program-delete']].map(([label,glyph,action])=>b(`${icon(glyph)}<span>${label}</span>`,action,`ps-program-action ${label==='Delete'?'ps-danger':''}`,{'program-id':record.id})).join('')}</div>`+b('Back to programs','we-programs','text program-neutral-link'));
 case 'we-program-restart':if(!record)return null;return shell('Restart program?',stack(`<h3>${esc(record.name)}</h3><p>Start Day 1 today, ${shortDate(u.dateKey)}, with the following days scheduled from today.</p><p class="supporting">This starts a new run. Your previous run’s history, recorded workouts and routines stay unchanged.</p>${s.exercises.length?'<p class="supporting">Your unfinished workout will be kept.</p>':''}`),b('Restart today','we-program-restart-confirm','primary')+b('Cancel','we-program-detail'));
 case 'we-program-runs':if(!record)return null;return shell('Previous runs',stack(`<h3>${esc(record.name)}</h3><div class="we-program-days">${(record.runs??[]).map((run,index)=>`<section class="we-program-day"><strong>Run ${index+1}</strong><p class="supporting">Started ${shortDate(run.startedAt)} · Restarted ${shortDate(run.endedAt)}</p>${run.completedHistory.length?run.completedHistory.map(day=>`<p class="supporting">${shortDate(day.dateKey)} · Day ${day.dayNumber} · ${esc(day.title)} · Completed</p>`).join(''):'<p class="supporting">No completed days in this run.</p>'}</section>`).join('')}</div>`),b('Back to program','we-program-detail','primary'));
 case 'we-program-resume':{
  if(!record)return null;const plan=programResumePlan(record,u.dateKey);
  return shell('Resume program',stack(`<h3>${esc(record.name)}</h3><p>Continue from Day ${plan.dayIndex+1} today, ${shortDate(u.dateKey)}.</p><p class="supporting">The remaining schedule starts from today. Time away is not counted as missed workouts. Completed days keep their original dates.</p><div class="we-program-days">${plan.rows.map(row=>`<section class="we-program-day"><p class="supporting">${shortDate(row.dateKey)} · Day ${row.dayNumber}</p><strong>${esc(row.title)}</strong></section>`).join('')}</div>${s.exercises.length?'<p class="supporting">Your unfinished workout will be kept.</p>':''}`),b('Resume today','we-program-resume-today','primary')+b('Cancel','we-program-detail'));
 }
 case 'we-program-delete':if(!record)return null;return shell('Delete program?',stack(`<p>Delete ${esc(record.name||'this program')}?</p>${record.id===u.activeProgramId?'<p class="supporting">This is your active program. Its schedule will stop.</p>':''}<p class="supporting">Your routines, recorded workouts and unfinished workout will stay.</p>`),b('Delete program','we-program-delete-confirm','danger')+b('Keep program','we-program-detail'));
 default:return null;
 }
}
export function handleProgramLibrary(s,action,d,{preserveWorkout}){
 const u=s.unified;
 switch(action){
 case 'we-program-stop':ensurePrograms(u);u.enabled=false;u.activeProgramId=null;s.modal='we-program-detail';return true;

 case 'we-programs':ensurePrograms(u);s.modal='we-programs';return true;
 case 'we-program-detail':if(d.programId)u.viewedProgramId=d.programId;s.modal='we-program-detail';return true;
 case 'we-program-edit':{const p=u.programs.find(p=>p.id===u.viewedProgramId);if(!p)return true;u.editingProgramId=p.id;u.programDraft={name:p.name,days:copy(p.days)};u.createBefore=copy(u.programDraft);u.programReturn='we-program-detail';u.entryError='';s.modal='we-create';return true;}
 case 'we-program-activate':{ensurePrograms(u);const p=u.programs.find(p=>p.id===u.viewedProgramId);if(!p)return true;if(p.startedAt&&(p.id!==u.activeProgramId||!u.enabled)){s.modal='we-program-resume';return true;}if(!preserveWorkout(s))return true;activateProgram(u,p);s.modal='';return true;}
 case 'we-program-resume-today':{ensurePrograms(u);const p=u.programs.find(p=>p.id===u.viewedProgramId);if(!p||!preserveWorkout(s))return true;activateProgram(u,p,true);u.notice=`Resumed from Day ${u.today+1} today. Completed history is unchanged.`;s.modal='';return true;}
 case 'we-program-restart':s.modal='we-program-restart';return true;
 case 'we-program-runs':s.modal='we-program-runs';return true;
 case 'we-program-restart-confirm':{ensurePrograms(u);const p=u.programs.find(p=>p.id===u.viewedProgramId);if(!p||!preserveWorkout(s))return true;restartProgram(u,p);s.modal='';return true;}
 case 'we-program-delete':s.modal='we-program-delete';return true;
 case 'we-program-delete-confirm':{const id=u.viewedProgramId;u.programs=u.programs.filter(p=>p.id!==id);if(u.activeProgramId===id){u.activeProgramId=null;u.enabled=false;u.programName='';u.days=[];u.templateDays=[];u.sessionMode='single';u.deloadActive=false;u.pausedToday=false;}if(u.editingProgramId===id){u.editingProgramId=null;u.programDraft=null;}u.status='none';u.notice='Program deleted. Your routines and workouts are kept.';s.modal='we-programs';return true;}
 default:return false;
 }
}
