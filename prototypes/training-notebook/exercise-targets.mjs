import { notebookIcon } from './notebook-icons.mjs';
import { effortValue } from './model.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function targetSummary(targets, scale = 'RPE') {
  if (!targets) return '';
  return [targets.min != null ? `${targets.min}\u2013${targets.max} reps` : '', targets.rpe != null ? `${scale} ${effortValue(targets.rpe, scale)}` : ''].filter(Boolean).join(' \u00b7 ');
}
export function targetDraft(exercise, scale) {
  return { min: String(exercise.targets?.min ?? ''), max: String(exercise.targets?.max ?? ''), effort: effortValue(exercise.targets?.rpe, scale), scale, error: '', editing: null };
}
export function readTargets(draft) {
  const lo = draft.min.trim(), hi = draft.max.trim(), effort = draft.effort.trim();
  if (Boolean(lo) !== Boolean(hi)) return { error: 'Enter both ends of the rep range, or leave both blank.' };
  if (lo && (!/^\d+$/.test(lo) || !/^\d+$/.test(hi) || Number(lo) < 1 || Number(hi) > 100 || Number(lo) > Number(hi))) return { error: 'Enter a whole rep range from 1 to 100, with minimum no greater than maximum.' };
  if (effort && (!Number.isFinite(Number(effort)) || Number(effort) < (draft.scale === 'RPE' ? 6 : 0) || Number(effort) > (draft.scale === 'RPE' ? 10 : 4))) return { error: draft.scale === 'RPE' ? 'Enter RPE from 6 to 10, or leave it blank.' : 'Enter RIR from 0 to 4, or leave it blank.' };
  return { value: !lo && !effort ? null : { min: lo ? Number(lo) : null, max: hi ? Number(hi) : null, rpe: effort ? draft.scale === 'RPE' ? Number(effort) : 10 - Number(effort) : null } };
}
export function targetsChanged(exercise, draft) {
  const result = readTargets(draft);
  if (result.error) return true;
  const original = exercise.targets;
  const baseline = !original || original.min == null && original.rpe == null ? null : { min: original.min ?? null, max: original.max ?? null, rpe: original.rpe ?? null };
  return JSON.stringify(result.value) !== JSON.stringify(baseline);
}
export function refreshTargetActions(root, exercise, draft) {
  const done = root.querySelector('[data-action="targets-done"]');
  const clear = root.querySelector('[data-action="targets-clear"]');
  if (done) done.hidden = !targetsChanged(exercise, draft);
  if (clear) clear.hidden = ![draft.min, draft.max, draft.effort].some(value => value.trim());
  const rangeValue = root.querySelector('[data-action="targets-edit"][data-value="range"] .target-row-value>span');
  const effort = root.querySelector('[data-action="targets-edit"][data-value="effort"] .target-row-value>span');
  if (rangeValue) rangeValue.textContent = draft.min.trim() || draft.max.trim() ? `${draft.min.trim() || '\u2014'}\u2013${draft.max.trim() || '\u2014'}` : 'Not set';
  if (effort) effort.textContent = draft.effort.trim() || 'Not set';
}
export function renderTargetsSheet(exercise, draft, { shell, button }) {
  const rangeField = (label, key) => `<label class="field"><span>${label}</span><input data-target-field="${key}" value="${esc(draft[key])}" inputmode="numeric" maxlength="3" placeholder="\u2014" aria-label="${key === 'min' ? 'Minimum' : 'Maximum'} reps"></label>`;
  const rangeValue = draft.min.trim() || draft.max.trim() ? `${draft.min.trim() || '\u2014'}\u2013${draft.max.trim() || '\u2014'}` : 'Not set';
  const row = (label, key, value, fields) => `<div class="target-field"><button type="button" class="target-toggle" data-action="targets-edit" data-value="${key}" aria-expanded="${draft.editing === key}"><span class="target-row-label">${label}</span><span class="target-row-value"><span>${esc(value)}</span>${notebookIcon(draft.editing === key ? 'down' : 'right')}</span></button>${draft.editing === key ? fields : ''}</div>`;
  const body = `<div class="exercise-target-editor"><h3 class="target-exercise-name">${esc(exercise.name)}</h3><div class="target-rows">${row('Target reps', 'range', rangeValue, `<div class="target-range-fields">${rangeField('Min', 'min')}<span class="target-dash">\u2013</span>${rangeField('Max', 'max')}</div>`)}${row(`Target ${draft.scale}`, 'effort', draft.effort.trim() || 'Not set', `<div class="target-effort-fields"><input id="target-effort" data-target-field="effort" value="${esc(draft.effort)}" inputmode="decimal" placeholder="\u2014" aria-label="Target ${draft.scale}" class="target-effort-input"></div>`)}</div>${draft.error ? `<p class="form-error" role="alert">${esc(draft.error)}</p>` : ''}</div>`;
  const title = `Targets<button type="button" class="icon-button target-info" data-action="targets-help" aria-label="About exercise targets">${notebookIcon('info')}</button>`;
  const done = button('Done', 'targets-done', 'primary').replace('<button ', `<button ${targetsChanged(exercise, draft) ? '' : 'hidden '}`);
  const clear = button('Clear targets', 'targets-clear').replace('<button ', `<button ${[draft.min, draft.max, draft.effort].some(value => value.trim()) ? '' : 'hidden '}`);
  return shell(title, body, done + clear).replace('class="sheet ', 'class="sheet targets-sheet ');
}
