import { notebookIcon } from './notebook-icons.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const displayWeight = (kg, unit) => Number((kg * (unit === 'lbs' ? 2.2046226218 : 1)).toFixed(2));
const toKg = (value, unit) => Number(value) * (unit === 'lbs' ? 0.45359237 : 1);
export function beginProgressOptions(exercise, p, key) {
  p.editOption = key;
  p.optionDraft = { repSteps: p.options.repSteps.join(', '), preferredIncrease: p.options.preferredIncreaseKg == null ? '' : String(displayWeight(p.options.preferredIncreaseKg, exercise.unit)), weightIncrease: String(displayWeight(p.options.weightIncreaseKg, exercise.unit)) };
  p.optionError = '';
}
export function saveProgressOptions(exercise, p) {
  const d = p.optionDraft;
  const steps = d.repSteps.split(/[,;]+/).map(value => value.trim());
  if (!steps.length || steps.some((value,i) => !/^\d+$/.test(value) || +value < 1 || +value > 100 || (i > 0 && +value <= +steps[i-1]))) { p.optionError = 'Enter increasing whole reps from 1 to 100, separated by commas.'; return false; }
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(d.weightIncrease.trim()) || +d.weightIncrease <= 0 || +d.weightIncrease > 1000) { p.optionError = 'Enter a weight increase greater than zero, up to 1,000.'; return false; }
  const preferred = d.preferredIncrease.trim();
  if (preferred && (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(preferred) || +preferred <= 0 || +preferred > +d.weightIncrease)) { p.optionError = 'Preferred increase must be greater than zero and no larger than your maximum. Leave it blank to use the smallest available increase.'; return false; }
  p.options = { repSteps: steps.map(Number), preferredIncreaseKg: preferred ? toKg(preferred, exercise.unit) : null, weightIncreaseKg: toKg(d.weightIncrease, exercise.unit) };
  p.editOption = ''; p.optionError = ''; return true;
}
export function availableSummary(settings) {
  if (!settings) return 'Not set';
  return settings.mode === 'regular' ? `Every ${settings.increment} ${settings.unit}` : `${settings.values.length} weights \u00b7 ${settings.unit}`;
}
export function progressWeightHint(exercise, p) {
  const previous = exercise.previous.find(row => row.type !== 'warmup');
  if (!previous) return 'This limit is measured above your previous working weight.';
  const currentKg = toKg(previous.weight,exercise.unit);
  const draft = p.editOption === 'weightIncrease' ? Number(p.optionDraft.weightIncrease) : null;
  const increaseKg = Number.isFinite(draft) && draft > 0 ? toKg(draft,exercise.unit) : p.options.weightIncreaseKg;
  return `At ${displayWeight(currentKg,exercise.unit)} ${exercise.unit}, a +${displayWeight(increaseKg,exercise.unit)} ${exercise.unit} limit allows up to ${displayWeight(currentKg+increaseKg,exercise.unit)} ${exercise.unit}. If no heavier available load fits, repeat.`;
}
export function refreshProgressWeightHint(root, exercise, p) {
  const hint = root.querySelector('[data-max-increase-help]');
  if (hint) hint.textContent = progressWeightHint(exercise,p);
}
export function renderProgressOptions(exercise, p) {
  const option = (key, label, value, unit) => `<div><button type="button" class="progress-option" data-action="progression-option" data-key="${key}"><span>${label}</span><span>${esc(value)}${notebookIcon(p.editOption === key ? 'down' : 'right')}</span></button>${p.editOption === key ? `<div class="progress-option-input"><label class="field"><span>${label}${unit ? ` (${unit})` : ''}</span><input data-progress-option="${key}" value="${esc(p.optionDraft[key])}" inputmode="${key === 'repSteps' ? 'text' : 'decimal'}" aria-label="${label}" maxlength="399">${key === 'repSteps' ? '<small class="supporting">Separate steps with commas. The target range still sets the limits.</small>' : key === 'preferredIncrease' ? '<small class="supporting">Your usual increase after reaching the rep and effort targets. Leave blank to use the smallest available increase.</small>' : `<small class="supporting" data-max-increase-help>${esc(progressWeightHint(exercise,p))}</small>`}</label></div>` : ''}</div>`;
  return `<section class="progress-options" aria-label="Progress options">${option('repSteps', 'Rep steps', p.options.repSteps.join(', '), '')}${option('preferredIncrease', 'Preferred increase', p.options.preferredIncreaseKg == null ? 'Smallest available' : `+${displayWeight(p.options.preferredIncreaseKg, exercise.unit)} ${exercise.unit}`, exercise.unit)}${option('weightIncrease', 'Max weight increase', `+${displayWeight(p.options.weightIncreaseKg, exercise.unit)} ${exercise.unit}`, exercise.unit)}<button type="button" class="progress-option" data-action="progression-weights"><span>Available weights</span><span>${esc(availableSummary(exercise.availableWeights))}${notebookIcon('right')}</span></button>${!exercise.availableWeights ? '<p class="supporting">Set Available weights in the exercise menu to match your equipment.</p>' : ''}<p class="form-error" data-progress-option-error role="alert" ${p.optionError ? '' : 'hidden'}>${esc(p.optionError)}</p></section>`;
}
export function nextProgressPrescription(exercise, p) {
  const previous = exercise.previous.find(row => row.type !== 'warmup');
  const currentKg = previous ? toKg(previous.weight,exercise.unit) : 80;
  if (p.kind === 'reps') {
    const low = exercise.targets?.min ?? 6, high = exercise.targets?.max ?? 8;
    const previousReps = Math.min(...exercise.previous.filter(row => row.type !== 'warmup').map(row => Number(row.reps)));
    const candidates = [...new Set([low, high, ...p.options.repSteps.filter(value => value >= low && value <= high)])].sort((a,b) => a-b);
    return { weightKg: currentKg, reps: candidates.find(value => value > previousReps) ?? high, type: 'reps' };
  }
  if (p.kind !== 'weight') return { weightKg: currentKg, reps: 8, type: p.kind };
  const ceiling = currentKg + p.options.weightIncreaseKg, settings = exercise.availableWeights;
  const preferredKg = p.options.preferredIncreaseKg;
  const candidates = [];
  if (settings) {
    const factor = settings.unit === 'lbs' ? 0.45359237 : 1;
    if (settings.mode === 'custom') candidates.push(...settings.values.map(value => value * factor));
    else {
      const first = Math.max(0, Math.floor((currentKg / factor - settings.minimum) / settings.increment) + 1);
      const last = Math.floor((ceiling / factor - settings.minimum + 1e-6) / settings.increment);
      for (let step = first; step <= last && candidates.length < 10000; step++) candidates.push((settings.minimum + step * settings.increment) * factor);
    }
  } else if (preferredKg != null) candidates.push(currentKg + preferredKg);
  const available = [...new Set(candidates)].filter(value => value > currentKg + 1e-6 && value <= ceiling + 1e-6).sort((a,b) => a-b);
  const preferredCeiling = currentKg + (preferredKg ?? 0);
  let candidate = preferredKg == null ? available[0] : available.filter(value => value <= preferredCeiling + 1e-6).at(-1);
  // Synthetic comparable-session fixture for this UI study; not a production history engine.
  const evidence = p.comparableSession;
  const rows = evidence?.sets ?? [];
  const provenKg = rows.length === 3 && rows.every(row => row.weightKg === rows[0].weightKg && row.reps >= (exercise.targets?.min ?? 6) && row.rpe != null && row.rpe <= exercise.targets.rpe) ? rows[0].weightKg : null;
  const supported = available.find(value => provenKg != null && Math.abs(value - provenKg) < 1e-5);
  const useEvidence = supported != null && (candidate == null || supported > candidate);
  if (useEvidence) candidate = supported;
  return candidate != null
    ? { weightKg: candidate, reps: exercise.targets?.min ?? 6, type: 'weight', basis: useEvidence ? 'history' : preferredKg == null ? 'smallest' : 'preferred' }
    : { weightKg: currentKg, reps: Number(previous?.reps ?? 8), type: 'unavailable' };
}
export function beginProgressWeights(exercise, p, returnToProgress = false) {
  const settings = exercise.availableWeights;
  p.weightsReturn = returnToProgress;
  p.weightsDraft = { mode: settings?.mode ?? 'regular', unit: settings?.unit ?? exercise.unit, minimum: String(settings?.minimum ?? 20), increment: String(settings?.increment ?? 2.5), values: settings?.values?.join(', ') ?? '', error: '' };
}
export function renderProgressWeights(exercise, p, { shell, button }) {
  if (!p.weightsDraft) beginProgressWeights(exercise, p);
  const d = p.weightsDraft;
  const choices = (items, key) => `<div class="chip-grid" style="--columns:2">${items.map(([value,label]) => button(label,'progression-weight-choice',`chip ${d[key] === value ? 'selected' : ''}`,{key,value}).replace('<button ', `<button aria-pressed="${d[key] === value}" `)).join('')}</div>`;
  const field = (label, key, hint = '', numeric = true) => `<label class="field"><span>${label}</span>${hint ? `<small class="supporting">${hint}</small>` : ''}<input data-progress-weight="${key}" value="${esc(d[key])}" ${numeric ? 'inputmode="decimal"' : ''} aria-label="${label}"></label>`;
  return shell('Available weights', `<div class="progression-details"><h3>${esc(exercise.name)}</h3><p class="supporting">Used for suggestions. Your current sets stay unchanged.</p><div class="available-choice-group">${choices([['kg','kg'],['lbs','lbs']],'unit')}<p class="supporting">Use the unit on your equipment.</p></div><div class="available-choice-group">${choices([['regular','Regular increments'],['custom','Custom list']],'mode')}<p class="supporting">${d.mode === 'regular' ? 'Enter the lowest selectable load and the gap between loads.' : 'Enter each load you can select on this equipment.'}</p></div><div class="available-weight-fields">${d.mode === 'regular' ? field(`Lowest weight (${d.unit})`,'minimum',exercise.id === 'bench' ? 'For bench press, include the bar.' : 'Lightest load you can select on this equipment.') + field(`Increment (${d.unit})`,'increment') : field(`Weights (${d.unit})`,'values','Separate weights with commas.',false)}</div>${d.error ? `<p class="form-error" role="alert">${esc(d.error)}</p>` : ''}</div>`, button('Save settings','save-weights','primary') + button('Clear settings','clear-weights'));
}

