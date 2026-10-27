import { renderWorkoutExercise, renderExerciseMenu, replacementExercise } from './workout-exercise-ui.mjs';
import { suggestWarmups, newWarmups, insertWarmups, warmupError, workingSet, prepareWarmupPreview, rememberWarmups } from './warmup.mjs';
import { renderWarmupSheet, updateWarmupControls } from './workout-warmup-ui.mjs';
import { installWarmupGestures } from './warmup-gestures.mjs';
// An isolated synthetic plan editor. Never references the active workout draft.
import { catalog, exerciseFromCatalog, setUnit } from './model.mjs';
import { notebookIcon } from './notebook-icons.mjs';
import { workoutPlanPreview, planForSharing, planSetMarkers } from './sharing.mjs';
import { readNotebookPreferences } from './notebook-preferences.mjs';

export function startSharingCopy(s, item) {
  const plan = planForSharing(item.sharing.plan);
  if (!item.sharing.weights) plan.forEach(ex => ex.sets.forEach(row => { row.weight = ''; }));
  s.social.editCopy = { source: item.id, title: item.title, plan, weights: item.sharing.weights, effortScale: item.sharing.effortScale || readNotebookPreferences()?.profile?.units?.effort || 'RPE', recipients: item.recipients.map(p => p.id), query: '', serial: 0, error: '' };
}
export function sharingCopyError(draft) {
  if (!draft.title.trim()) return 'Enter a workout name.';
  if (!draft.plan.length) return 'Add at least one exercise.';
  for (const ex of draft.plan) {
    if (!Number.isInteger(Number(ex.rest)) || Number(ex.rest) < 0) return 'Use whole seconds of zero or more for rest.';
    if (ex.tempo && !/^(?:\d{1,2}|X)(?:-(?:\d{1,2}|X)){3}$/i.test(ex.tempo)) return 'Use four tempo parts, such as 3-0-1-0.';
    if (ex.mode === 'cardio') {
      if (ex.time && !/^\d+:[0-5]\d$/.test(ex.time)) return 'Use minutes:seconds for cardio time.';
      if (ex.distance && (!Number.isFinite(Number(ex.distance)) || Number(ex.distance) < 0)) return 'Enter a distance of zero or more.';
    } else {
      if (!ex.sets.length) return 'Add at least one set per exercise.';
      if (ex.sets.some(row => !String(row.reps).trim() || !Number.isInteger(Number(row.reps)) || Number(row.reps) <= 0)) return 'Enter whole reps above zero.';
      if (ex.sets.some(row => String(row.weight ?? '').trim() && (!Number.isFinite(Number(row.weight)) || Number(row.weight) < 0))) return 'Enter weights of zero or more, or leave them blank.';
      if (ex.sets.some(row => row.targetRpe !== '' && row.targetRpe != null && (!Number.isFinite(Number(row.targetRpe)) || Number(row.targetRpe) < 6 || Number(row.targetRpe) > 10))) return 'Use target RPE 6–10 or RIR 0–4, or leave effort blank.';
    }
  }
  return '';
}
export function sharingCopyDialog(s, { shell, escape: esc, paragraph: p }) {
  const d = s.social.editCopy;
  if (!d) return shell('Workout unavailable', p('Return to Sent and choose a workout.'), '<button class="btn primary" data-action="social-sent">Back to Sent</button>');
  const btn = (label, action, kind = '', extra = '') => `<button class="btn ${kind}" data-action="social-copy-${action}" ${extra}>${label}</button>`;
  const field = (label, key, value, ex = '', row = '') => `<label class="field"><span>${esc(label)}</span><input ${['weight','reps','targetRpe'].includes(key) ? 'class="set-input"' : ''} data-copy-field="${key}" data-copy-ex="${ex}" data-copy-row="${row}" value="${esc(value ?? '')}" ${['weight','reps','targetRpe','rest','distance'].includes(key) ? `inputmode="${['reps','rest'].includes(key) ? 'numeric' : 'decimal'}"` : ''} ${key === 'title' ? 'maxlength="80"' : ''}></label>`;
  const selected = d.plan[d.exercise];
  const time = n => `${String(Math.floor(Number(n) / 60)).padStart(2,'0')}:${String(Number(n) % 60).padStart(2,'0')}`;
  const card=(ex,i)=>renderWorkoutExercise(ex,i,{plan:true,effortScale:d.effortScale,replacement:d.replaceIndex===i?{query:d.replaceQuery || '',group:d.replaceGroup || 'All'}:null});

  switch (s.modal) {
    case 'social-copy-warmup': return renderWarmupSheet(selected,d.warmup,{shell,plan:true});
    case 'social-copy-editor': return shell('Edit workout', p('Edits won’t change your active workout or the original sent workout.') + field('Workout name','title',d.title) + `<div class="share-copy-effort"><span>Target effort</span>${btn('RPE','effort-rpe',d.effortScale === 'RPE' ? 'primary' : '',`aria-pressed="${d.effortScale === 'RPE'}"`)}${btn('RIR','effort-rir',d.effortScale === 'RIR' ? 'primary' : '',`aria-pressed="${d.effortScale === 'RIR'}"`)}</div><div class="share-copy-exercises">${d.plan.map(card).join('')}</div>` + btn('+ Add exercise','add-exercise') + `<button class="share-toggle" aria-pressed="${d.weights}" data-action="social-copy-weights"><span class="checkmark ${d.weights ? 'checked' : ''}">${d.weights ? '✓' : ''}</span>Include weights</button>` + (d.error ? `<p class="share-error" role="alert">${esc(d.error)}</p>` : ''), btn('Review workout','review','primary') + btn('Cancel','cancel'));
    case 'social-copy-review': return shell('Review edited workout', workoutPlanPreview(d,esc).preview + p(d.weights ? 'Weights included' : 'Weights not shared'), btn('Choose recipients','recipients','primary') + btn('Back to editing','back'));
    case 'social-copy-replace-confirm': return shell('Replace exercise?',p('This will reset the planned sets for this exercise.'),btn('Replace','replace-confirm','primary')+btn('Cancel','back'));
    case 'social-copy-weights': return shell('Available weights',field(`Weight increment / ${selected.unit}`,'step',d.step)+p('Used for rounding suggestions in this plan. Your active workout preferences stay unchanged.')+(d.error?p(esc(d.error),'share-error'):''),btn('Save settings','save-weights','primary')+btn('Back to editing','back'));
    case 'social-copy-demo': return shell(esc(selected.name),p('Demonstration media is not included in this browser study.'),btn('Back to editing','back'));
    case 'social-copy-rest': return shell('Rest', field('Rest / seconds','rest',selected.rest,d.exercise) + `<div class="chip-grid">${[60,90,120,180].map(n=>btn(time(n),'rest-preset','',`data-value="${n}"`)).join('')}</div>`,btn('Done','back','primary'));
    case 'social-copy-tempo': return shell('Tempo', p('Eccentric / hold / concentric / hold') + field('Tempo','tempo',selected.tempo,d.exercise) + p('For example, 3-0-1-0. Use X for an explosive phase.'),btn('Done','back','primary'));
    case 'social-copy-menu': return shell(esc(selected.name),renderExerciseMenu(selected,d.exercise,d.plan.length,{plan:true}),btn('Back to editing','back'));
    case 'social-copy-set-menu': return shell('Set options', `<h3>Set type</h3><div class="chip-grid">${[['normal','Normal'],['warmup','Warm-up'],['failure','Failure'],['drop','Drop']].map(([value,label])=>btn(label,'set-type',selected.sets[d.row].type === value ? 'primary' : '',`data-value="${value}"`)).join('')}</div>` + btn('Duplicate set','duplicate-set') + btn('Delete set','delete-set','danger'),btn('Back to editing','back','primary'));
    case 'social-copy-search': {
      const matches=catalog.filter(row=>row[1].toLowerCase().includes(d.query.trim().toLowerCase()));
      return shell(d.replacing ? 'Replace exercise' : 'Add exercise',field('Search exercises','query',d.query) + (d.query ? btn('Clear search','clear-query') : '') + `<div class="social-people">${matches.length ? matches.map(([id,name,meta])=>`<button class="social-person" data-action="social-copy-pick" data-id="${id}"><span><strong>${esc(name)}</strong><small>${esc(meta)}</small></span></button>`).join('') : p('No matching exercises in this example catalog.')}</div>`,btn('Back to editing','back'));
    }
    default:return '';
  }
}

