import { notebookIcon as icon } from './notebook-icons.mjs';
import { effortValue } from './model.mjs';
import { checkInFields, painValidation } from './check-in.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderUnifiedChanges(s,scale) {
 const u=s.unified;
 const rows=u.changes.map(c=>`<section class="up-change"><div class="up-change-top">${c.manual?icon('info'):`<label class="up-select"><input type="checkbox" data-up-select="${esc(c.id)}" ${u.selected.includes(c.id)?'checked':''} aria-label="Apply change for ${esc(c.name)}"></label>`}<button class="up-change-description" data-action="up-expand" data-value="${esc(c.id)}" aria-expanded="${u.expanded.includes(c.id)}"><span class="up-change-title"><strong>${esc(c.name)}</strong></span><span class="up-prescription-row"><span>${esc(c.before)}</span>${c.manual?'':icon('arrow')}<span class="up-proposed">${esc(c.after)}</span></span><span class="up-change-caret"><span class="up-disclosure-icon ${u.expanded.includes(c.id)?'expanded':''}">${icon('right')}</span></span></button></div>${u.expanded.includes(c.id)?`<div class="up-change-reason"><p class="supporting">${esc(c.reason)}</p>${!c.manual?`<p class="supporting">Target: ${s.exercises.find(e=>e.id===c.id).targets.min}–${s.exercises.find(e=>e.id===c.id).targets.max} reps · ${scale} ${effortValue(8,scale)}</p>`:''}</div>`:''}</section>`).join('');
 const kept=s.exercises.filter(e=>!u.changes.some(c=>c.id===e.id));
 return `<div class="up-change-list">${rows}</div>`+(kept.length?`<div class="up-unchanged"><button class="up-text-row" data-action="up-unchanged" aria-expanded="${u.unchanged}">${u.unchanged?'Hide':'Show'} ${kept.length} unchanged exercise${kept.length===1?'':'s'} <span class="up-disclosure-icon ${u.unchanged?'expanded':''}">${icon('right')}</span></button>${u.unchanged?kept.map(e=>`<p class="supporting">${esc(e.name)} · Keep planned sets</p>`).join(''):''}</div>`:'');
}
export const missingInputsInvalid=u=>!u.inputDraft||Boolean(painValidation(u.inputDraft))||Object.values(u.inputDraft.ratings).some(value=>value!==''&&(!Number.isInteger(Number(value))||Number(value)<0||Number(value)>10));
export function renderMissingInputs(s,{shell,button}) {
 const u=s.unified;
 return shell('Recovery check-in',`<div class="up-stack">${checkInFields(u.inputDraft)}${u.inputError?`<p class="form-error" role="alert">${esc(u.inputError)}</p>`:''}</div>`,button('Save check-in','up-save-inputs','primary',{},missingInputsInvalid(u))+button('Cancel','up-cancel-checkin'));
}
