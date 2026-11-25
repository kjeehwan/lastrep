import { effortValue } from './model.mjs';
import { notebookIcon as icon } from './notebook-icons.mjs';
import { renderWorkoutExercise } from './workout-exercise-ui.mjs';
import { targetDraft, readTargets, renderTargetsSheet, targetSummary, refreshTargetActions } from './exercise-targets.mjs';

const clone = value => structuredClone(value);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = {normal:'Normal',warmup:'Warm-up',top:'Top',backoff:'Back-off',failure:'Failure',drop:'Drop'};
export const topBackoffStates = [
  ['Top / back-off sets','layout-minimal-top-backoff','Top and back-off / workout','Use the existing set marker menu to assign roles. Targets stay above the set table; progression stays in Today’s Plan.'],
  ['Top / back-off sets','layout-minimal-top-backoff-menu','Top and back-off / set menu','Two explicit roles in the existing set menu. Loads alone never assign a role.'],
  ['Top / back-off sets','layout-minimal-top-backoff-targets','Top and back-off / targets','Keep exercise defaults, with optional top-set and back-off overrides.'],
  ['Top / back-off sets','layout-minimal-top-backoff-review','Top and back-off / review','One top set qualifies; back-offs repeat. Check only changes you want to apply.'],
  ['Top / back-off sets','layout-minimal-top-backoff-history','Top and back-off / missing history','Role-specific history must exist before recommending an increase.'],
  ['Top / back-off sets','layout-minimal-top-backoff-recovery','Top and back-off / recovery hold','Today’s recovery can hold an otherwise qualified increase.'],
  ['Top / back-off sets','layout-minimal-top-backoff-recording','Top and back-off / recording','Recorded sets are protected. There is no progression increase once recording has started.'],
];

export function setupTopBackoff(s, id) {
  const row = (type,weight,reps,rpe='') => ({type,weight:String(weight),reps:String(reps),rpe,done:false});
  s.title='Posterior legs'; s.source=''; s.selectedId='deadlift'; s.page='workout';
  s.exercises=[{id:'deadlift',name:'Deadlift',unit:'kg',mode:'resistance',rest:180,tempo:'',notes:'',targets:null,
    sets:[row('top',130,8),row('backoff',110,8),row('backoff',110,8)],
    previous:[row('top',130,8,'8'),row('backoff',110,8,'9'),row('backoff',110,8,'9')]}];
  s.topBackoff={targets:{default:{min:6,max:8,rpe:8},top:null,backoff:{min:8,max:10,rpe:8}},history:!id.endsWith('-history'),recovery:id.endsWith('-recovery'),selected:{normal:true,top:true,backoff:true},before:null,after:null,notice:''};
  if(id.endsWith('-recording')){s.exercises[0].sets[0].done=true;s.exercises[0].sets[0].rpe='8';}
  s.setIndex=0;
  s.modal=id.endsWith('-menu')?'tb-set':id.endsWith('-targets')?'tb-targets':/(review|history|recovery|recording)$/.test(id)?'tb-review':'';
}

export function groupTargets(s, group) { return s.topBackoff.targets[group] ?? s.topBackoff.targets.default; }
export function workingRoles(s) { return [...new Set(s.exercises[0].sets.filter(row=>row.type!=='warmup').map(row=>row.type||'normal'))]; }
export function targetGroups(s) { return workingRoles(s).filter(role=>['normal','top','backoff'].includes(role)); }

