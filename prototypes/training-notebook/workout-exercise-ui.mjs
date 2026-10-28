// One exercise view for the Workout study and its isolated sharing-plan editor.
import { targetSummary } from './exercise-targets.mjs';
import { effortValue, lastText, catalog, exerciseFromCatalog as exerciseFromReplacement } from './model.mjs';
import { setDisplayRows } from './warmup.mjs';
import { notebookIcon } from './notebook-icons.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const attrs = data => Object.entries(data).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ');
const button = (text, action, kind = 'text', data = {}, disabled = false) => `<button type="button" class="btn ${kind}" data-action="${action}" ${attrs(data)} ${disabled?'disabled':''}>${text}</button>`;
const time = n => `${String(Math.floor(Number(n)/60)).padStart(2,'0')}:${String(Number(n)%60).padStart(2,'0')}`;
export function exerciseAction(plan, action, e, index, extra = {}) {
  if (plan) {
    const map = { 'exercise-menu':'menu','set-menu':'set-menu','rest-detail':'rest','add-set':'add-set','duplicate-set':'duplicate-last','warmup':'warmup','tempo':'tempo','demo':'demo' };
    return { action:`social-copy-${map[action] || action}`, data:{ index, ...extra } };
  }
  if (['warmup','tempo'].includes(action)) return {action:'open',data:{id:e.id,modal:action,...extra}};
  if (action==='set-menu') return {action,data:{id:e.id,index:extra.row}};
  return {action,data:{id:e.id,...extra}};
}
export function renderWorkoutExercise(e, index, { plan = false, layoutStudy = false, effortScale = 'RPE', renderCardio, renderNote, replacement = null, undo = '' } = {}) {
  const act=(name,extra={})=>exerciseAction(plan,name,e,index,extra);
  const control=(label,name,kind='text',extra={},disabled=false)=>{const a=act(name,extra);return button(label,a.action,kind,a.data,disabled);};
  const tool=(label,name,accessible='')=>{const a=act(name);return `<button type="button" data-action="${a.action}" ${attrs(a.data)} ${accessible?`aria-label="${esc(accessible)}"`:''}>${label}</button>`;};
  const iconButton=(label,name,symbol,extra={})=>{const a=act(name,extra);return `<button class="icon-button" data-action="${a.action}" ${attrs(a.data)} aria-label="${esc(label)}">${notebookIcon(symbol)}</button>`;};
  const cell=(key,row,j)=>{
    const effort=key==='rpe',label=effort?`${plan?'Target ':''}${effortScale}`:key==='weight'?e.unit:'Reps';
    const value=effort?effortValue(plan?row.targetRpe:row.rpe,effortScale):row[key];
    return `<label><span class="cell-label">${esc(label)}</span><input class="set-input" type="text" inputmode="${key==='reps'?'numeric':'decimal'}" ${plan?`data-copy-field="${effort?'targetRpe':key}" data-copy-ex="${index}" data-copy-row="${j}"`:`data-set="${esc(e.id)}" data-index="${j}" data-field="${key}"`} value="${esc(value)}" aria-label="${esc(e.name)}, set ${j+1}, ${esc(label)}" autocomplete="off" spellcheck="false"></label>`;
  };
  const bodyweight=e.mode==='bodyweight',keys=bodyweight?['reps','rpe']:['weight','reps','rpe'];
  const columns=`<span>Set</span>${!plan?'<span>Last</span>':''}${bodyweight?'':`<span>${esc(e.unit)}</span>`}<span>Reps</span><span>${effortScale}</span>${!plan?'<span>Done</span>':''}`;
  const grid=bodyweight?'bodyweight-grid bodyweight-row':'set-grid set-row';
  const rows=e.sets.map((row,j)=>{
    const shown=setDisplayRows(e)[j],a=act('set-menu',{row:j});
    const last=plan?'':bodyweight?`<span class="last-value">${row.type==='warmup'?'':'No record'}</span>`:row.type==='warmup'?'<span class="last-value" aria-hidden="true"></span>':`<button class="last-value" data-action="copy-last" data-id="${esc(e.id)}" data-index="${j}" ${shown.previous?'':'disabled'} aria-label="${esc(e.name)}, set ${j+1}, copy previous ${esc(lastText(shown.previous,effortScale))}">${esc(lastText(shown.previous,effortScale))}</button>`;
    const done=plan?'':`<button class="done" data-action="done" data-id="${esc(e.id)}" data-index="${j}" aria-label="${esc(e.name)}, set ${j+1}, completed" aria-pressed="${!!row.done}"><span class="checkmark ${row.done?'checked':''}">${row.done?notebookIcon('check'):''}</span></button>`;
    return `<div class="${grid} ${!plan&&row.done?'completed':''}"><button class="set-marker" data-action="${a.action}" ${attrs(a.data)} aria-label="${esc(e.name)}, set ${shown.marker}, ${row.type || 'normal'}, options">${shown.marker}</button>${last}${keys.map(k=>cell(k,row,j)).join('')}${done}</div>`;
  }).join('');
  const basicField=(label,key,value)=>`<label class="field"><span>${label}</span><input data-copy-field="${key}" data-copy-ex="${index}" data-copy-row="" value="${esc(value)}"></label>`;
  const cardio=e.mode!=='cardio'?'':plan?`<div class="cardio-fields">${basicField('Time / min:sec','time',e.time)}${basicField(`Distance / ${esc(e.unit)}`,'distance',e.distance)}</div>`:renderCardio(e);
  const sets=e.mode==='cardio'?cardio:`<div class="set-table" role="group" aria-label="${esc(e.name)} sets"><div class="${bodyweight?'bodyweight-grid':'set-grid'} table-header" aria-hidden="true">${columns}</div>${rows}</div>`;
  const menu=act('exercise-menu'),name=plan?menu:{action:'history',data:{id:e.id}};
  const note=plan?`<label class="field"><span>Instructions</span><textarea data-copy-field="instructions" data-copy-ex="${index}" maxlength="500" placeholder="Add instructions for the recipient">${esc(e.instructions)}</textarea></label>`:renderNote(e);
  return `<section class="exercise ${plan?'sharing-plan-card':''} ${bodyweight?'sharing-bodyweight':''}" data-exercise="${esc(e.id)}" ${plan?`data-copy-card="${index}"`:''} aria-label="${esc(e.name)}"><div class="exercise-heading"><span class="ordinal">${String(index+1).padStart(2,'0')}</span><button class="name" data-action="${name.action}" ${attrs(name.data)}>${esc(e.name)}</button>${iconButton(`${e.name}, options`,'exercise-menu','more')}</div>${replacement?renderReplacementPicker(e,index,{plan,...replacement}):''}${layoutStudy ? `<div class="exercise-controls study-tools">${tool(`<span class="study-tool-label">${notebookIcon('play')}Demo</span>`,'demo')}${tool(`<span class="study-tool-label" aria-label="Rest ${time(e.rest)}">${notebookIcon('clock')}${time(e.rest)}</span>`,'rest-detail',`Rest ${time(e.rest)}`)}${e.mode!=='cardio'?tool(`<span class="study-tool-label" aria-label="Tempo ${esc(e.tempo || 'not set')}">${notebookIcon('speedometer')}${esc(e.tempo || 'Tempo')}</span>`,'tempo',`Tempo ${e.tempo || 'not set'}`):`<button data-action="layout-zone" data-id="${esc(e.id)}"><span class="study-tool-label">${notebookIcon('heart')}Zone ${esc(e.zone || '\u2014')}</span></button>`}` : `<div class="exercise-controls ${e.mode==='cardio'?'cardio-controls':''}">${tool(`${notebookIcon('play')}Demo`,'demo')}${tool(`${notebookIcon('clock')}Rest ${time(e.rest)}`,'rest-detail')}${e.mode!=='cardio'?tool(`${notebookIcon('speedometer')}<span>Tempo</span>${e.tempo?`<span>${esc(e.tempo)}</span>`:''}`,'tempo'):layoutStudy?`<button class="btn text" data-action="layout-zone" data-id="${esc(e.id)}">${notebookIcon('heart')}<span>Zone ${esc(e.zone || '\u2014')}</span></button>`:''}` }</div><div class="exercise-note">${note}</div>${e.mode==='resistance'?`<div class="warmup-entry">${control('+ Add warm-up','warmup')}</div>`:''}${!plan && targetSummary(e.targets,effortScale) ? control(`Target: ${esc(targetSummary(e.targets,effortScale))}`,'exercise-targets','text exercise-target-summary') : ''}${sets}${e.mode!=='cardio'?`<div class="set-actions">${control('+ Add set','add-set')}${control('Duplicate last set','duplicate-set')}</div>`:''}${undo}</section>`;
}
export function renderExerciseMenu(e,index,count,{plan=false,effortScale='RPE'}={}) {
  const a=(name,data={})=>({action:plan?`social-copy-${name}`:name,data});
  const b=(label,name,kind='',data={},disabled=false)=>{const v=a(name,data);return button(label,v.action,kind,v.data,disabled);};
  const units=e.mode==='cardio'?['km','mi']:['kg','lbs'];
  return `<div class="workout-option-units">${notebookIcon(e.mode==='cardio'?'map':'workout')}<div class="chip-grid" style="--columns:2">${units.map(unit=>b(unit,plan?'set-unit':'unit',`chip ${e.unit===unit?'selected':''}`,{value:unit})).join('')}</div></div>${!plan && e.mode==='resistance'?b(`${notebookIcon('options')}<span>Targets</span><span class="target-menu-summary">${esc(targetSummary(e.targets,effortScale) || 'Not set')}</span>`,'exercise-targets','workout-option target-menu-option'):''}${e.mode==='resistance'?b(`${notebookIcon('options')}Available weights`,plan?'weights':'exercise-weights','workout-option'):''}<div class="reorder-row">${notebookIcon('reorder')}<span>Reorder</span>${b('Up',plan?'move-up':'move','',{direction:-1},index===0)}${b('Down',plan?'move-down':'move','',{direction:1},index===count-1)}</div>${b(`${notebookIcon('swap')}Replace exercise`,plan?'replace':'replace-inline','workout-option')}${b(`${notebookIcon('star')}${e.favorite?'Added to favorites':'Add to favorites'}`,plan?'favorite':'exercise-favorite','workout-option')}${b(`${notebookIcon('trash')}Delete exercise`,plan?'remove-exercise':'delete-exercise','workout-option danger')}`;
}
export const replacementCatalog=[...catalog,['machine-press','Machine chest press','Machine / Chest'],['dumbbell-bench','Dumbbell bench press','Dumbbell / Chest']];
export function replacementExercise(id) {
  const row=replacementCatalog.find(row=>row[0]===id);
  return exerciseFromReplacement(id,row?.[1]);
}
// Supplied by the same fixture factory as Add exercise; no history is invented.
export function renderReplacementPicker(e,index,{plan=false,query='',group='All'}={}) {
  const action=name=>plan?`social-copy-${name}`:`exercise-replace-${name}`;
  const groups=['All','Chest','Back','Legs','Arms','Cardio'];
  const matches=replacementCatalog.filter(row=>row[0]!==e.id&&row[1]!==e.name&&row[1].toLowerCase().includes(query.trim().toLowerCase())&&(group==='All'||(group==='Legs'?/leg|hamstring|quad/i.test(row[2]):group==='Arms'?/bicep|tricep|arm/i.test(row[2]):row[2].toLowerCase().includes(group.toLowerCase()))));
  return `<section class="workout-replacement" aria-label="Replace ${esc(e.name)}"><div class="search-wrap"><input ${plan?'data-copy-field="replaceQuery" data-copy-ex="" data-copy-row=""':'data-replace-query'} value="${esc(query)}" placeholder="Search to replace" aria-label="Search to replace">${query?button('×',action('replace-clear'),'search-clear'):''}</div><div class="workout-replace-groups">${groups.map(g=>button(g,action('replace-group'),`chip ${group===g?'selected':''}`,{value:g})).join('')}</div><div class="workout-replace-results">${matches.map(([id,name,meta])=>`<button class="result-row" data-action="${action('replace-pick')}" data-id="${id}">${notebookIcon('swap')}<span><strong>${esc(name)}</strong><small>${esc(meta)}</small></span></button>`).join('') || '<p class="supporting">No matching exercises in this example catalog.</p>'}</div>${button('Cancel replacement',action('replace-cancel'))}</section>`;
}
