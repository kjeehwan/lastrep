// Illustrative nutrition values, not a verified food database or dietary advice.
export const NUTRITION_DAY = '2026-10-15';
export const MOCK_LOG_TIME = '18:30';
export const foods = [
  { id: 'oats', name: 'Oatmeal, rolled oats, dry', source: 'Reference food · Illustrative', serving: 40, servingLabel: '40 g dry oats', calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9 },
  { id: 'oats-cooked', name: 'Oatmeal, cooked with water', source: 'Reference food · Illustrative', serving: 234, servingLabel: '1 bowl · 234 g', calories: 71, protein: 2.5, carbs: 12, fat: 1.5 },
  { id: 'oats-instant', name: 'Instant oatmeal, plain', source: 'Packaged example · Illustrative', serving: 28, servingLabel: '1 packet · 28 g', calories: 370, protein: 12, carbs: 68, fat: 7 },
  { id: 'oats-branded', name: 'Example brand · Mixed berry oatmeal', source: 'Packaged example · Illustrative', serving: 45, servingLabel: '1 packet · 45 g', calories: 385, protein: 10, carbs: 73, fat: 6 },
  { id: 'rice', name: 'Rice, white, cooked', source: 'Reference food · Illustrative', serving: 150, servingLabel: '1 bowl · 150 g', calories: 130, protein: 2.7, carbs: 28.2, fat: .3 },
  { id: 'chicken', name: 'Chicken breast, cooked', source: 'Reference food · Illustrative', serving: 100, servingLabel: '100 g cooked', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: 'milk', name: 'Milk, semi-skimmed', source: 'Packaged example · Illustrative', serving: 250, servingLabel: '1 glass · 250 g', calories: 46, protein: 3.4, carbs: 5, fat: 1.5 },
  { id: 'banana', name: 'Banana', source: 'Reference food · Illustrative', serving: 120, servingLabel: '1 medium · 120 g', calories: 89, protein: 1.1, carbs: 22.8, fat: .3 },
  { id: 'zero', name: 'Zero-sugar soft drink', source: 'Packaged example · Illustrative', serving: 330, servingLabel: '1 can · 330 g', calories: 0, protein: 0, carbs: 0, fat: 0 },
];
export const nutritionStates = [
  ['daily', 'Daily diary', 'Calories, protein, macro composition and a timed meal ledger.'],
  ['empty', 'Nothing logged', 'Zero consumed values stay inside their bars; no invented meal times.'],
  ['near-target', 'Near targets', 'Consumed and target labels stay readable without overlapping.'],
  ['over-target', 'Above targets', 'Neutral over-target copy; bar caps visually without hiding actual totals.'],
  ['narrow-macros', 'Narrow macro segments', 'Readable companion labels instead of tiny text inside narrow segments.'],
  ['numbered', 'Meals 1–6', 'The same diary with numbered meal labels.'],
  ['custom-labels', 'Custom meal names', 'User-written labels wrap without changing time or calorie alignment.'],
  ['loading', 'Loading diary', 'Neutral placeholders, not a flash of zero totals.'],
  ['refresh-error', 'Refresh failed / saved data', 'Keep the saved diary and provide a clear Retry action.'],
  ['meal', 'Logged meal', 'Date centered below the meal name; quantities, nutrition and swipe actions.'],
  ['meal-empty', 'Empty meal', 'Add food, use a saved meal or copy a previous meal.'],
  ['add-meal', 'Add meal section', 'Keep custom meal sections available beyond the initial six.'],
  ['meal-options', 'Log meals / reorder', 'Reorder directly on the diary; foods and times stay with their meal.'],
  ['food-options', 'Food options / accessible delete', 'An alternative to swiping; no permanent trash button on every row.'],
  ['swipe', 'Swiped food / delete', 'Reveal Delete, then offer Undo after removal.'],
  ['search', 'Food search', 'Reference and packaged examples, with nutrition facts before adding.'],
  ['selected', 'Selected food / edited amount', 'Staged quantities update the food summary outside the editor.'],
  ['search-loading', 'Food search / loading', 'Retain selected items while lookup is pending.'],
  ['search-empty', 'Food search / no matches', 'Try a simpler term, a barcode or manual entry.'],
  ['search-error', 'Food search / failed', 'Retry while keeping selected foods and their amounts.'],
  ['recent', 'Recently added foods', 'Reuse a food, then review its amount before confirming.'],
  ['favorites', 'Favorite foods', 'Favorite state is independent from meal logging.'],
  ['saved', 'Saved meals', 'Add a saved combination; delete its template without deleting logged food.'],
  ['editor-search', 'Quantity editor / search', 'Grams, calories and servings show equivalent quantities and selected-amount nutrition.'],
  ['editor-logged', 'Quantity editor / logged food', 'Opens in grams at the recorded amount, using the same shell as search.'],
  ['editor-zero', 'Quantity editor / zero calories', 'Calorie mode is unavailable when calories cannot determine an amount.'],
  ['editor-error', 'Quantity editor / invalid amount', 'Keep the raw input and explain how to correct it.'],
  ['manual-food', 'Manual food entry', 'An explicit fallback when database information is unavailable.'],
  ['rename', 'Rename meal', 'Changes the label, not the meal contents.'],
  ['date', 'Diary date / calendar', 'Tap a date once to view its diary; no nested picker or confirmation.'],
  ['move-food', 'Move food to another meal', 'Proposed diary organization action; quantities are preserved.'],
  ['time', 'Edit meal time', 'The selected logging time remains separate from the food amounts.'],
  ['save-meal', 'Save meal combination', 'Save a name and its current foods as a reusable template.'],
  ['copy', 'Copy previous meal', 'Shows the source date and uses the copying time for the new log.'],
  ['barcode', 'Barcode / scanner layout', 'Static camera-layout illustration; no real camera access.'],
  ['barcode-manual', 'Barcode / manual entry', 'Numeric entry remains available without camera permission.'],
  ['barcode-request', 'Barcode / request permission', 'Allow camera requests Android permission; manual entry remains available.'],
  ['barcode-denied', 'Barcode / camera denied', 'Manual entry is the usable fallback.'],
  ['barcode-busy', 'Barcode / looking up', 'A clearly labeled simulated product lookup.'],
  ['barcode-missing', 'Barcode / product missing', 'A missing product is not reported as a connection failure.'],
  ['barcode-error', 'Barcode / connection failure', 'Retry the lookup or use manual food entry.'],
  ['save-error', 'Saving failed', 'Keep the staged selection and offer a retry.'],
  ['dark', 'Dark paper', 'Semantic macro colors, with the same typography and hierarchy.'],
  ['large', '200% text', 'Reflow labels and controls; macro percentages have a readable fallback.'],
];
const entry = (id, foodId, grams) => ({ id, foodId, grams });
const emptyMeals = (count = 6) => Array.from({ length: count }, (_, i) => ({ id: `meal-${i + 1}`, time: null, entries: [] }));
export function nutritionFixture(example = 'daily') {
  const meals = emptyMeals();
  meals[0] = { ...meals[0], time: '08:10', entries: [entry('logged-oats', 'oats', 80), entry('logged-milk', 'milk', 250)] };
  meals[1] = { ...meals[1], time: '12:40', entries: [entry('logged-rice', 'rice', 200), entry('logged-chicken', 'chicken', 150)] };
  meals[3] = { ...meals[3], time: '15:30', entries: [entry('logged-banana', 'banana', 120)] };
  const previousMeals = structuredClone(meals); previousMeals[0].entries[0].grams = 70;
  const s = { example, date: NUTRITION_DAY, days: { [NUTRITION_DAY]: meals, [shiftDate(NUTRITION_DAY, -1)]: previousMeals },
    labels: ['Breakfast', 'Lunch', 'Dinner', 'Snack 1', 'Snack 2', 'Snack 3'],
    targets: { calories: 2800, protein: 170, carbs: 327.5, fat: 90 },
    page: 'daily', meal: 0, modal: '', query: 'oatmeal', tab: 'search', searchStatus: 'ready',
    staged: {}, favorites: ['oats', 'chicken'], recipes: [{ id: 'recipe-oats', name: 'Oats & milk', entries: [entry('recipe-1', 'oats', 80), entry('recipe-2', 'milk', 250)] }],
    editor: null, error: '', draft: {}, undo: null, swiped: null, toast: '', loading: example === 'loading', refreshError: example === 'refresh-error', composition: true, serial: 0 };
  if (example === 'empty') s.days[NUTRITION_DAY] = emptyMeals();
  if (example === 'numbered') s.labels = s.labels.map((_, i) => `Meal ${i + 1}`);
  if (example === 'custom-labels') s.labels = ['Before training', 'Lunchbox', 'Dinner with family', 'Afternoon snack', 'After training', 'Evening'];
  if (['near-target', 'over-target'].includes(example)) {
    s.days[NUTRITION_DAY] = emptyMeals();
    s.days[NUTRITION_DAY][0] = { id: 'meal-1', time: '08:10', entries: [{ id: 'manual-totals', manual: true, name: 'Illustrative logged total', calories: example === 'near-target' ? 2785 : 3050, protein: example === 'near-target' ? 169 : 190, carbs: 330, fat: 90 }] };
  }
  if (example === 'narrow-macros') { s.days[NUTRITION_DAY] = emptyMeals(); s.days[NUTRITION_DAY][0] = { id: 'meal-1', time: '08:10', entries: [{ id: 'manual-totals', manual: true, name: 'Illustrative macro test', calories: 600, protein: 1, carbs: 120, fat: 13 }] }; }
  if (['meal', 'meal-empty', 'meal-options', 'food-options', 'move-food', 'swipe', 'editor-logged', 'rename', 'time', 'save-meal', 'copy', 'manual-food'].includes(example)) s.page = 'meal';
  if (example === 'meal-options') { s.page = 'daily'; s.reordering = true; }
  if (example === 'meal-empty') s.meal = 2;
  if (example === 'swipe') s.swiped = 'logged-oats';
  if (['search', 'selected', 'recent', 'favorites', 'saved', 'search-loading', 'search-empty', 'search-error', 'editor-search', 'editor-zero', 'editor-error', 'save-error'].includes(example) || example.startsWith('barcode')) { s.page = 'search'; s.meal = 1; }
  if (['recent', 'favorites', 'saved'].includes(example)) s.tab = example;
  if (example.startsWith('search-')) s.searchStatus = example.slice(7);
  if (example === 'search-empty') s.query = 'Unknown food example';
  if (example === 'selected' || example === 'save-error') s.staged.oats = 200;
  s.modal = ({ 'add-meal': 'add-meal', 'food-options': 'food-options', 'editor-search': 'editor', 'editor-logged': 'editor', 'editor-zero': 'editor', 'editor-error': 'editor', rename: 'rename', time: 'time', 'save-meal': 'save-meal', copy: 'copy', date: 'date', 'move-food': 'move-food', 'manual-food': 'manual-food', 'save-error': 'save-error' })[example] ?? (example.startsWith('barcode') ? example : '');
  if (example.startsWith('editor-')) s.editor = { foodId: example === 'editor-zero' ? 'zero' : 'oats', entryId: example === 'editor-logged' ? 'logged-oats' : null, mode: 'grams', raw: example === 'editor-error' ? '-20' : '80', grams: 80 };
  if (example === 'editor-error') s.error = 'Enter an amount greater than 0.';
  if (['food-options', 'move-food'].includes(example)) s.selectedEntry = 'logged-oats';
  s.draft = { name: s.labels[s.meal], time: meals[s.meal].time ?? MOCK_LOG_TIME, recipeName: 'My breakfast', barcode: '5901234123457' };
  return s;
}
export function dayMeals(s) { return s.days[s.date] ?? emptyMeals(s.labels.length); }
export function currentMeal(s) {
  s.days[s.date] ??= emptyMeals(s.labels.length);
  return s.days[s.date][s.meal];
}
export function nutritionFor(food, grams) {
  return Object.fromEntries(['calories', 'protein', 'carbs', 'fat'].map(key => [key, food[key] * grams / 100]));
}
export function entryNutrition(row) {
  return row.manual ? row : nutritionFor(foods.find(f => f.id === row.foodId), row.grams);
}
export function sumNutrition(entries) {
  const sum = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const row of entries) { const values = entryNutrition(row); for (const key of Object.keys(sum)) sum[key] += values[key]; }
  return sum;
}
export function totals(s) { return sumNutrition(dayMeals(s).flatMap(meal => meal.entries)); }
export function gramsFrom(raw, mode, food) {
  const n = Number(raw);
  if (!String(raw).trim() || !Number.isFinite(n) || n <= 0) return null;
  if (mode === 'calories' && food.calories <= 0) return null;
  return mode === 'grams' ? n : mode === 'servings' ? n * food.serving : n / food.calories * 100;
}
export function quantityFor(grams, mode, food) {
  return mode === 'grams' ? grams : mode === 'servings' ? grams / food.serving : grams / 100 * food.calories;
}
export function macroPercentages(values) {
  const energies = [values.protein * 4, values.carbs * 4, values.fat * 9], total = energies.reduce((a, b) => a + b, 0);
  if (!total) return [0, 0, 0];
  const raw = energies.map(n => n / total * 100), result = raw.map(Math.floor);
  const order = [0, 1, 2].sort((a, b) => (raw[b] - result[b]) - (raw[a] - result[a]));
  for (let left = 100 - result.reduce((a, b) => a + b, 0), i = 0; left > 0; left--, i++) result[order[i % 3]]++;
  return result;
}
export function confirmQuantity(s) {
  const e = s.editor, food = foods.find(f => f.id === e.foodId), grams = gramsFrom(e.raw, e.mode, food) == null ? null : e.grams;
  if (grams == null) throw new Error('Enter an amount greater than 0.');
  if (e.entryId) {
    const row = currentMeal(s).entries.find(r => r.id === e.entryId);
    if (!row) throw new Error('This food is no longer in the meal.');
    row.grams = grams;
  } else s.staged[e.foodId] = grams;
}
export function addEntries(s, rows) {
  const meal = currentMeal(s);
  if (!meal.entries.length) meal.time = MOCK_LOG_TIME;
  for (const row of rows) {
    const existing = !row.manual && meal.entries.find(e => !e.manual && e.foodId === row.foodId);
    if (existing) existing.grams += row.grams;
    else meal.entries.push({ ...structuredClone(row), id: `new-${++s.serial}` });
  }
}
export function previousMeal(s) { return s.days[shiftDate(s.date, -1)]?.[s.meal] ?? null; }
export function addMealSection(s, name) {
  const label = name?.trim();
  if (!label || label.length > 24) throw new Error('Use a meal name between 1 and 24 characters.');
  if (s.labels.some(value => value.toLowerCase() === label.toLowerCase())) throw new Error('A meal with this name already exists.');
  const id = `custom-meal-${++s.serial}`; s.labels.push(label);
  for (const rows of Object.values(s.days)) rows.push({ id, time: null, entries: [] });
}
export function moveMeal(s, direction) {
  const next = s.meal + direction;
  if (next < 0 || next >= s.labels.length) return;
  [s.labels[s.meal], s.labels[next]] = [s.labels[next], s.labels[s.meal]];
  for (const rows of Object.values(s.days)) [rows[s.meal], rows[next]] = [rows[next], rows[s.meal]];
  s.meal = next;
}
export function addStaged(s) {
  addEntries(s, Object.entries(s.staged).map(([foodId, grams]) => ({ foodId, grams })));
  s.staged = {};
}
export function shiftDate(date, offset) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10);
}