/** Fixture-only proposal, demonstrating group boundaries; not the production engine. */
export function topBackoffReview(s) {
  const e=s.exercises[0],t=s.topBackoff,sets=e.sets.filter(row=>row.type!=='warmup');
  const roles=workingRoles(s),hold=reason=>({groups:roles.map(role=>({role,change:null,reason})),reason});
  if(!sets.length)return hold('Add working sets to review progression.');
  if(sets.some(row=>row.done || row.rpe!=null && row.rpe!==''))return hold('This exercise is already in progress. Keep the planned sets; no increase is suggested.');
  const uniform=rows=>rows.every(row=>row.weight===rows[0].weight && row.reps===rows[0].reps);
  const normalOnly=roles.length===1 && roles[0]==='normal';
  if(normalOnly && !uniform(sets))return hold('The Normal sets have mixed loads or reps. No uniform progression is suggested.');
  if(!normalOnly && (sets.length<2 || sets[0].type!=='top' || sets.slice(1).some(row=>row.type!=='backoff') || !uniform(sets.slice(1)))) return hold('This arrangement needs individual review. This example supports uniform Normal sets, or one Top followed by uniform Back-off sets.');
  if(!t.history)return hold('No recent comparable history for these set roles. Keep the plan until a comparable session is recorded.');
  if(t.recovery)return hold('Today\u2019s lower-back discomfort holds progression for Deadlift. Review the exercise before training; no increase is suggested.');
  return {groups:roles.map(role=>{
    const rows=sets.filter(row=>(row.type||'normal')===role),previous=e.previous.filter(row=>(row.type||'normal')===role),target=groupTargets(s,role);
    const keep=reason=>({role,change:null,reason});
    if(!previous.length)return keep(`No comparable ${names[role]} history is available. Previous set roles are not relabelled when you change the current plan.`);
    if(!target || target.min==null || target.max==null || target.rpe==null)return keep('Set target reps and effort for this group to review progression.');
    if(rows.length!==previous.length || rows.some((row,i)=>row.weight!==previous[i].weight || row.reps!==previous[i].reps))return keep('The plan differs from the latest role-specific session. Keep your chosen prescription.');
    if(previous.some(row=>row.rpe==='' || Number(row.rpe)<6 || Number(row.rpe)>target.rpe))return keep('The previous group exceeded its effort target or has missing effort. Repeat before increasing.');
    const first=rows[0];
    if(Number(first.reps)<target.min || Number(first.reps)>target.max)return keep('Planned reps fall outside the group\u2019s target range. Review the prescription.');
    const next=Number(first.reps)<target.max ? {weight:first.weight,reps:String(Math.min(target.max,Number(first.reps)+2))} : {weight:String(Number(first.weight)+2.5),reps:String(target.min)};
    return {role,change:next,reason:Number(first.reps)<target.max ? 'The previous group met its effort target. Try the next rep step at the same load.' : 'The previous group reached the top of its rep range within target effort. The example\u2019s available weights allow the smallest 2.5 kg increase.'};
  })};
}

export function applyTopBackoff(s) {
  const result=topBackoffReview(s),t=s.topBackoff,changes=result.groups.filter(group=>group.change && t.selected[group.role]);
  if(!changes.length)return false;
  t.before=clone(s.exercises);
  for(const group of changes)for(const row of s.exercises[0].sets)if((row.type||'normal')===group.role)Object.assign(row,group.change);
  t.after=JSON.stringify(s.exercises);t.appliedRoles=changes.map(group=>group.role);t.notice=changes.length===1?'Selected group updated. Other sets unchanged.':'Selected groups updated.';return true;
}
export function undoTopBackoff(s) {
  const t=s.topBackoff;if(!t.before || JSON.stringify(s.exercises)!==t.after)return false;
  s.exercises=clone(t.before);t.before=null;t.after=null;t.notice='Changes undone.';return true;
}

export function topBackoffMain(s,scale,{button}) {
  const t=s.topBackoff,e=s.exercises[0],volume=e.sets.reduce((n,row)=>n+Number(row.weight)*Number(row.reps),0),summary=group=>targetSummary(groupTargets(s,group),scale)||'Not set';
  const roles=targetGroups(s);
  const targets=roles.length?`<button class="btn text tb-target-summary" data-action="tb-targets">${roles.map(role=>`<span>${roles.length===1 && role==='normal'?'':`${names[role]} · `}Target ${esc(summary(role))}</span>`).join('')}</button>`:'';
  const exercise=renderWorkoutExercise(e,0,{layoutStudy:true,effortScale:scale,renderNote:()=>`<span class="supporting">Note</span>${targets}`});
  return `<section class="session-heading layout-heading"><div class="date-row"><span class="supporting">Wed, Nov 25</span><span class="supporting">00:00</span></div><h1 class="editorial">Posterior legs</h1><div class="minimal-session-meta"><span class="supporting">Strength · Week 3</span><span class="minimal-stats">· ${e.sets.length} sets · ${volume.toLocaleString("en-US")} kg</span></div><div class="up-plan-entry"><span>Today’s Plan</span>${button(t.after?'View changes':'Review workout','tb-review')}</div>${t.notice?`<p class="supporting" role="status">${esc(t.notice)}</p>`:''}${t.after && JSON.stringify(s.exercises)===t.after?button('Undo changes','tb-undo','text'):''}</section>${exercise}`;
}