export function saveProgressWeights(exercise, p) {
  const d = p.weightsDraft, number = value => /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim());
  if (d.mode === 'regular') {
    if (!number(d.minimum) || +d.minimum < 0 || +d.minimum > 10000 || !number(d.increment) || +d.increment <= 0 || +d.increment > 1000) { d.error = 'Enter a lowest weight of 0 or more and a positive increment.'; return false; }
    exercise.availableWeights = { mode: d.mode, unit: d.unit, minimum: +d.minimum, increment: +d.increment };
  } else {
    const values = d.values.split(/[,;\n]+/).map(value => value.trim());
    if (!values.length || values.length > 200 || values.some(value => !number(value) || +value > 10000)) { d.error = 'Enter up to 200 weights separated by commas.'; return false; }
    exercise.availableWeights = { mode: d.mode, unit: d.unit, values: [...new Set(values.map(Number))].sort((a,b) => a-b) };
  }
  return true;
}
export function changeProgressWeightChoice(p, key, value) {
  const d = p.weightsDraft;
  if (key === 'unit' && value !== d.unit) {
    const factor = value === 'lbs' ? 2.2046226218 : 0.45359237;
    const convert = value => String(Number((Number(value) * factor).toFixed(8)));
    if (d.minimum.trim() && Number.isFinite(+d.minimum)) d.minimum = convert(d.minimum);
    if (d.increment.trim() && Number.isFinite(+d.increment)) d.increment = convert(d.increment);
    if (d.values.trim() && d.values.split(/[,;\n]+/).every(v => v.trim() && Number.isFinite(+v))) d.values = d.values.split(/[,;\n]+/).map(convert).join(', ');
  }
  d[key] = value; d.error = '';
}
