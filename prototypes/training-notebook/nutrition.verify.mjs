import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foods, nutritionStates, nutritionFixture, currentMeal, nutritionFor, totals, gramsFrom, quantityFor, macroPercentages, confirmQuantity, addStaged, addEntries, addMealSection, moveMeal, previousMeal, shiftDate, MOCK_LOG_TIME } from './nutrition-model.mjs';

test('daily totals are derived from logged foods, not fixed display strings', () => {
  const s = nutritionFixture(); assert.ok(Math.abs(totals(s).calories - 1040.5) < .01);
  currentMeal(s).entries[0].grams = 200; assert.ok(Math.abs(totals(s).calories - 1507.3) < .01);
});
test('recorded editor starts in grams at the real recorded amount', () => {
  const s = nutritionFixture('editor-logged'); assert.equal(s.editor.mode, 'grams'); assert.equal(s.editor.raw, '80');
});
test('quantity conversion preserves grams/calories/servings equivalence', () => {
  for (const food of foods) for (const mode of ['grams', 'servings', 'calories']) {
    if (mode === 'calories' && food.calories === 0) continue;
    const raw = quantityFor(200, mode, food); assert.ok(Math.abs(gramsFrom(String(raw), mode, food) - 200) < 1e-8);
  }
});
test('invalid and zero-calorie quantity conversion never guesses an amount', () => {
  for (const raw of ['', '0', '-1', 'abc', 'Infinity']) assert.equal(gramsFrom(raw, 'grams', foods[0]), null);
  assert.equal(gramsFrom('20', 'calories', foods.at(-1)), null);
  assert.equal(gramsFrom('20.', 'grams', foods[0]), 20);
});
test('confirmed search quantity updates staging without changing the meal until Add', () => {
  const s = nutritionFixture('editor-search'), before = totals(s).calories;
  Object.assign(s.editor, { raw: '200', grams: 200 }); confirmQuantity(s);
  assert.equal(s.staged.oats, 200); assert.equal(totals(s).calories, before);
  addStaged(s); assert.equal(currentMeal(s).entries.find(e => e.foodId === 'oats').grams, 200);
  assert.equal(Object.keys(s.staged).length, 0);
});
test('logged edit changes only the chosen row and keeps its meal time', () => {
  const s = nutritionFixture('editor-logged'); Object.assign(s.editor, { raw: '120', grams: 120 }); confirmQuantity(s);
  assert.equal(currentMeal(s).entries[0].grams, 120); assert.equal(currentMeal(s).entries[1].grams, 250);
  assert.equal(currentMeal(s).time, '08:10');
});
test('invalid confirmation retains logged data', () => {
  const s = nutritionFixture('editor-error'), before = JSON.stringify(s.days); assert.throws(() => confirmQuantity(s)); assert.equal(JSON.stringify(s.days), before);
});
test('same food additions merge quantities without mutating a saved recipe', () => {
  const s = nutritionFixture(), recipe = structuredClone(s.recipes[0]); addEntries(s, recipe.entries);
  assert.equal(currentMeal(s).entries.length, 2); assert.equal(currentMeal(s).entries[0].grams, 160);
  assert.deepEqual(recipe, s.recipes[0]);
});
test('new meal gets logging time only on first food addition', () => {
  const s = nutritionFixture('meal-empty'); assert.equal(currentMeal(s).time, null);
  addEntries(s, [{ foodId: 'rice', grams: 200 }]); assert.equal(currentMeal(s).time, MOCK_LOG_TIME);
});
test('macro percentages use calories, sum to 100 and preserve the 170g target', () => {
  const s = nutritionFixture(); assert.equal(s.targets.protein, 170); assert.deepEqual(macroPercentages(s.targets), [24, 47, 29]);
  assert.equal(macroPercentages(totals(s)).reduce((a, b) => a + b), 100);
  assert.deepEqual(macroPercentages({ protein: 0, carbs: 0, fat: 0 }), [0, 0, 0]);
});
test('previous meal is date-specific, and copied food data can be cloned safely', () => {
  const s = nutritionFixture('copy'), source = structuredClone(previousMeal(s)); assert.equal(source.entries[0].grams, 70);
  addEntries(s, source.entries); assert.equal(previousMeal(s).entries[0].grams, 70);
  s.date = '2026-09-01'; assert.equal(previousMeal(s), null);
});
test('date stepping handles month and year boundaries', () => {
  assert.equal(shiftDate('2026-01-01', -1), '2025-12-31'); assert.equal(shiftDate('2026-10-31', 1), '2026-11-01');
});
test('sample facts scale with the selected amount', () => {
  const values = nutritionFor(foods[0], 200); assert.equal(values.calories, 778); assert.equal(values.protein, 33.8);
});
test('all Nutrition state identifiers are unique', () => assert.equal(new Set(nutritionStates.map(row => row[0])).size, nutritionStates.length));
test('custom meal sections remain available on new diary dates', () => {
  const s = nutritionFixture(); addMealSection(s, 'Pre-workout'); assert.equal(s.labels.length, 7);
  s.meal = 6; assert.equal(currentMeal(s).entries.length, 0); s.date = '2026-11-01';
  assert.equal(currentMeal(s).entries.length, 0); assert.throws(() => addMealSection(s, 'Pre-workout'));
});
test('meal reorder moves name, foods and time together, including previous dates', () => {
  const s = nutritionFixture(), original = structuredClone(currentMeal(s)), source = structuredClone(previousMeal(s));
  moveMeal(s, -1); assert.equal(s.meal, 0); moveMeal(s, 1); assert.equal(s.labels[1], 'Breakfast');
  assert.deepEqual(currentMeal(s), original); assert.deepEqual(previousMeal(s), source);
});