export function topBackoffDialog(s,scale,{shell,button}) {
  if(!s.topBackoff || !s.modal.startsWith('tb-'))return '';
  const t=s.topBackoff,e=s.exercises[0];
  if(s.modal==='tb-set')return shell('Set type',`<p class="supporting">Deadlift · Set ${s.setIndex+1}</p><div class="tb-roles">${Object.entries(names).map(([key,label])=>`<button class="tb-role" data-action="tb-role" data-value="${key}" aria-pressed="${e.sets[s.setIndex].type===key}"><span>${label}</span>${e.sets[s.setIndex].type===key?icon('check'):''}</button>`).join('')}</div><p class="supporting">Top sets are reviewed separately from back-off sets. Changing a type keeps the recorded values.</p>`);
  if(s.modal==='tb-options')return shell('Deadlift',button(`${icon('options')}Targets`,'tb-targets','workout-option')+button(`${icon('options')}Available weights`,'tb-weights','workout-option'));
  if(s.modal==='tb-weights')return shell('Available weights','<p>Regular increments · kg</p><p class="supporting">Lowest weight 20 kg · Increment 2.5 kg<br>Preferred increase 2.5 kg · Maximum increase 5 kg</p><p class="supporting">Synthetic equipment settings for this example. These apply to both set groups.</p>');
  if(s.modal==='tb-targets')return shell('Targets',`<h3 class="target-exercise-name">Deadlift</h3><p class="supporting">Set exercise defaults, then override a group only when needed.</p>${['default',...targetGroups(s).filter(role=>role!=='normal')].map(group=>`<button class="tb-target-group" data-action="tb-edit-group" data-group="${group}"><span>${group==='default'?'Exercise defaults':names[group]}<small>${esc(targetSummary(groupTargets(s,group),scale)||'Not set')}${group!=='default'&&!t.targets[group]?' · Uses exercise targets':''}</small></span>${icon('right')}</button>`).join('')}`);
  if(s.modal==='tb-group') {
    const group=t.group,title=group==='default'?'Exercise defaults':names[group];
    const content=renderTargetsSheet({name:`Deadlift · ${title}`,targets:t.targets[group]},t.draft,{shell,button});
    return content.replace('<div class="target-rows">',`<p class="supporting">${group==='default'?'Default targets for normal, top and back-off sets.':`Exercise defaults: ${esc(targetSummary(t.targets.default,scale)||'Not set')}. Leave the override empty to use these targets.`}</p><div class="target-rows">`).replaceAll('data-target-field=','data-tb-field=').replace('Clear targets',group==='default'?'Clear targets':'Use exercise targets');
  }
  if(s.modal==='tb-target-help')return shell('Targets','<p>Exercise targets are the default. Top sets and back-off sets can have separate target reps and effort.</p><p class="supporting">Clearing a group override returns it to the exercise targets. Recorded reps and effort stay unchanged.</p>');
  const review=topBackoffReview(s),applied=!!t.after;
  const prescription=rows=>{
    const groups=[];
    for(const row of rows){const last=groups.at(-1);if(last && last.weight===row.weight && last.reps===row.reps)last.count++;else groups.push({...row,count:1});}
    return groups.map(row=>`${row.count>1?`${row.count} \u00d7 `:''}${row.weight} kg \u00d7 ${row.reps} reps`).join('; ');
  };
  const groups=review.groups.map(group=>{
    const label=names[group.role],rows=e.sets.filter(row=>(row.type||'normal')===group.role);
    const previous=(t.before?.[0].sets??e.sets).filter(row=>(row.type||'normal')===group.role);
    const wasApplied=applied && t.appliedRoles.includes(group.role),change=applied?wasApplied:!!group.change;
    const next=wasApplied?rows:group.change?rows.map(row=>({...row,...group.change})):null;
    return `<div class="tb-review-group">${change?`<label class="tb-review-choice"><input type="checkbox" data-tb-selected="${group.role}" ${t.selected[group.role]?'checked':''} ${applied?'disabled':''}><span>${label}</span></label><p class="tb-prescription">${prescription(previous)} \u2192 <strong>${prescription(next)}</strong></p>`:`<p>${label} \u00b7 Keep</p><p>${prescription(rows)}</p>`}<p class="supporting">${esc(applied?(wasApplied?'Selected change applied.':'No change applied to this group.'):group.reason)}</p></div>`;
  }).join('');
  const hasSelected=review.groups.some(group=>group.change && t.selected[group.role]);
  return shell('Today\u2019s Plan',`<p class="supporting">${applied?'Selected changes applied.':'Review your planned workout.'}</p><h3>Deadlift</h3>${groups || `<p class="supporting">${esc(review.reason)}</p>`}<details class="tb-context"><summary>Review context</summary><p class="supporting">${t.recovery?'Lower-back discomfort reported today.':'Soreness 2/10 \u00b7 Fatigue 2/10 \u00b7 Motivation 8/10. No pain/discomfort or additional activity reported.'}</p><p class="supporting">Recent performance: ${t.history?`synthetic Nov 22 session. Top set: 130 kg \u00d7 8 at ${scale} ${effortValue(8,scale)}. Back-offs: 2 \u00d7 110 kg \u00d7 8 at ${scale} ${effortValue(9,scale)}.`:'no comparable role-labelled session.'} Exercise targets, available weights and today\u2019s recovery apply to each group.</p></details>`,!applied && review.groups.some(group=>group.change)?button('Apply changes','tb-apply','primary',{},!hasSelected):button('Back to workout','tb-close','primary'));

}

