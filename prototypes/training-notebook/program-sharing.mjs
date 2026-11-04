// Local design study only: no account requests, links or deliveries are created.
import { initialProgramDays } from './unified-program.mjs';
import { notebookIcon as icon } from './notebook-icons.mjs';
import { ensurePrograms, activateProgram } from './program-library.mjs';
import { entryRoutines, preserveWorkout } from './workout-entry.mjs';
import { unifiedRoutine } from './unified-plan.mjs';
import { workoutPlanPreview } from './sharing.mjs';

const clone = value => structuredClone(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const b = (label, action, kind = '', data = '') => `<button type="button" class="btn ${kind}" data-action="ps-${action}" ${data}>${label}</button>`;
const p = text => `<p class="supporting">${text}</p>`;
const people = [
  {id:'alex',name:'Alex',username:'alex.lifts',accepted:true},
  {id:'ben',name:'Ben',username:'ben.trains',accepted:true},
  {id:'maya',name:'Maya',username:'maya.moves',accepted:false},
];
export const programSharingStates = [
  ['send','Share a program','Review the full cycle and its routines, then send within Lastrep or share a link.'],
  ['receive','Receive a program','Save an independent program and its routines. Starting it is a separate choice.'],
  ['newuser','Receive / no existing program','Import the program and its routines without building them first.'],
  ['requests','Sharing / mixed requests','Workouts and programs use the same sender requests and inbox.'],
  ['sent','Sharing / sent programs','Inspect the sent snapshot and choose Send again.'],
  ['link','Shared program / browser preview','A read-only link preview offers Open in Lastrep and Get Lastrep on Google Play.'],
].map(([key,title,description])=>['Program sharing',`layout-minimal-program-share-${key}`,title,description]);

export function snapshotProgram(s, record) {
  const days = (record.templateDays ?? record.days).map(day=>({routineId:day.rest?null:day.routineId,title:day.title,rest:!!day.rest}));
  const routines = [...new Set(days.filter(day=>!day.rest).map(day=>day.routineId))].map(id=>{
    const routine=entryRoutines(s.unified).find(item=>item.id===id);
    if(!routine)throw Error('Assign an available routine to every workout day before sharing.');
    const plan=unifiedRoutine(id,entryRoutines(s.unified)).map(ex=>({id:ex.id,name:ex.name,mode:ex.mode??'resistance',unit:ex.unit??'kg',rest:ex.rest??120,tempo:ex.tempo??'',targets:clone(ex.targets??null),
      sets:ex.sets.map(set=>({weight:set.weight??'',reps:set.reps??'',type:set.type??'normal',targetRpe:set.targetRpe??''}))}));
    return {id,name:routine.name,plan};
  });
  return {id:`snapshot-${record.id}`,name:record.name,days,routines};
}
export function importSharedProgram(u, snapshot, makeId=()=>crypto.randomUUID()) {
  const ids=new Map(), routines=snapshot.routines.map(routine=>{
    const id=`received-routine-${makeId()}`;ids.set(routine.id,id);
    return {id,name:routine.name,exercises:routine.plan.map(ex=>ex.id),detail:routine.plan.map(ex=>ex.name).join(' · '),
      plannedExercises:routine.plan.map(ex=>({...clone(ex),notes:'',previous:[],sets:ex.sets.map(set=>({...clone(set),done:false,rpe:''}))}))};
  });
  const days=snapshot.days.map(day=>({...clone(day),routineId:day.rest?null:ids.get(day.routineId),completed:false,skipped:false}));
  const record={id:`received-program-${makeId()}`,name:snapshot.name,status:'saved',days,templateDays:clone(days)};
  u.customRoutines??=[];u.programs??=[];u.customRoutines.push(...routines);u.programs.push(record);
  return record;
}
export function ensureProgramSharing(s) {
  if(s.programSharing)return s.programSharing;
  ensurePrograms(s.unified);
  const original=s.unified.programs[0];
  // The recipient fixture has no prefabricated routines; its incoming snapshot is synthetic.
  const source=original??{id:'example',name:'7-day strength split',days:initialProgramDays()};
  const sourceState=original?s:{...s,unified:{...s.unified,newUser:false}};
  const incoming=snapshotProgram(sourceState,source);
  incoming.name='7-day strength split';
  const program={id:'incoming-program',kind:'program',title:incoming.name,name:'Alex',username:'alex.lifts',when:'Today · New',snapshot:incoming};
  const ps=s.programSharing={weights:true,query:'',selected:[],snapshot:clone(incoming),incoming,viewing:program,notice:'',error:'',expanded:null,imports:{},
    inbox:[program,{id:'incoming-workout',kind:'workout',title:'Chest + Triceps',name:'Ben',username:'ben.trains',when:'Yesterday'}],
    requests:[{id:'request-program',kind:'program',title:'Upper / Lower',name:'Maya',username:'maya.moves',snapshot:{...clone(incoming),name:'Upper / Lower'}}],
    sent:[{id:'sent-program',kind:'program',title:incoming.name,snapshot:clone(incoming),recipients:[people[0]],when:'Yesterday · 10:30'}]};
  syncHub(s);return ps;
}
function outgoingSnapshot(ps) {
  const snapshot=clone(ps.snapshot);
  if(!ps.weights)snapshot.routines.forEach(routine=>routine.plan.forEach(ex=>ex.sets.forEach(set=>set.weight='')));
  return snapshot;
}
function syncHub(s) { const ps=s.programSharing;Object.assign(s.social,{supportsPrograms:true,inbox:ps.inbox,requests:ps.requests}); }
export function setupProgramSharing(s,id) {
  const ps=ensureProgramSharing(s), kind=id.split('-').at(-1);
  if(kind!=='newuser'&&!s.exercises.length){s.exercises=unifiedRoutine('back');s.title='Back + Biceps';s.source=s.title;s.selectedId=s.exercises[0]?.id;s.unified.activeRoutineId='back';s.unified.sessionMode='single';}
  Object.assign(s.social.prefs,{enabled:true,username:'daniel.lifts'});
  if(kind==='send') {s.unified.viewedProgramId=s.unified.programs[0]?.id;s.modal='ps-send';}
  else s.modal=kind==='link'?'ps-web':kind==='receive'||kind==='newuser'?'ps-receive':`ps-${kind}`;
}
function summary(snapshot, weights, sender='') {
  const workdays=snapshot.days.filter(day=>!day.rest).length;
  return `<div class="ps-summary"><h3>${esc(snapshot.name)}</h3>${sender?p(esc(sender)):''}${p(`${snapshot.days.length}-day cycle · ${workdays} workout days · ${snapshot.routines.length} routines`)}${p(weights?'Weights included':'Weights not included')}</div>`;
}
function daysPreview(snapshot, target) {
  return `<div class="ps-days">${snapshot.days.map((day,i)=>{
    const routine=snapshot.routines.find(item=>item.id===day.routineId);
    return day.rest?`<div class="ps-day ps-rest"><span class="ps-day-number">${i+1}</span><span>Rest</span></div>`:
      b(`<span class="ps-day-number">${i+1}</span><span class="ps-day-copy"><strong>${esc(day.title)}</strong><small>${routine?.plan.map(ex=>esc(ex.name)).join(' · ')??'Routine unavailable'}</small></span>${icon('right')}`,'routine','ps-day',`data-routine="${esc(day.routineId)}" data-return="${target}"`);
  }).join('')}</div>`;
}
function tabs(ps,selected) {
  const unread=ps.inbox.filter(item=>item.when.includes('New')).length;
  return `<div class="social-tabs ps-tabs">${[['inbox','Inbox',unread],['requests','Requests',ps.requests.length],['sent','Sent',0]].map(([key,label,count])=>b(label+(count?` (${count})`:''),key,key===selected?'primary':'',`aria-pressed="${key===selected}"`)).join('')}</div>`;
}
function hubEntry(item, sent=false) {
  return b(`<span class="ps-type">${icon(item.kind==='program'?'calendar':'workout')}${item.kind==='program'?'Program':'Workout'}</span><strong>${esc(item.title)}</strong><span class="supporting">${sent?`To ${item.recipients.map(person=>esc(person.name)).join(', ')}`:`${esc(item.name)} · @${esc(item.username)}`}</span><span class="supporting">${esc(item.when)}</span>${icon('right')}`,sent?'sent-open':'receive-open','ps-hub-entry',`data-id="${item.id}"`);
}
export function programSharingDialog(s,{shell:baseShell}) {
  if(!s.modal.startsWith('ps-'))return '';
  const ps=ensureProgramSharing(s), u=s.unified;
  const help=['ps-send','ps-receive','ps-inbox','ps-requests','ps-sent'].includes(s.modal);
  const browserPreview=s.modal==='ps-web'||s.modal==='ps-routine'&&ps.routineReturn==='ps-web';
  const shell=(title,body,footer='')=>baseShell(title+(help?` <button class="icon-button ps-help" data-action="ps-help" aria-label="About program sharing">${icon('info')}</button>`:''),body,footer).replace('class="sheet ',`class="sheet ps-sheet ${['ps-inbox','ps-requests','ps-sent'].includes(s.modal)?'ps-hub-shell':''} ${browserPreview?'ps-browser-shell':''} `);
  const snap=['ps-send','ps-search','ps-link','ps-draft-message','ps-delivered'].includes(s.modal)?ps.snapshot:ps.viewing?.snapshot??ps.incoming;
  const imported=ps.imports[ps.viewing?.id??snap.id];
  switch(s.modal) {
    case 'ps-send':return shell('Review program',summary(ps.snapshot,ps.weights)+daysPreview(ps.snapshot,'ps-send')+
      `<button class="share-toggle" data-action="ps-weights" role="switch" aria-checked="${ps.weights}"><span>Include weights</span><span class="checkmark ${ps.weights?'checked':''}" aria-hidden="true">${ps.weights?'✓':''}</span></button>`+p('Shares routine plans and targets. Your progress, workout records and recovery stay private.')+(ps.error?`<p class="share-error" role="alert">${esc(ps.error)}</p>`:''),b('Send in Lastrep','search','primary')+b('Share a link','link'));
    case 'ps-routine': {
      const snapshot=ps.routineReturn==='ps-send'?ps.snapshot:ps.viewing?.snapshot??ps.incoming;
      const routine=snapshot.routines.find(item=>item.id===ps.routineId);
      if(!routine)return shell('Routine unavailable',p('Return to the program preview.'),b('Back to program','routine-back'));
      const plan=routine.plan.map(ex=>({...ex,sets:ex.sets.map(set=>({...set,weight:ps.weights?set.weight:''}))}));
      const preview=workoutPlanPreview({plan,title:routine.name,weights:ps.weights},esc);
      return shell(esc(routine.name),preview.exercises,b('Back to program','routine-back'));
    }
    case 'ps-search': {
      const q=ps.query.trim().toLowerCase().replace(/^@/,''),selected=people.filter(person=>ps.selected.includes(person.id));
      const matches=q.length<2?[]:people.filter(person=>(person.name+' '+person.username).toLowerCase().includes(q));
      return shell('Send in Lastrep',p('Find people who have turned on sharing.')+`<div class="social-search-input"><input data-ps-query aria-label="Search people" placeholder="Nickname or @username" value="${esc(ps.query)}" autocomplete="off"></div>`+
        (selected.length?`<div class="social-selected">${selected.map(person=>b(`@${esc(person.username)} ×`,'select','',`data-person="${person.id}" aria-label="Remove @${esc(person.username)}"`)).join('')}</div>`:'')+
        `<div class="ps-people">${matches.map(person=>`<button type="button" class="ps-person" data-action="ps-select" data-person="${person.id}" role="checkbox" aria-checked="${ps.selected.includes(person.id)}"><span>${ps.selected.includes(person.id)?'✓ ':''}${esc(person.name)} · @${esc(person.username)}</span></button>`).join('')}${q.length>=2&&!matches.length?p('No people found.'):''}</div>`+p('Each person receives a separate program.'),`<button class="btn primary" data-action="ps-deliver" ${ps.selected.length?'':'disabled'}>Send program${ps.selected.length>1?` to ${ps.selected.length} people`:''}</button>`+b('Back','send'));
    }
    case 'ps-delivered':return shell(ps.recipients.length===1&&!ps.recipients[0].accepted?'Sharing request sent':'Program sent',p(ps.recipients.length>1?'Each person gets a separate copy. See their status below.':ps.recipients[0].accepted?"They'll find your program in their Inbox.":"They'll see your request in Sharing.")+`<ul class="social-recipient-review">${ps.recipients.map(person=>`<li><span class="social-result-icon">${icon(person.accepted?'check-circle':'clock')}</span><span><strong>${person.name}</strong><small>${person.accepted?'In their inbox':'Sharing request sent'}</small></span></li>`).join('')}</ul>`,b('Done','done','primary'));
    case 'ps-link':return shell('Share a link',summary(ps.snapshot,ps.weights)+p('Anyone with the link can preview this program. The link expires after 30 days.')+`<div class="ps-link-actions">${[['message','Messages'],['mail','Email'],['copy','Copy link']].map(([glyph,label])=>b(`${icon(glyph)}<span>${label}</span>`,'external','',`data-channel="${label}"`)).join('')}</div>`+p('Example link: lastrep.web.app/p/example')+(ps.notice?`<p role="status" class="share-confirm">${esc(ps.notice)}</p>`:''),b('Preview shared link','web')+b('Back to program','send'));
    case 'ps-draft-message':return shell(`${ps.channel} draft`,p('Try this program in Lastrep:')+`<div class="ps-message">${esc(ps.snapshot.name)}<br>https://lastrep.web.app/p/example</div>`+p('In the app, this opens your chosen messaging or email app with the link ready to send. This mockup sends nothing.'),b('Back to link options','link'));
    case 'ps-web':return shell('Browser preview',`<div class="ps-browser-address">lastrep.web.app/p/example</div><p class="ps-web-brand">Lastrep</p>`+summary(ps.viewing?.snapshot??ps.incoming,ps.weights,'Shared by Alex · @alex.lifts')+daysPreview(ps.viewing?.snapshot??ps.incoming,'ps-web')+(ps.notice?`<p role="status">${esc(ps.notice)}</p>`:''),b('Open in Lastrep','receive','primary')+b('Get Lastrep on Google Play','store','ps-store')+p('Have Lastrep? Open the program in the app. Otherwise, get Lastrep on Google Play.'));
    case 'ps-receive':return shell('Received program',summary(snap,ps.weights,`From ${ps.viewing?.name??'Alex'} · @${ps.viewing?.username??'alex.lifts'}`)+daysPreview(snap,'ps-receive')+p('Save a copy of this program and its routines. Your active program and workout stay unchanged.'),b(imported?'View saved program':'Save to My programs',imported?'view-saved':'save','primary')+b('Back to inbox','inbox'));
    case 'ps-saved':return shell('Program saved',`<div class="ps-saved-summary"><div class="ps-saved-heading">${icon('check')}<h3>${esc(ps.saved.name)}</h3></div>${p(`${ps.saved.days.length}-day cycle · ${ps.savedRoutineCount} routines saved`)}</div><div class="ps-saved-copy">${p('Saved to My programs and My routines. Changes by the sender won’t change your copies.')}${p(u.activeProgramId?'Your current program and unfinished workout are unchanged.':'Your unfinished workout is unchanged.')}</div>`,b('Start program','start','primary')+b('View in My programs','view-saved')+b('Done','done'));
    case 'ps-start': {
      const active=u.programs.find(item=>item.id===u.activeProgramId);
      return shell(active?'Switch programs?':'Start program?',`<h3>${esc(ps.saved.name)}</h3>`+p('Start Day 1 today. The sender’s progress is not carried over.')+(active?p(`${esc(active.name)} will stop being active. Its history stays saved.`):'')+p('Your unfinished workout stays saved and will not be replaced.'),b(active?'Switch and start':'Start today','start-confirm','primary')+b('Keep current plan','saved'));
    }
    case 'ps-started':return shell('Program ready',`<h3>${esc(ps.saved.name)}</h3>`+p('Day 1 is ready. Your previous workout remains available through Resume workout.'),b('View program','view-saved','primary')+b('Done','done'));
    case 'ps-inbox':return shell('Sharing',tabs(ps,'inbox')+ps.inbox.map(item=>hubEntry(item)).join('')+(!ps.inbox.length?p('Nothing shared with you yet.'):''));
    case 'ps-sent':return shell('Sharing',tabs(ps,'sent')+ps.sent.map(item=>hubEntry(item,true)).join('')+(!ps.sent.length?p('You haven’t sent anything yet.'):''));
    case 'ps-requests':return shell('Sharing',tabs(ps,'requests')+p('Accept a sender to open their plan. Future shares go to your inbox.')+ps.requests.map(item=>`<div class="ps-request"><div><strong>${esc(item.name)}</strong><small>@${esc(item.username)}</small><span class="ps-type">${icon('calendar')}Program · ${esc(item.title)}</span></div><div class="ps-request-actions">${[['check','Accept'],['close','Decline'],['block','Block']].map(([glyph,label])=>`<button class="icon-button ${glyph==='block'?'ps-danger':''}" data-action="ps-${label.toLowerCase()}" data-id="${item.id}" aria-label="${label} ${esc(item.name)}" title="${label}">${glyph==='close'?'×':glyph==='block'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/></svg>':icon(glyph)}</button>`).join('')}</div></div>`).join('')+(!ps.requests.length?p('No sharing requests.'):''));
    case 'ps-sent-preview':return shell('Sent program',summary(ps.viewing.snapshot,ps.weights)+p(`To ${ps.viewing.recipients.map(person=>esc(person.name)).join(', ')} · ${esc(ps.viewing.when)}`)+daysPreview(ps.viewing.snapshot,'ps-sent-preview')+p('This is the snapshot that was sent. Changes to your original program do not change it.'),b('Send again','resend','primary')+b('Back to Sent','sent'));
    case 'ps-help':return shell('Program sharing',p('Send a program’s day order, rest days and assigned routine plans. Recipients save independent copies, then choose whether to start.')+p('Workout history, completed days, personal notes and recovery are not shared. Requests, links and sharing history expire after 30 days; imported copies remain.'),b('Done','help-back'));
    default:return '';
  }
}
export function handleProgramSharing(s,action,d={}) {
  if(action.startsWith('social-')&&s.programSharing&&['social-inbox','social-requests','social-sent'].includes(action)){s.modal=action.replace('social-','ps-');return true;}
  if(!action.startsWith('ps-'))return false;
  const ps=ensureProgramSharing(s),u=s.unified;
  ps.error='';
  switch(action.slice(3)) {
    case 'begin': {
      ensurePrograms(u);const record=u.programs.find(item=>item.id===(d.programId??u.viewedProgramId??u.activeProgramId));
      try {if(!record)throw Error('Choose a saved program first.');ps.snapshot=snapshotProgram(s,record);ps.weights=true;ps.selected=[];ps.query='';s.modal='ps-send';}catch(error){ps.error=error.message;u.notice=error.message;s.modal='';}break;
    }
    case 'send':case 'search':case 'receive':case 'inbox':case 'requests':case 'sent':case 'saved':s.modal=`ps-${action.slice(3)}`;break;
    case 'weights':ps.weights=!ps.weights;break;
    case 'routine':ps.routineId=d.routine;ps.routineReturn=d.return;s.modal='ps-routine';break;
    case 'routine-back':s.modal=ps.routineReturn;break;
    case 'select':ps.selected=ps.selected.includes(d.person)?ps.selected.filter(id=>id!==d.person):[...ps.selected,d.person];break;
    case 'deliver':if(ps.selected.length){ps.recipients=people.filter(person=>ps.selected.includes(person.id));const snapshot=outgoingSnapshot(ps);ps.sent.unshift({id:`sent-${crypto.randomUUID()}`,kind:'program',title:snapshot.name,snapshot,weights:ps.weights,recipients:clone(ps.recipients),when:'Just sent'});s.modal='ps-delivered';ps.selected=[];}break;
    case 'link':ps.notice='';s.modal='ps-link';break;
    case 'external':if(d.channel==='Copy link')ps.notice='Example link ready: lastrep.web.app/p/example. No live link was created.';else {ps.channel=d.channel;s.modal='ps-draft-message';}break;
    case 'web':ps.viewing={snapshot:outgoingSnapshot(ps),name:'Alex',username:'alex.lifts'};ps.notice='';s.modal='ps-web';break;
    case 'store':ps.notice='In the released app, this opens Lastrep’s Google Play listing.';break;
    case 'receive-open': {const item=ps.inbox.find(item=>item.id===d.id);if(item){item.when=item.when.replace(' · New','');ps.viewing=item;ps.weights=item.weights??true;if(item.kind==='program')s.modal='ps-receive';else{s.sharing.sender=`${item.name} · @${item.username}`;s.modal='share-receive';}}break;}
    case 'accept':case 'decline':case 'block': {const item=ps.requests.find(item=>item.id===d.id);if(item){ps.requests=ps.requests.filter(item=>item.id!==d.id);if(action==='ps-accept')ps.inbox.unshift({...item,when:'Just received · New'});}break;}
    case 'save': {const snapshot=ps.viewing?.snapshot??ps.incoming;let record=u.programs.find(item=>item.id===ps.imports[ps.viewing?.id??snapshot.id]);if(!record){record=importSharedProgram(u,snapshot);ps.imports[ps.viewing?.id??snapshot.id]=record.id;}ps.saved=record;ps.savedRoutineCount=snapshot.routines.length;s.modal='ps-saved';break;}
    case 'view-saved':u.viewedProgramId=ps.imports[ps.viewing?.id??(ps.viewing?.snapshot??ps.incoming).id]??ps.saved?.id;s.modal='we-program-detail';break;
    case 'start':s.modal='ps-start';break;
    case 'start-confirm':if(!preserveWorkout(s))break;activateProgram(u,ps.saved);u.entryScreen=true;s.modal='ps-started';break;
    case 'sent-open':ps.viewing=ps.sent.find(item=>item.id===d.id);ps.weights=ps.viewing.weights??true;s.modal='ps-sent-preview';break;
    case 'resend':ps.snapshot=clone(ps.viewing.snapshot);ps.selected=ps.viewing.recipients.map(person=>person.id);s.modal='ps-search';break;
    case 'help':ps.helpReturn=s.modal;s.modal='ps-help';break;
    case 'help-back':s.modal=ps.helpReturn;break;
    case 'done':s.modal='';break;
  }
  syncHub(s);return true;
}
export function programSharingInput(s,el,render) {
  if(!el.hasAttribute('data-ps-query'))return false;
  s.programSharing.query=el.value;const at=el.selectionStart;render();const next=document.querySelector('.interactive [data-ps-query]');next?.focus({preventScroll:true});next?.setSelectionRange(at,at);return true;
}
