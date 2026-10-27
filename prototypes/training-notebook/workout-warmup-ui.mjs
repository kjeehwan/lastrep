import { workingSet, newWarmups, warmupError } from './warmup.mjs';
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const paragraph=(value,cls='supporting')=>`<p class="${cls}">${value}</p>`;
const button=(label,action,kind='text',data={},disabled=false)=>`<button type="button" class="btn ${kind}" data-action="${action}" ${Object.entries(data).map(([key,value])=>`data-${key}="${escape(value)}"`).join(' ')} ${disabled?'disabled':''}>${label}</button>`;
export function renderWarmupSheet(e, draft, { shell, plan=false } = {}) {
  const existing = e.sets.filter(row => row.type === 'warmup');
  const count = newWarmups(draft.rows, existing).length, error = warmupError(draft.rows, draft.weight);
  const html = shell('Add warm-up sets', `<div class="warmup-context"><span class="supporting">${escape(e.name)}</span><strong>First working set</strong><span class="warmup-working">${escape(workingSet(e)?.weight || '\u2014')} ${e.unit} &times; ${escape(workingSet(e)?.reps || '\u2014')} reps</span></div>
    ${draft.missing ? `<label class="field"><span>Working weight / ${e.unit}</span><input inputmode="decimal" data-warmup-weight value="${escape(draft.weight)}" placeholder="e.g. 100"></label>${button('Suggest sets', 'warmup-suggest', '')}${paragraph('Used for this preview; your working set stays unchanged.')}` : ''}
    ${existing.length ? `<div class="warmup-existing"><span class="label muted">Already in your workout</span>${existing.map(row => `<div><span>W</span><span>${escape(row.weight)} ${e.unit} &times; ${escape(row.reps)} reps${row.done ? ' · Done' : ''}</span></div>`).join('')}</div>` : ''}
    ${paragraph(draft.remembered ? 'Your last setup, adapted to this working weight.' : 'Adjust the weights and reps to suit your warm-up.')}
    <div class="warmup-rows"><div class="warmup-columns label muted" aria-hidden="true"><span>Set</span><span>${e.unit}</span><span>Reps</span></div>${draft.rows.map((row, index) => `<div class="warmup-swipe"><button class="warmup-delete" data-action="warmup-remove" data-index="${index}" aria-label="Delete warm-up ${index + 1}" ${draft.swiped === index ? '' : 'aria-hidden="true" tabindex="-1"'}>Delete</button><div class="warmup-edit-row ${draft.swiped === index ? 'revealed' : ''}" data-warmup-swipe="${index}" tabindex="0" aria-label="Warm-up ${index + 1}. Swipe left or press Left Arrow to reveal Delete."><span class="warmup-number">W</span>${['weight', 'reps'].map(key => `<input class="set-input" inputmode="${key === 'weight' ? 'decimal' : 'numeric'}" value="${escape(row[key])}" data-warmup-field="${key}" data-warmup-row="${index}" aria-label="Warm-up ${index + 1}, ${key === 'weight' ? e.unit : 'reps'}">`).join('')}</div></div>`).join('')}</div>
    <p class="supporting warmup-swipe-hint">Swipe left on a set to delete.</p>${button('+ Add a set', 'warmup-add-row', 'text')}
    <p class="form-error warmup-error" role="status">${draft.rows.length && error ? escape(error) : ''}</p>
    <p class="supporting warmup-memory">This setup is remembered for ${escape(e.name)} when you add it. Working sets stay unchanged.</p>`,
    button(count ? `Add ${count} warm-up set${count === 1 ? '' : 's'}` : existing.length ? 'Warm-up sets already added' : 'Add warm-up sets', 'warmup-apply', 'primary', {}, !!error || !count) + button('Cancel', 'close', ''));
  return plan ? html.replaceAll('data-action="warmup-', 'data-action="social-copy-warmup-').replaceAll('data-warmup-', 'data-copy-warmup-').replace('This setup is remembered for', 'This plan remembers the setup for') : html;
}
export function updateWarmupControls(stage,e,draft,{plan=false}={}) {
  const error=warmupError(draft.rows,draft.weight),count=newWarmups(draft.rows,e.sets.filter(row=>row.type==='warmup')).length;
  const apply=stage.querySelector(`[data-action="${plan?'social-copy-':''}warmup-apply"]`);
  if(!apply)return;apply.disabled=!!error||!count;apply.textContent=count?`Add ${count} warm-up set${count===1?'':'s'}`:'Warm-up sets already added';
  const message=stage.querySelector('.warmup-error');if(message)message.textContent=error;
}
