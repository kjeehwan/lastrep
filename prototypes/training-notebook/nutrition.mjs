import { setReviewState } from './review-state-picker.mjs';
import { NUTRITION_DAY, MOCK_LOG_TIME, foods, nutritionStates, nutritionFixture, dayMeals, currentMeal, nutritionFor, entryNutrition, sumNutrition, totals, gramsFrom, quantityFor, macroPercentages, confirmQuantity, addEntries, addStaged, addMealSection, moveMeal, previousMeal, shiftDate } from './nutrition-model.mjs';
import { notebookIcon as icon } from './notebook-icons.mjs';
import { calendarCells } from './home-model.mjs';

const $ = q => document.querySelector(q);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n = (value, digits = 0) => Number(value.toFixed(digits)).toLocaleString('en-US');
const dateText = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const btn = (text, action, kind = 'text', attrs = '', disabled = false) => `<button type="button" class="btn ${kind}" data-action="${action}" ${attrs} ${disabled ? 'disabled' : ''}>${text}</button>`;
const p = (text, cls = 'supporting') => `<p class="${cls}">${text}</p>`;
const check = selected => `<span class="checkmark ${selected ? 'checked' : ''}">${selected ? icon('check') : ''}</span>`;
const field = (label, key, value = '', placeholder = '', type = 'text') => `<label class="field"><span>${label}</span><input type="${type}" data-draft="${key}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`;
let s, example = 'daily', size = [390, 844], dark = false, large = false, toastTimer, swipeStart, suppressUntil = 0;