export function handleSharingCopy(s, action, data, open) {
  const a = s.social, d = a.editCopy;
  if (!action.startsWith('social-copy-')) return false;
  if (!d) { open('social-sent'); return true; }
  d.error = '';
  switch (action.slice(12)) {
    case 'warmup': {
      d.exercise=Number(data.index);const ex=d.plan[d.exercise];d.warmup=prepareWarmupPreview(ex,d.warmupPatterns?.[ex.id] || null,Number(d.step) || 2.5);open('social-copy-warmup');break;
    }
    case 'warmup-suggest': {
      const proposed=suggestWarmups(d.warmup.weight,d.warmup.pattern,Number(d.step) || 2.5);d.warmup.rows=newWarmups(proposed,d.plan[d.exercise].sets.filter(row=>row.type==='warmup'));d.warmup.kept=proposed.filter(row=>!d.warmup.rows.includes(row));break;
    }
    case 'warmup-remove': d.warmup.rows.splice(Number(data.index),1);d.warmup.swiped=null;break;
    case 'warmup-add-row': d.warmup.rows.push({weight:'',reps:'',manual:true,fixed:false});break;
    case 'warmup-apply': {
      if(warmupError(d.warmup.rows,d.warmup.weight))break;const ex=d.plan[d.exercise];const added=newWarmups(d.warmup.rows,ex.sets.filter(row=>row.type==='warmup'));
      ex.sets=insertWarmups(ex.sets,added);d.warmupPatterns ??={};d.warmupPatterns[ex.id]=rememberWarmups([...d.warmup.kept,...d.warmup.rows],d.warmup.weight);open('social-copy-editor');break;
    }
    case 'cancel': a.viewingSent = d.source; a.editCopy = null; open('social-sent-preview'); break;
    case 'dismiss':
      if (['social-copy-editor','social-copy-review'].includes(s.modal)) { a.viewingSent = d.source; a.editCopy = null; open('social-sent-preview'); }
      else open('social-copy-editor'); break;
    case 'back': open('social-copy-editor'); break;
    case 'weights': d.weights = !d.weights; break;
    case 'review': d.error = sharingCopyError(d); if (!d.error) open('social-copy-review'); break;
    case 'recipients':
      s.sharing = { title: d.title.trim(), plan: planForSharing(d.plan, d.weights), weights: d.weights, effortScale: d.effortScale, used: false, routineSaved: false };
      a.selected = d.recipients.filter(id => !a.blocked.includes(id));
      open('social-search'); break;
    case 'effort-rpe': d.effortScale = 'RPE'; break;
    case 'effort-rir': d.effortScale = 'RIR'; break;
    case 'rest': case 'tempo': d.exercise = Number(data.index); open(`social-copy-${action.slice(12)}`); break;
    case 'rest-preset': d.plan[d.exercise].rest = Number(data.value); open('social-copy-editor'); break;
    case 'set-type': d.plan[d.exercise].sets[d.row].type = data.value; open('social-copy-editor'); break;
    case 'set-unit': {
      const ex = d.plan[d.exercise];
      if (ex.unit !== data.value) {
        if (ex.mode === 'cardio') { ex.distance = ex.distance ? String(Number((Number(ex.distance)*(data.value === 'mi' ? 0.6213711922 : 1/0.6213711922)).toFixed(2))) : ''; ex.unit = data.value; }
        else d.plan[d.exercise] = setUnit({ ...ex, previous: [] }, data.value);
      }
      open('social-copy-menu'); break;
    }
    case 'duplicate-last': { const ex=d.plan[Number(data.index)]; if(ex.sets.length) ex.sets.push(structuredClone(ex.sets.at(-1))); break; }
    case 'menu': d.exercise = Number(data.index); open('social-copy-menu'); break;
    case 'replace': d.replaceIndex=d.exercise; d.replaceQuery=''; d.replaceGroup='All'; open('social-copy-editor'); break;
    case 'replace-group': d.replaceGroup=data.value; break;
    case 'replace-clear': d.replaceQuery=''; break;
    case 'replace-cancel': d.replaceIndex=null; break;
    case 'replace-pick': d.pendingReplacement=data.id; open('social-copy-replace-confirm'); break;
    case 'replace-confirm': { const ex=planForSharing([replacementExercise(d.pendingReplacement)])[0]; ex.id=`copy-${d.pendingReplacement}-${++d.serial}`; d.plan.splice(d.replaceIndex,1,ex);d.replaceIndex=null;open('social-copy-editor');break; }
    case 'favorite': d.plan[d.exercise].favorite=!d.plan[d.exercise].favorite;break;
    case 'demo': d.exercise=Number(data.index);open('social-copy-demo');break;
    case 'weights': d.step=d.step || 2.5;open('social-copy-weights');break;
    case 'save-weights': if(Number(d.step)>0)open('social-copy-menu');else d.error='Enter an increment above zero.';break;
    case 'add-exercise': d.replacing = false; d.query = ''; open('social-copy-search'); break;
    case 'clear-query': d.query = ''; break;
    case 'pick': {
      const ex = planForSharing([exerciseFromCatalog(data.id)])[0]; ex.id = `copy-${data.id}-${++d.serial}`;
      if (d.replacing) d.plan.splice(d.exercise, 1, ex); else d.plan.push(ex);
      open('social-copy-editor'); break;
    }
    case 'move-up': case 'move-down': {
      const next = d.exercise + (action.endsWith('up') ? -1 : 1);
      if (next >= 0 && next < d.plan.length) { [d.plan[d.exercise],d.plan[next]]=[d.plan[next],d.plan[d.exercise]];d.exercise=next; }
      open('social-copy-menu'); break;
    }
    case 'remove-exercise': d.plan.splice(d.exercise, 1); open('social-copy-editor'); break;
    case 'add-set': d.plan[Number(data.index)].sets.push({ weight: '', reps: '', type: 'normal', targetRpe: '' }); break;
    case 'set-menu': d.exercise = Number(data.index); d.row = Number(data.row); open('social-copy-set-menu'); break;
    case 'duplicate-set': d.plan[d.exercise].sets.splice(d.row + 1, 0, structuredClone(d.plan[d.exercise].sets[d.row])); open('social-copy-editor'); break;
    case 'delete-set': d.plan[d.exercise].sets.splice(d.row, 1); open('social-copy-editor'); break;
  }
  return true;
}
export function sharingCopyInput(s, el, render) {
  const key = el.dataset.copyField, d = s.social.editCopy;
  if(d?.warmup && (el.dataset.copyWarmupField || el.hasAttribute('data-copy-warmup-weight'))) {
    if(el.dataset.copyWarmupField)d.warmup.rows[Number(el.dataset.copyWarmupRow)][el.dataset.copyWarmupField]=el.value;
    else d.warmup.weight=el.value;
    updateWarmupControls(document.querySelector('#stage'),d.plan[d.exercise],d.warmup,{plan:true});return true;
  }
  if (!key || !d) return false;
  if (key === 'step') d.step=el.value;
  else if (key === 'replaceQuery') d.replaceQuery=el.value;
  else if (key === 'targetRpe') d.plan[Number(el.dataset.copyEx)].sets[Number(el.dataset.copyRow)].targetRpe = el.value === '' ? '' : d.effortScale === 'RIR' ? String(10-Number(el.value)) : el.value;
  else if (['title','query'].includes(key)) d[key] = el.value;
  else if (['weight','reps'].includes(key)) d.plan[Number(el.dataset.copyEx)].sets[Number(el.dataset.copyRow)][key] = el.value;
  else d.plan[Number(el.dataset.copyEx)][key] = el.value;
  d.error = '';
  if (['query','replaceQuery'].includes(key)) { const at = el.selectionStart; render(); const next = document.querySelector(`[data-copy-field="${key}"]`); next?.focus({preventScroll:true}); next?.setSelectionRange(at, at); }
  return true;
}
export function installSharingEditorGestures(stage, getState, render) {
  installWarmupGestures(stage,{selector:'[data-copy-warmup-swipe]',rowAttribute:'data-copy-warmup-swipe',deleteSelector:'.sheet .warmup-delete',read:()=>getState()?.social?.editCopy?.warmup,render});
}