export function topBackoffInput(s,el) {
  if(!s.topBackoff)return false;
  if(el.hasAttribute('data-tb-selected')){s.topBackoff.selected[el.dataset.tbSelected]=el.checked;return 'render';}
  if(el.dataset.tbField){s.topBackoff.draft[el.dataset.tbField]=el.value;s.topBackoff.draft.error='';refreshTargetActions(el.closest('.interactive'),{targets:s.topBackoff.targets[s.topBackoff.group]},s.topBackoff.draft);return 'live';}
  return false;
}

export function handleTopBackoff(s,action,d,scale) {
  if(!s.topBackoff)return false;
  const t=s.topBackoff;
  if(action==='set-menu'){s.setIndex=Number(d.index);s.modal='tb-set';return true;}
  if(action==='exercise-menu' || action==='exercise-targets'){s.modal=action==='exercise-menu'?'tb-options':'tb-targets';return true;}
  if(action.startsWith('targets-'))action=`tb-${action}`;
  if(!action.startsWith('tb-'))return false;
  if(['tb-review','tb-targets','tb-weights'].includes(action)){s.keyboard=false;s.modal=action;}
  if(action==='tb-role'){s.exercises[0].sets[s.setIndex].type=d.value;t.before=null;t.after=null;t.appliedRoles=[];t.notice='';t.selected={normal:true,top:true,backoff:true};s.modal='';}
  if(action==='tb-edit-group'){t.group=d.group;t.draft=targetDraft({targets:t.targets[d.group]},scale);s.modal='tb-group';}
  if(action==='tb-targets-edit')t.draft.editing=t.draft.editing===d.value?null:d.value;
  if(action==='tb-targets-done'){const result=readTargets(t.draft);if(result.error)t.draft.error=result.error;else{t.targets[t.group]=result.value;s.modal='tb-targets';}}
  if(action==='tb-targets-clear'){t.draft.min='';t.draft.max='';t.draft.effort='';t.draft.error='';t.draft.editing=null;}
  if(action==='tb-targets-help')s.modal='tb-target-help';
  if(action==='tb-targets-back')s.modal='tb-group';
  if(action==='tb-apply'){if(applyTopBackoff(s))s.modal='';}
  if(action==='tb-undo')undoTopBackoff(s);
  if(action==='tb-close')s.modal='';
  return true;
}