function choose(id) {
  setReviewState(document.querySelector('#example'), nutritionStates.map(([id, title]) => [id, title]), id);
  clearTimeout(toastTimer);
  s = nutritionFixture(id); example = id; dark = id === 'dark'; large = id === 'large';
  $('#example').value = id; $('#dark').checked = dark; $('#large').checked = large;
  $('#meal-labels').value = id === 'numbered' ? 'numbered' : 'named'; render(false);
}
const mealName = () => s.labels[s.meal];
const foodById = id => foods.find(f => f.id === id);
const rowName = row => row.manual ? row.name : foodById(row.foodId).name;
const quantitySummary = (food, grams) => `${n(grams, 2)} g · ${n(food.calories * grams / 100)} kcal · ${n(grams / food.serving, 2)} ${Math.abs(grams / food.serving - 1) < .001 ? 'serving' : 'servings'}`;
function heading(title, action = '') { return `<div class="nutrition-heading"><h3>${title}</h3>${action}</div>`; }
function amountBar(label, consumed, target, unit, cls = '') {
  const ratio = Math.min(1, Math.max(0, consumed / target));
  return `<section class="amount-summary" aria-label="${label}: ${n(consumed)} ${unit} consumed, target ${n(target)} ${unit}"><div class="amount-heading"><h3>${label}<small>${unit}</small></h3><span class="amount-remaining">${n(Math.abs(target - consumed))} ${unit} ${consumed > target ? 'above target' : 'remaining'}</span></div><div class="amount-track" role="meter" aria-label="${label} target progress" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(consumed, target)}" aria-valuetext="${n(consumed)} of ${n(target)} ${unit}"><div class="amount-fill ${cls}" style="width:${ratio * 100}%"></div></div><div class="amount-labels" data-ratio="${ratio}"><span class="amount-consumed" aria-label="Consumed ${n(consumed)} ${unit}">${n(consumed)}</span><span class="amount-target" aria-label="Target ${n(target)} ${unit}">${n(target)}</span></div></section>`;
}
function compositionBar(label, values) {
  const percentages = macroPercentages(values), keys = ['protein', 'carbs', 'fat'];
  const fallback = large || percentages.some((percent, i) => percent > 0 && percent < Math.max(15, `${['P', 'C', 'F'][i]} ${n(values[keys[i]])}g`.length * 2.5));
  const hasData = percentages.some(Boolean);
  return `<div class="composition-caption">${label}</div>${hasData ? `<div class="macro-bar" role="img" aria-label="${label}: protein ${percentages[0]} percent, carbs ${percentages[1]} percent, fat ${percentages[2]} percent">${keys.map((key, i) => `<div class="macro-segment macro-${key}" style="width:${percentages[i]}%">${!large && percentages[i] >= 15 ? percentages[i] + '%' : ''}</div>`).join('')}</div><div data-percentages="${percentages.join(',')}" class="macro-labels ${fallback ? 'fallback' : ''}" style="grid-template-columns:${percentages.map(value => `${Math.max(.001, value)}fr`).join(' ')}">${keys.map((key, i) => `<span class="macro-label ${key}">${['P', 'C', 'F'][i]} ${n(values[key])}g${large || percentages[i] < 15 ? ` · ${percentages[i]}%` : ''}</span>`).join('')}</div>` : `<div class="macro-bar" aria-hidden="true"></div>${p('No macros logged for this date.', 'macro-empty')}`}`;
}
function diary() {
  if (s.loading) return `<div role="status" aria-label="Loading nutrition diary"><div class="skeleton-line"></div><div class="skeleton-block"></div><div class="skeleton-block"></div><div class="skeleton-block"></div></div>`;
  const values = totals(s), meals = dayMeals(s);
  return `<div class="diary-date"><button class="icon-button" data-action="day-step" data-step="-1" aria-label="Previous date">${icon('left')}</button><button class="date-button" data-action="open" data-modal="date">${s.date === NUTRITION_DAY ? 'Today · ' : ''}${dateText(s.date)}${icon('down')}</button><button class="icon-button" data-action="day-step" data-step="1" aria-label="Next date">${icon('right')}</button></div>${s.refreshError ? `<div class="nutrition-notice" role="status">${p("Couldn't refresh. Showing your saved diary.")}${btn('Retry', 'retry-diary')}</div>` : ''}${amountBar('Calories', values.calories, s.targets.calories, 'kcal')}${amountBar('Protein', values.protein, s.targets.protein, 'g', 'protein')}<section class="diary-section">${heading('Macro composition', btn(s.composition ? 'Hide' : 'Show', 'toggle-composition'))}${s.composition ? compositionBar('Consumed', values) + compositionBar('Recommended', s.targets) + btn('View nutrition targets', 'open', 'text', 'data-modal="targets"') : ''}</section><section class="diary-section">${heading('Log meals', `<div class="meal-ledger-actions">${btn(s.reordering ? 'Done' : 'Reorder', 'toggle-reorder')}${!s.reordering ? btn('Add meal', 'open', 'text', 'data-modal="add-meal"') : ''}</div>`)}${meals.map((meal, index) => {
    const t = sumNutrition(meal.entries);
    return `<div class="meal-ledger-row"><button class="meal-time" data-action="meal-time" data-index="${index}" aria-label="${esc(s.labels[index])}, ${meal.time ? 'edit time ' + meal.time : 'no logging time'}">${meal.time ?? '—'}</button><button class="meal-open" data-action="meal" data-index="${index}"><strong>${esc(s.labels[index])}</strong><small>${meal.entries.length ? `${meal.entries.length} ${meal.entries.length === 1 ? 'food' : 'foods'} · P ${n(t.protein)}g` : 'Nothing logged'}</small></button>${meal.entries.length ? `<span class="meal-energy">${n(t.calories)}<small>kcal</small></span>` : `<span class="meal-energy" aria-hidden="true"></span>`}${s.reordering ? `<div class="meal-reorder-controls" aria-label="Reorder ${esc(s.labels[index])}">${btn(icon('move-up'), 'move-meal', '', `data-index="${index}" data-step="-1" aria-label="Move ${esc(s.labels[index])} up"`, index === 0)}${btn(icon('move-down'), 'move-meal', '', `data-index="${index}" data-step="1" aria-label="Move ${esc(s.labels[index])} down"`, index === meals.length - 1)}</div>` : ''}</div>`;
  }).join('')}</section><section class="diary-section">${heading('History')}<table class="nutrition-history"><thead><tr><th>Date</th><th>Calories</th><th>Protein</th></tr></thead><tbody>${[s.date, shiftDate(s.date, -1), shiftDate(s.date, -2)].map(date => { const t = sumNutrition((s.days[date] ?? []).flatMap(m => m.entries)); return `<tr><td><button class="history-open" data-action="history-date" data-date="${date}">${dateText(date).replace(', 2026', '')}</button></td><td>${s.days[date] ? n(t.calories) + ' kcal' : '—'}</td><td>${s.days[date] ? n(t.protein) + ' g' : '—'}</td></tr>`; }).join('')}</tbody></table></section>`;
}
function mealPage() {
  const meal = currentMeal(s), values = sumNutrition(meal.entries);
  return `<div class="meal-actions">${btn(icon('clock') + (meal.time ?? 'Set time'), 'open', 'text', 'data-modal="time"')}${btn('Rename meal', 'open', 'text', 'data-modal="rename"')}</div><div class="meal-summary"><strong>${n(values.calories)} <span class="supporting">kcal</span></strong>${p(`P ${n(values.protein)}g · C ${n(values.carbs)}g · F ${n(values.fat)}g`)}</div>${meal.entries.length ? `<div class="meal-foods">${meal.entries.map(row => {
    const revealed = s.swiped === row.id, values = entryNutrition(row);
    return `<div class="food-swipe">${revealed ? `<button class="swipe-delete" data-action="delete-food" data-id="${row.id}">Delete</button>` : ''}<div class="food-row ${revealed ? 'revealed' : ''}" data-swipe="${row.id}"><button class="food-copy" data-action="edit-food" data-id="${row.id}"><strong>${esc(rowName(row))}</strong><small>${row.manual ? `Manual entry · ${n(values.calories)} kcal` : quantitySummary(foodById(row.foodId), row.grams)}</small><small>P ${n(values.protein)}g · C ${n(values.carbs)}g · F ${n(values.fat)}g</small></button><button class="icon-button" data-action="food-options" data-id="${row.id}" aria-label="Options for ${esc(rowName(row))}">${icon('more')}</button></div></div>`;
  }).join('')}</div>` : `<div class="empty-food"><h3>No foods logged</h3>${p('Search a food, reuse a saved meal or copy one you logged before.')}</div>`}${s.undo ? `<div class="inline-undo" role="status"><span>Food deleted</span>${btn('Undo', 'undo-food')}</div>` : ''}<div class="meal-footer">${btn('Add food', 'search', 'primary')}${btn('Copy previous meal', 'open', '', 'data-modal="copy"')}${btn('Save this meal', 'open', 'text', 'data-modal="save-meal"', !meal.entries.length)}</div>`;
}
function searchPage() {
  const matches = foods.filter(food => food.name.toLowerCase().includes(s.query.toLowerCase()));
  let body = '';
  if (s.tab === 'saved') body = s.recipes.length ? s.recipes.map(recipe => `<div class="recipe-row"><button class="food-copy" data-action="add-recipe" data-id="${recipe.id}"><strong>${esc(recipe.name)}</strong><small>${recipe.entries.length} foods · ${n(sumNutrition(recipe.entries).calories)} kcal</small><small>Add to ${esc(mealName())}</small></button><button class="icon-button" data-action="recipe-options" data-id="${recipe.id}" aria-label="Options for saved meal ${esc(recipe.name)}">${icon('more')}</button></div>`).join('') : p('No saved meals yet. Save a logged meal to reuse it here.');
  else {
    const list = s.tab === 'favorites' ? foods.filter(food => s.favorites.includes(food.id)) : s.tab === 'recent' ? foods.filter(food => ['oats', 'milk', 'rice', 'chicken'].includes(food.id)) : matches;
    if (s.tab === 'search' && s.query.length < 2) body = p('Type at least 2 characters, or scan a packaged-food barcode.');
    else if (s.tab === 'search' && s.searchStatus === 'loading') body = `<div class="busy-row"><span class="spinner" aria-hidden="true"></span>${p('Searching foods…', 'supporting')}</div>`;
    else if (s.tab === 'search' && s.searchStatus === 'error') body = `<div class="empty-food"><h3>Search unavailable</h3>${p('Try again. Your selected foods and amounts are unchanged.')}${btn('Try again', 'retry-search')}</div>`;
    else if (!list.length || (s.tab === 'search' && s.searchStatus === 'empty')) body = `<div class="empty-food"><h3>No matching foods</h3>${p(s.tab === 'favorites' ? 'Favorite a food to keep it here.' : 'Try a simpler name, a barcode, or enter the nutrition manually.')}${btn('Enter food manually', 'open', '', 'data-modal="manual-food"')}</div>`;
    else body = ['Reference food', 'Packaged example'].map(group => {
      const rows = list.filter(food => food.source.startsWith(group));
      return !rows.length ? '' : `<h3 class="food-group-title">${group === 'Reference food' ? 'Reference foods' : 'Packaged foods'}</h3>${rows.map(food => `<div class="food-result"><button class="done" data-action="toggle-food" data-id="${food.id}" aria-label="Select ${esc(food.name)}" aria-pressed="${s.staged[food.id] != null}">${check(s.staged[food.id] != null)}</button><button class="food-copy" data-action="view-food" data-id="${food.id}"><strong>${esc(food.name)}</strong><small>${esc(food.source)}</small><small class="food-amount-summary">${quantitySummary(food, s.staged[food.id] ?? food.serving)}</small></button><button class="favorite ${s.favorites.includes(food.id) ? 'selected' : ''}" data-action="favorite" data-id="${food.id}" aria-label="Favorite ${esc(food.name)}" aria-pressed="${s.favorites.includes(food.id)}">${s.favorites.includes(food.id) ? '★' : '☆'}</button></div>`).join('')}`;
    }).join('');
  }
  return `<div class="search-wrap"><input data-query value="${esc(s.query)}" placeholder="Search foods" aria-label="Search foods">${s.query ? '<button class="search-clear" data-action="clear-query" aria-label="Clear food search">×</button>' : ''}</div><div class="search-tools">${btn(icon('barcode') + 'Scan barcode', 'open', 'text', 'data-modal="barcode"')}${btn('Manual food', 'open', 'text', 'data-modal="manual-food"')}</div><div class="food-tabs" aria-label="Food sources">${[['search', 'Search'], ['recent', 'Recently added'], ['favorites', 'Favorites'], ['saved', 'Saved meals']].map(([id, label]) => `<button class="food-tab ${s.tab === id ? 'active' : ''}" data-action="search-tab" data-id="${id}" aria-pressed="${s.tab === id}">${label}</button>`).join('')}</div>${Object.keys(s.staged).length ? `<div class="selected-food-chips" aria-label="Selected foods">${Object.entries(s.staged).map(([id, grams]) => `<button class="selected-food-chip" data-action="toggle-food" data-id="${id}" aria-label="Unselect ${esc(foodById(id).name)}"><span>${esc(foodById(id).name)} · ${n(grams, 2)}g</span>×</button>`).join('')}</div>` : ''}${body}`;
}
function dialog(title, body, footer = '', cls = '') {
  return `<div class="overlay ${cls}" data-action="outside"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="nutrition-dialog-title"><header class="sheet-head"><h2 id="nutrition-dialog-title">${esc(title)}</h2><button class="icon-button close" data-action="close" aria-label="Close dialog">×</button></header><div class="sheet-body">${body}</div>${footer ? `<footer class="sheet-footer">${footer}</footer>` : ''}</section></div>`;
}
function facts(values, title) {
  return `<div class="nutrition-facts"><h3>${title}</h3>${[['Calories', values.calories, 'kcal'], ['Protein', values.protein, 'g'], ['Carbs', values.carbs, 'g'], ['Fat', values.fat, 'g']].map(([label, value, unit]) => `<div class="facts-line"><span>${label}</span><strong>${n(value, label === 'Calories' ? 0 : 1)} ${unit}</strong></div>`).join('')}</div>`;
}
function editorPreview() {
  const e = s.editor, food = foodById(e.foodId), grams = gramsFrom(e.raw, e.mode, food) == null ? null : e.grams;
  return grams == null ? p('Enter an amount greater than 0 to preview its nutrition.', 'editor-helper') : `${p(quantitySummary(food, grams), 'editor-helper')}${facts(nutritionFor(food, grams), 'Nutrition for selected amount')}${p(`Reference serving: ${food.servingLabel}`, 'editor-helper')}`;
}
function quantityEditor() {
  const e = s.editor, food = foodById(e.foodId);
  return dialog(food.name, `${p(food.source, 'editor-helper')}<div class="quantity-modes" aria-label="Quantity unit">${['grams', 'calories', 'servings'].map(mode => `<button class="quantity-mode ${e.mode === mode ? 'selected' : ''}" data-action="quantity-mode" data-mode="${mode}" aria-pressed="${e.mode === mode}" ${mode === 'calories' && food.calories <= 0 ? 'disabled' : ''}>${mode[0].toUpperCase() + mode.slice(1)}</button>`).join('')}</div>${food.calories <= 0 ? p('Use grams or servings. Zero calories cannot determine a quantity.', 'editor-helper') : ''}<label><span class="quantity-label">Amount</span><div class="quantity-field"><input data-quantity inputmode="decimal" value="${esc(e.raw)}" aria-label="Amount in ${e.mode}" aria-describedby="quantity-error"><span class="quantity-unit">${e.mode === 'grams' ? 'g' : e.mode === 'calories' ? 'kcal' : 'servings'}</span></div></label><p id="quantity-error" class="form-error" role="alert">${esc(s.error)}</p><div data-editor-preview class="section-stack">${editorPreview()}</div>${btn('View per 100 g', 'per100')}${s.per100 ? facts(food, 'Nutrition per 100 g') : ''}`, btn(e.entryId ? 'Save changes' : 'Confirm amount', 'confirm-quantity', 'primary') + btn('Cancel', 'close'), 'nutrition-editor');
}
function barcodeDialog() {
  if (s.modal === 'barcode') return dialog('Scan packaged food', `${p('Center an EAN or UPC barcode in the frame.')}<div class="scanner-illustration"><svg viewBox="0 0 180 80" role="img" aria-label="Illustrative barcode"><path stroke="currentColor" stroke-width="3" d="M12 8v56M18 8v56M29 8v56M35 8v56M46 8v56M57 8v56M63 8v56M75 8v56M85 8v56M91 8v56M105 8v56M114 8v56M125 8v56M132 8v56M143 8v56M153 8v56M165 8v56"/></svg><span class="scanner-caption">Static illustration · No camera access</span></div>`, btn('Simulate recognized product', 'barcode-demo', 'primary') + btn('Enter barcode manually', 'open', '', 'data-modal="barcode-manual"'));
  if (s.modal === 'barcode-busy') return dialog('Looking up product', `<div class="busy-row"><span class="spinner"></span>${p('Checking the simulated product database…')}</div>${p('No external lookup is being performed.', 'editor-helper')}`, btn('Cancel', 'close'));
  if (s.modal === 'barcode-request') return dialog('Allow camera access', p('Use your camera to scan a food barcode. You can also enter the barcode manually.'), btn('Allow camera', 'open', 'primary', 'data-modal="permission-preview"') + btn('Enter barcode manually', 'open', '', 'data-modal="barcode-manual"'));
  if (s.modal === 'permission-preview') return dialog('Android permission / prototype', p('The real app requests camera permission through Android. This browser study does not access your camera.'), btn('Simulate Allow', 'open', 'primary', 'data-modal="barcode"') + btn('Simulate Don’t allow', 'open', '', 'data-modal="barcode-denied"'));
  if (s.modal === 'barcode-settings') return dialog('Camera settings / prototype', p('The real app opens its device settings. Enable Camera there, then return to scan. This browser study cannot change device permissions.'), btn('Simulate returning with camera enabled', 'open', 'primary', 'data-modal="barcode"') + btn('Keep camera off', 'open', '', 'data-modal="barcode-denied"'));
  if (s.modal === 'barcode-denied') return dialog('Camera access is off', p('Enable Camera in device settings to scan. You can still enter a barcode manually.'), btn('Open camera settings', 'open', 'primary', 'data-modal="barcode-settings"') + btn('Enter barcode manually', 'open', '', 'data-modal="barcode-manual"') + btn('Back', 'close'));
  if (s.modal === 'barcode-missing') return dialog('Product not found', p('This barcode is not in the product database. Try another barcode or enter the nutrition from its label.'), btn('Try another barcode', 'open', 'primary', 'data-modal="barcode-manual"') + btn('Enter food manually', 'open', '', 'data-modal="manual-food"'));
  if (s.modal === 'barcode-error') return dialog('Could not look up barcode', p('The product database could not be reached. Check your connection and try again.'), btn('Try again', 'lookup-barcode', 'primary') + btn('Enter food manually', 'open', '', 'data-modal="manual-food"'));
  return dialog('Enter barcode', `<label class="field"><span>EAN or UPC barcode</span><input data-draft="barcode" inputmode="numeric" maxlength="14" value="${esc(s.draft.barcode ?? '')}" placeholder="e.g. 5901234123457"></label>${p('Design example: 5901234123457 finds the sample milk. Other valid-length codes show a missing-product result.', 'editor-helper')}${s.error ? p(esc(s.error), 'form-error') : ''}`, btn('Look up product', 'lookup-barcode', 'primary') + btn('Cancel', 'close'));
}
function manualEditor() {
  return dialog('Manual food entry', `${field('Food name', 'manualName', s.draft.manualName ?? '', 'e.g. Homemade rice bowl')}${p('Enter nutrition for the whole amount you are adding. No weight is inferred.', 'editor-helper')}${[['manualCalories', 'Calories (kcal)'], ['manualProtein', 'Protein (g)'], ['manualCarbs', 'Carbs (g)'], ['manualFat', 'Fat (g)']].map(([key, label]) => `<label class="field"><span>${label}</span><input data-draft="${key}" value="${esc(s.draft[key] ?? '')}" inputmode="decimal" placeholder="e.g. ${key === 'manualCalories' ? '420' : '20'}"></label>`).join('')}${s.error ? p(esc(s.error), 'form-error') : ''}`, btn(s.manualEntry ? 'Save changes' : 'Add food', 'save-manual', 'primary') + btn('Cancel', 'close'), 'nutrition-editor');
}
function modal() {
  if (s.modal.startsWith('barcode') || s.modal === 'permission-preview') return barcodeDialog();
  const meal = currentMeal(s);
  switch (s.modal) {
    case 'editor': return quantityEditor();
    case 'manual-food': return manualEditor();
    case 'date': return calendarDialog();
    case 'targets': return dialog('Nutrition targets', `${p('Illustrative profile targets, not a recommendation generated by this mockup.')}${facts(s.targets, 'Daily targets')}${p('Macro percentages use calories: protein and carbs 4 kcal/g, fat 9 kcal/g. Protein remains the profile target of 170 g.', 'editor-helper')}`, btn('Done', 'close', 'primary'));
    case 'choose-meal': return dialog('Add food to…', s.labels.map((label, i) => btn(esc(label), 'search-meal', '', `data-index="${i}"`)).join(''));
    case 'add-meal': return dialog('Add meal section', field('Meal name', 'newMeal', s.draft.newMeal ?? '', 'e.g. Pre-workout') + (s.error ? p(esc(s.error), 'form-error') : ''), btn('Add meal', 'add-meal', 'primary') + btn('Cancel', 'close'));
    case 'rename': return dialog('Meal name', `${field('Name', 'name', s.draft.name, 'e.g. Before training')}${p('Changes this meal label across the mock diary, without changing its food.', 'editor-helper')}${s.error ? p(esc(s.error), 'form-error') : ''}`, btn('Save name', 'save-name', 'primary') + btn('Cancel', 'close'));
    case 'time': return timeDialog();
    case 'save-meal': return dialog('Save meal', `${field('Saved meal name', 'recipeName', s.draft.recipeName, 'e.g. Oats & milk')}${p(`${meal.entries.length} foods · ${n(sumNutrition(meal.entries).calories)} kcal`)}${p('Saves a reusable combination. It does not duplicate the logged meal.', 'editor-helper')}${s.error ? p(esc(s.error), 'form-error') : ''}`, btn('Save meal', 'save-recipe', 'primary') + btn('Cancel', 'close'));
    case 'copy': { const source = previousMeal(s); return dialog('Copy previous meal', `${p(`From ${dateText(shiftDate(s.date, -1))} \u00b7 ${esc(mealName())}`)}${source?.entries.length ? `<div class="row-note">${source.entries.map(row => p(esc(rowName(row)) + (row.grams ? ` \u00b7 ${n(row.grams, 2)} g` : ''))).join('')}${p(`${n(sumNutrition(source.entries).calories)} kcal \u00b7 ${source.entries.length} foods`, 'editor-helper')}</div>${p(`Adds foods to ${esc(mealName())} on ${dateText(s.date)} without replacing existing items. Logging time becomes ${MOCK_LOG_TIME}.`)}` : p('No foods were logged in this meal on the previous date.')}`, btn('Copy meal', 'copy-meal', 'primary', '', !source?.entries.length) + btn('Cancel', 'close')); }
    case 'food-options': { const row = meal.entries.find(r => r.id === s.selectedEntry); return dialog(row ? rowName(row) : 'Food options', btn('Move to another meal', 'open', '', 'data-modal="move-food"') + (row && !row.manual ? btn(s.favorites.includes(row.foodId) ? 'Remove from favorites' : 'Add to favorites', 'menu-favorite', '', `data-id="${row.foodId}"`) : '') + btn('Delete food', 'delete-food', 'danger', `data-id="${s.selectedEntry}"`)); }
    case 'move-food': return dialog('Move food to', s.labels.map((label, index) => index === s.meal ? '' : btn(esc(label), 'move-food', '', `data-index="${index}"`)).join(''));
    case 'recipe-options': { const recipe = s.recipes.find(r => r.id === s.selectedRecipe); return dialog('Delete saved meal?', `${p(`Delete ${esc(recipe?.name)} from saved meals?`)}${p('Foods already logged in your diary are not affected.')}`, btn('Delete saved meal', 'delete-recipe', 'danger') + btn('Keep saved meal', 'close', 'primary')); }
    case 'save-error': return dialog('Could not add foods', p('Your selected foods and amounts are unchanged. Try saving again.'), btn('Try again', 'add-staged', 'primary') + btn('Back to selection', 'close'));
    default: return '';
  }
}
function calendarDialog() {
  const month = s.calendarMonth ?? s.date.slice(0, 7);
  const title = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  return dialog('Diary date', `<div class="nutrition-calendar-toolbar"><button class="icon-button" data-action="calendar-month" data-step="-1" aria-label="Previous month">${icon('left')}</button><h3>${title}</h3><button class="icon-button" data-action="calendar-month" data-step="1" aria-label="Next month">${icon('right')}</button></div><div class="nutrition-calendar-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(day => `<span class="nutrition-weekday">${day}</span>`).join('')}${calendarCells(month).map(date => !date ? '<span></span>' : `<button class="nutrition-calendar-day ${date === s.date ? 'selected' : ''} ${date === NUTRITION_DAY ? 'today' : ''} ${(s.days[date] ?? []).some(meal => meal.entries.length) ? 'recorded' : ''}" data-action="calendar-date" data-date="${date}" aria-label="${dateText(date)}" aria-pressed="${date === s.date}">${Number(date.slice(-2))}</button>`).join('')}</div>`, btn('Today', 'calendar-date', '', `data-date="${NUTRITION_DAY}"`));
}
function timeDialog() {
  const time = s.draft.time ?? MOCK_LOG_TIME;
  return dialog('Meal logging time', `${p(`${esc(mealName())} · ${dateText(s.date)}`)}<div class="nutrition-time-display" aria-live="polite">${time}</div><div class="time-picker-grid">${[['Hours', 24], ['Minutes', 60]].map(([title, count], column) => `<div><h3 class="time-picker-heading">${title}</h3><div class="time-options" role="listbox" aria-label="${title}" data-time-list="${column}">${Array.from({ length: count }, (_, value) => { const text = String(value).padStart(2, '0'), selected = time.split(':')[column] === text; return `<button class="time-option ${selected ? 'selected' : ''}" role="option" aria-selected="${selected}" tabindex="${selected ? 0 : -1}" data-action="time-option" data-column="${column}" data-value="${text}">${text}</button>`; }).join('')}</div></div>`).join('')}</div>${p('Approximate time you recorded or ate this meal.', 'editor-helper')}`, btn('Save time', 'save-time', 'primary') + btn('Cancel', 'close'));
}
function tabs() {
  return `<nav class="bottom-tabs" aria-label="App destinations">${[['Home', './home.html'], ['Workout', './'], ['Nutrition', ''], ['Sleep', ''], ['Profile', '']].map(([label, href]) => href ? `<a class="tab tab-link" href="${href}">${icon(label.toLowerCase())}${label}</a>` : `<button class="tab ${label === 'Nutrition' ? 'active' : ''}" data-action="tab" data-tab="${label}" ${label === 'Nutrition' ? 'aria-current="page"' : ''}>${icon(label.toLowerCase())}${label}</button>`).join('')}</nav>`;
}
function alignAmountLabels() {
  document.querySelectorAll('.amount-labels').forEach(el => {
    const consumed = el.querySelector('.amount-consumed'), target = el.querySelector('.amount-target');
    const width = el.clientWidth, cw = consumed.getBoundingClientRect().width, tw = target.getBoundingClientRect().width;
    consumed.style.left = `${Math.max(0, Math.min(width * Number(el.dataset.ratio) - cw, width - tw - cw - 16))}px`;
  });
  document.querySelectorAll('.macro-labels').forEach(el => {
    if (large) { el.style.minHeight = ''; return; }
    const labels = [...el.children], width = el.clientWidth, percents = el.dataset.percentages.split(',').map(Number);
    const widths = labels.map(label => label.getBoundingClientRect().width);
    if (widths.reduce((a, b) => a + b, 0) + 16 > width) {
      el.style.minHeight = `${labels.reduce((height, label, index) => { label.style.left = '0px'; label.style.top = `${height}px`; return height + label.offsetHeight + 6; }, 0)}px`; return;
    }
    let cumulative = 0;
    const lefts = percents.map((percent, i) => { const center = (cumulative + percent / 2) * width / 100; cumulative += percent; return Math.max(0, Math.min(width - widths[i], center - widths[i] / 2)); });
    for (let i = 1; i < lefts.length; i++) lefts[i] = Math.max(lefts[i], lefts[i - 1] + widths[i - 1] + 8);
    lefts[2] = Math.min(lefts[2], width - widths[2]);
    for (let i = 1; i >= 0; i--) lefts[i] = Math.min(lefts[i], lefts[i + 1] - widths[i] - 8);
    labels.forEach((label, i) => { label.style.left = `${lefts[i]}px`; label.style.top = '0px'; });
    el.style.minHeight = `${Math.max(...labels.map(label => label.offsetHeight))}px`;
  });
}
function render(preserve = true) {
  const active = document.activeElement, focus = preserve && active?.closest('.nutrition-device') ? { quantity: active.hasAttribute('data-quantity'), query: active.hasAttribute('data-query'), draft: active.dataset.draft, start: active.selectionStart, end: active.selectionEnd } : null;
  const y = $('.nutrition-device .viewport')?.scrollTop ?? 0, dy = $('.nutrition-device .sheet-body')?.scrollTop ?? 0;
  const title = s.page === 'daily' ? 'Nutrition' : s.page === 'search' ? `Add to ${mealName()}` : mealName();
  $('#state-title').textContent = nutritionStates.find(row => row[0] === example)?.[1] ?? 'Nutrition';
  $('#state-description').textContent = nutritionStates.find(row => row[0] === example)?.[2] ?? '';
  $('#stage').innerHTML = `<div class="frame-wrap"><h3>Nutrition / ${s.page === 'daily' ? 'Daily diary' : esc(mealName())}</h3><section class="device nutrition-device ${dark ? 'dark' : ''} ${large ? 'large-text' : ''}" style="--width:${size[0]}px;--height:${size[1]}px" aria-label="Interactive Nutrition prototype"><div class="system-bar" aria-hidden="true"><span>9:41</span><span>LTE&nbsp;&nbsp;92%</span></div><header class="toolbar"><div>${s.page !== 'daily' ? `<button class="icon-button" data-action="back" aria-label="Back">${icon('left')}</button>` : ''}<div class="${s.page === 'daily' ? 'root-title' : ''}"><h2 class="${s.page === 'daily' ? 'root-title' : ''}">${esc(title)}</h2>${s.page !== 'daily' ? `<span class="title-date">${dateText(s.date)}</span>` : ''}</div><span aria-hidden="true"></span></div></header><div class="viewport" tabindex="0" aria-label="Scrollable nutrition diary"><div class="page-content">${s.page === 'daily' ? diary() : s.page === 'meal' ? mealPage() : searchPage()}</div></div>${s.page === 'search' ? `<footer class="food-search-footer"><span class="supporting">${Object.keys(s.staged).length} selected</span>${btn(`Add (${Object.keys(s.staged).length})`, 'add-staged', 'primary', '', !Object.keys(s.staged).length)}</footer>` : ''}${tabs()}${s.modal ? modal() : ''}${s.toast ? `<div class="toast" role="status"><span>${esc(s.toast)}</span><button data-action="dismiss-toast" aria-label="Dismiss notification">×</button></div>` : ''}</section><p class="frame-caption">${size.join(' × ')} / ${dark ? 'Dark' : 'Paper'} / ${large ? '200%' : '100%'} text. Illustrative data only.</p></div>`;
  $('.nutrition-device .viewport').scrollTop = preserve ? y : 0;
  if ($('.nutrition-device .sheet-body')) $('.nutrition-device .sheet-body').scrollTop = preserve ? dy : 0;
  alignAmountLabels();
  document.querySelectorAll('.time-options').forEach(list => { const selected = list.querySelector('[aria-selected="true"]'); if (selected) list.scrollTop = selected.offsetTop - list.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2; });
  if (focus) {
    const input = focus.quantity ? $('[data-quantity]') : focus.query ? $('[data-query]') : focus.draft ? $(`[data-draft="${focus.draft}"]`) : null;
    input?.focus({ preventScroll: true });
    if (input && input.type !== 'date' && input.type !== 'time' && focus.start != null) input.setSelectionRange(focus.start, focus.end);
  } else if (s.modal) $('.nutrition-device .sheet-head .close')?.focus({ preventScroll: true });
}
function notify(message) { s.toast = message; clearTimeout(toastTimer); render(); toastTimer = setTimeout(() => { s.toast = ''; render(); }, 4000); }
function open(name) {
  s.error = ''; s.modal = name;
  if (name === 'date') s.calendarMonth = s.date.slice(0, 7);
  if (name === 'rename') s.draft.name = mealName();
  if (name === 'time') s.draft.time = currentMeal(s).time ?? MOCK_LOG_TIME;
  if (name === 'manual-food') { s.manualEntry = null; for (const key of ['manualName', 'manualCalories', 'manualProtein', 'manualCarbs', 'manualFat']) delete s.draft[key]; }
  render(false);
}
function close() { s.modal = ''; s.error = ''; render(false); }
function viewFood(foodId, entryId = null) {
  const row = entryId ? currentMeal(s).entries.find(r => r.id === entryId) : null;
  if (row?.manual) { s.manualEntry = row.id; s.draft = { ...s.draft, manualName: row.name, manualCalories: String(row.calories), manualProtein: String(row.protein), manualCarbs: String(row.carbs), manualFat: String(row.fat) }; s.modal = 'manual-food'; s.error = ''; render(false); return; }
  const grams = row?.grams ?? s.staged[foodId] ?? foodById(foodId).serving;
  s.editor = { foodId, entryId, mode: 'grams', raw: String(Number(grams.toFixed(4))), grams }; s.per100 = false; open('editor');
}
function barcodeLookup() {
  const raw = s.draft.barcode?.trim() ?? '';
  if (!/^\d{12,14}$/.test(raw)) { s.error = 'Enter a 12–14 digit barcode.'; s.modal = 'barcode-manual'; render(); return; }
  const current = s, token = s.lookupToken = (s.lookupToken ?? 0) + 1; s.error = ''; s.modal = 'barcode-busy'; render(false);
  setTimeout(() => { if (s !== current || s.lookupToken !== token || s.modal !== 'barcode-busy') return; if (raw === '5901234123457') viewFood('milk'); else { s.modal = 'barcode-missing'; render(false); } }, 550);
}
$('#stage').addEventListener('input', event => {
  const el = event.target;
  if (el.hasAttribute('data-query')) { s.query = el.value; s.searchStatus = 'ready'; render(); }
  else if (el.hasAttribute('data-quantity')) { s.editor.raw = el.value; s.editor.grams = gramsFrom(el.value, s.editor.mode, foodById(s.editor.foodId)); s.error = ''; const error = $('#quantity-error'); if (error) error.textContent = ''; $('[data-editor-preview]').innerHTML = editorPreview(); }
  else if (el.dataset.draft) s.draft[el.dataset.draft] = el.value;
});
$('#stage').addEventListener('click', event => {
  if (performance.now() < suppressUntil) return;
  const el = event.target.closest('[data-action]'); if (!el || el.disabled) return;
  const d = el.dataset;
  switch (d.action) {
    case 'outside': if (event.target === el) close(); return;
    case 'close': close(); return;
    case 'open': open(d.modal); return;
    case 'toggle-composition': s.composition = !s.composition; render(); return;
    case 'retry-diary': s.refreshError = false; notify('Mock refresh complete. Saved diary unchanged.'); return;
    case 'dismiss-toast': s.toast = ''; render(); return;
    case 'day-step': s.date = shiftDate(s.date, Number(d.step)); s.undo = null; render(false); return;
    case 'history-date': s.date = d.date; render(false); return;
    case 'set-date': if (!/^\d{4}-\d{2}-\d{2}$/.test(s.draft.date ?? s.date)) { s.error = 'Choose a date.'; render(); return; } s.date = s.draft.date ?? s.date; close(); return;
    case 'back': s.page = s.page === 'search' ? 'meal' : 'daily'; s.modal = ''; s.swiped = null; render(false); return;
    case 'meal': s.meal = Number(d.index); s.page = currentMeal(s).entries.length ? 'meal' : 'search'; s.modal = ''; render(false); return;
    case 'meal-time': s.meal = Number(d.index); open('time'); return;
    case 'search': s.page = 'search'; s.query = ''; s.tab = 'search'; render(false); return;
    case 'choose-meal': open('choose-meal'); return;
    case 'search-meal': s.meal = Number(d.index); s.page = 'search'; s.query = ''; close(); return;
    case 'clear-query': s.query = ''; s.searchStatus = 'ready'; render(); return;
    case 'search-tab': s.tab = d.id; render(); return;
    case 'retry-search': s.searchStatus = 'ready'; render(); return;
    case 'view-food': viewFood(d.id); return;
    case 'edit-food': { const row = currentMeal(s).entries.find(r => r.id === d.id); if (row) viewFood(row.foodId, row.id); return; }
    case 'toggle-food': if (s.staged[d.id] != null) delete s.staged[d.id]; else s.staged[d.id] = foodById(d.id).serving; render(); return;
    case 'favorite': s.favorites = s.favorites.includes(d.id) ? s.favorites.filter(id => id !== d.id) : [...s.favorites, d.id]; render(); return;
    case 'quantity-mode': {
      const food = foodById(s.editor.foodId), grams = gramsFrom(s.editor.raw, s.editor.mode, food) == null ? null : s.editor.grams;
      if (grams == null) { s.error = 'Enter a valid amount before changing units.'; render(); return; }
      s.editor.mode = d.mode; s.editor.raw = String(Number(quantityFor(grams, d.mode, food).toFixed(5))); s.editor.grams = grams; s.error = ''; render(); return;
    }
    case 'per100': s.per100 = !s.per100; render(); return;
    case 'confirm-quantity': try { const logged = !!s.editor.entryId; confirmQuantity(s); s.modal = ''; notify(logged ? 'Amount updated in this mock diary.' : 'Amount selected. Add the selected foods when ready.'); } catch (error) { s.error = error.message; render(); } return;
    case 'add-staged': addStaged(s); s.modal = ''; s.page = 'meal'; notify('Foods added to this mock diary.'); return;
    case 'food-options': s.selectedEntry = d.id; open('food-options'); return;
    case 'menu-favorite': s.favorites = s.favorites.includes(d.id) ? s.favorites.filter(id => id !== d.id) : [...s.favorites, d.id]; s.modal = ''; notify('Favorites updated.'); return;
    case 'move-food': {
      const source = currentMeal(s), index = source.entries.findIndex(row => row.id === s.selectedEntry);
      if (index < 0 || Number(d.index) === s.meal) return;
      const [row] = source.entries.splice(index, 1), previous = s.meal;
      if (!source.entries.length) source.time = null;
      s.meal = Number(d.index); const destination = currentMeal(s); addEntries(s, [row]); destination.time ??= MOCK_LOG_TIME;
      const name = mealName(); s.meal = previous; s.modal = ''; s.undo = null; s.swiped = null; notify(`Food moved to ${name}.`); return;
    }
    case 'calendar-month': { const date = new Date(`${s.calendarMonth ?? s.date.slice(0, 7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + Number(d.step)); s.calendarMonth = date.toISOString().slice(0, 7); render(); return; }
    case 'calendar-date': s.date = d.date; s.undo = null; close(); return;
    case 'time-option': { const parts = (s.draft.time ?? MOCK_LOG_TIME).split(':'); parts[Number(d.column)] = d.value; s.draft.time = parts.join(':'); render(); $(`[data-column="${d.column}"][data-value="${d.value}"]`)?.focus({ preventScroll: true }); return; }
    case 'delete-food': { const meal = currentMeal(s), index = meal.entries.findIndex(row => row.id === d.id); if (index < 0) return; const [row] = meal.entries.splice(index, 1); s.undo = { row, index, meal: s.meal, date: s.date, time: meal.time }; if (!meal.entries.length) meal.time = null; s.modal = ''; s.swiped = null; render(); return; }
    case 'undo-food': if (s.undo && s.undo.date === s.date && s.undo.meal === s.meal) { const meal = currentMeal(s); meal.entries.splice(s.undo.index, 0, s.undo.row); meal.time = s.undo.time; s.undo = null; render(); } return;
    case 'add-meal': try { addMealSection(s, s.draft.newMeal); s.modal = ''; notify('Meal section added to this mock diary.'); } catch (error) { s.error = error.message; render(); } return;
    case 'toggle-reorder': s.reordering = !s.reordering; render(); return;
    case 'move-meal': s.meal = Number(d.index); moveMeal(s, Number(d.step)); render(); return;
    case 'save-name': if (!s.draft.name?.trim()) { s.error = 'Enter a meal name.'; render(); return; } s.labels[s.meal] = s.draft.name.trim(); s.modal = ''; notify('Meal name updated in this mock diary.'); return;
    case 'save-time': if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.draft.time ?? '')) { s.error = 'Choose a valid time.'; render(); return; } currentMeal(s).time = s.draft.time; s.modal = ''; notify('Logging time updated in this mock diary.'); return;
    case 'save-recipe': if (!s.draft.recipeName?.trim()) { s.error = 'Enter a name for the saved meal.'; render(); return; } s.recipes.push({ id: `recipe-${++s.serial}`, name: s.draft.recipeName.trim(), entries: structuredClone(currentMeal(s).entries) }); s.modal = ''; notify('Meal saved for reuse in this mock session.'); return;
    case 'add-recipe': { const recipe = s.recipes.find(r => r.id === d.id); if (recipe) { addEntries(s, recipe.entries); currentMeal(s).time = MOCK_LOG_TIME; s.page = 'meal'; notify('Saved meal added to this mock diary.'); } return; }
    case 'recipe-options': s.selectedRecipe = d.id; open('recipe-options'); return;
    case 'delete-recipe': s.recipes = s.recipes.filter(r => r.id !== s.selectedRecipe); s.modal = ''; notify('Saved template deleted. Logged food is unchanged.'); return;
    case 'copy-meal': if (!previousMeal(s)?.entries.length) return; addEntries(s, previousMeal(s).entries); currentMeal(s).time = MOCK_LOG_TIME; s.modal = ''; s.page = 'meal'; notify('Meal copied. Logging time set to 18:30 in this mock diary.'); return;
    case 'barcode-demo': s.draft.barcode = '5901234123457'; barcodeLookup(); return;
    case 'lookup-barcode': barcodeLookup(); return;
    case 'save-manual': {
      const keys = ['manualCalories', 'manualProtein', 'manualCarbs', 'manualFat'], values = keys.map(key => s.draft[key]?.trim() ?? '');
      if (!s.draft.manualName?.trim() || values.some(v => !v || !Number.isFinite(Number(v)) || Number(v) < 0)) { s.error = 'Enter a name and a non-negative number for every nutrition field.'; render(); return; }
      const row = { manual: true, name: s.draft.manualName.trim(), calories: Number(values[0]), protein: Number(values[1]), carbs: Number(values[2]), fat: Number(values[3]) };
      if (s.manualEntry) Object.assign(currentMeal(s).entries.find(r => r.id === s.manualEntry), row); else addEntries(s, [row]);
      s.modal = ''; s.page = 'meal'; notify('Manual food saved in this mock diary.'); return;
    }
    case 'tab': if (d.tab === 'Nutrition') { s.page = 'daily'; close(); } else notify(`${d.tab} is outside this Nutrition study.`); return;
    default: return;
  }
});
$('#stage').addEventListener('pointerdown', event => { const row = event.target.closest('[data-swipe]'); if (row) swipeStart = { id: row.dataset.swipe, x: event.clientX, y: event.clientY }; });
$('#stage').addEventListener('pointerup', event => {
  if (!swipeStart) return;
  const dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { s.swiped = dx < 0 ? swipeStart.id : null; suppressUntil = performance.now() + 100; render(); }
  swipeStart = null;
});
document.addEventListener('keydown', event => {
  if (event.target.matches('.time-option') && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); const column = Number(event.target.dataset.column), count = column === 0 ? 24 : 60, value = (Number(event.target.dataset.value) + (event.key === 'ArrowUp' ? -1 : 1) + count) % count;
    $(`[data-column="${column}"][data-value="${String(value).padStart(2, '0')}"]`)?.click(); return;
  }
  if (event.key === 'Escape' && s.modal) { close(); return; }
  if (event.key !== 'Tab' || !s.modal) return;
  const items = [...document.querySelectorAll('.nutrition-device .sheet button:not(:disabled),.nutrition-device .sheet input')].filter(el => el.tabIndex >= 0);
  const index = items.indexOf(document.activeElement);
  if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
  else if (!event.shiftKey && index === items.length - 1) { event.preventDefault(); items[0]?.focus(); }
});
$('#example').innerHTML = nutritionStates.map(([id, title]) => `<option value="${id}">${title}</option>`).join('');
$('#example').addEventListener('change', event => choose(event.target.value));
$('#viewport').addEventListener('change', event => { size = event.target.value.split(',').map(Number); render(); });
$('#dark').addEventListener('change', event => { dark = event.target.checked; render(); });
$('#large').addEventListener('change', event => { large = event.target.checked; render(); });
$('#meal-labels').addEventListener('change', event => { s.labels = event.target.value === 'numbered' ? s.labels.map((_, i) => `Meal ${i + 1}`) : s.labels.map((label, i) => ['Breakfast', 'Lunch', 'Dinner', 'Snack 1', 'Snack 2', 'Snack 3'][i] ?? label); render(); });
$('#reset').addEventListener('click', () => choose(example));
document.fonts.ready.then(alignAmountLabels);
const initial = location.hash.slice(1);
choose(nutritionStates.some(row => row[0] === initial) ? initial : 'daily');
