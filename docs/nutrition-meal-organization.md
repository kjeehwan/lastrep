# Nutrition meal organization

## Behavior

- The default is Named. Profile's Meal labels card switches between Named and
  Numbered, with confirmation before resetting custom names. The card appears
  below the TDEE calculator and participates in Profile's Save/Discard flow.
  Unsaved changes do not affect Nutrition. Nutrition's Rename meal dialog still
  saves immediately when its own Save button is tapped.
- The six existing section identifiers remain unchanged. Numbered labels map
  those slots to Meal 1 through Meal 6. Reordering does not change slot identity.
- Extra existing/custom sections remain visible. No food records are migrated.
- Nutrition's meal overflow menu provides Rename meal, Edit meal time, and
  available move actions. Names apply across dates and are limited to 24
  characters. Duplicate visible names are rejected when renaming/adding.
- Reset restores base labels for the selected mode, not the original order.
- The selected date is centered below the meal title and Add to title.

## Times and compatibility

- Optional `mealTimeMinutes` belongs to each food record in a day/section. Time
  edits batch-update all current items in that section. Midnight is valid.
- New empty meals use the first food addition's current local clock time.
- Saved/copied meals use the insertion/copy time for an empty destination.
- Adding/copying into an existing meal preserves its time, including an edited
  time. Quantity edits and deleting individual items do not reset that time.
- Empty meals show `--:--` and cannot set a time until food exists.
- Older records without this field show Set time. No time is inferred from
  legacy timestamps that may have represented preset meal times.
- `loggedAt` continues to select the recorded day. Editing meal time does not
  move food to another day or change its nutrition. `createdAt` is recorded on
  new entries; `updatedAt` records edits. Existing creation dates are not invented.
- Preferences use the existing owner-protected user document; food writes use
  the existing nutritionMeals rules. No rule deployment or native rebuild needed.

## Verification

- Unit tests cover label compatibility, six numbered slots, custom labels, reset,
  clock formatting/validation, old records and first-entry semantics.
- Mocked Firestore tests cover create, atomic time edits, quantity edits, saved
  meals and copied meals, including preservation of an edited destination time.
- Check on device: rename/cancel, Named/Numbered/reset, edited time persistence,
  historical Set time, Add food/Copy without time drift, and keyboard visibility
  in portrait/landscape. Do not modify production records merely to test the UI.
