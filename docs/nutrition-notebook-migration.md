# Nutrition Notebook Native Migration

Branch: `feature/nutrition-notebook-ui`.
Design authority: `training-notebook-design.md` v1.14, section 20, and the
approved `prototypes/training-notebook/nutrition.html` states.

## Scope

Nutrition follows the merged Workout and Home notebook migrations. The diary,
meal detail, food search, food-quantity editors, meal organization and barcode
sheet adopt the shared fonts, light/dark paper colors, rules and popup geometry.
Sleep, Profile and Settings are not redesigned in this branch. No dependency
or native rebuild is required. The October 17 review adds owner-only
`users/{uid}/nutritionDays/{dateKey}` metadata for date-specific meal names;
the tested Firestore rule was deployed to `lastrep-ebac5`. Existing food records
and account defaults are not migrated or rewritten.

## Native Mapping

| Approved element | Native implementation | Preservation contract |
| --- | --- | --- |
| Centered sticky toolbar | NotebookHeader / meal title-date header | Root Back goes Home; subpages return to their parent date/meal |
| Date navigation | DiaryCalendar and adjacentDiaryDate | Monday-first calendar; day tap selects immediately; no writes |
| Calories/protein tracks | IntakeBar | Existing kcal/kJ preference and actual targets; readable zero/near/over-target values |
| Consumed/recommended macros | MacroComposition | 4/4/9 energy shares; rounded percentages total 100; real protein target retained |
| Meal ledger | Nutrition index | Same persistent section IDs, custom names, records and times |
| Always-visible reorder | Inline unboxed chevrons | Reuses existing account order persistence; disabled boundary controls |
| Meal organization | MealOrganizationEditor | Rename selected date; optional default switch starts off; Save commits, Cancel does not |
| Food facts / amount | Shared shell and NutritionFactsPreview | Same shell for search and logged items; canonical grams and partial decimals retained |
| Food actions | Visible star and Move icon | Favorites are not hidden in a menu; destination list uses ruled rows; swipe, long-press confirmation and accessibility Delete retained |
| Swipe / Undo | Existing swipe plus deletion undo | Undo restores the original document ID, source, date and meal time |
| Search / recent / favorites / saved | Existing data sources and handlers | No synthetic foods, sources, fixtures or database replacement |
| Manual food entry | ManualFoodEditor | Explicit whole-portion facts; no invented grams or database source; zero-calorie values accepted |
| Barcode | Existing CameraView / Open Food Facts lookup | Real Android permission request when allowed; app settings if blocked; manual entry retained |
| History | Existing calorie timeline and history | Retained below the primary diary rather than removed |
| Popups | NotebookModal / AdaptiveModalCard | Outside tap and Android Back; safe clearance above tabs; keyboard-aware scrolling |

Empty meal sections do not pretend to have a recorded meal time or zero-calorie
food log. Daily totals may correctly be zero. Wide macro labels follow their
segments; narrow labels are clamped and separated without shrinking the font.
At enlarged text, the macro legend stacks and meal rows reflow.

Move food preserves the original food document and nutritional data. It adopts
the destination meal's existing time when available, otherwise retains the
food's recorded time. Favorites use the existing account-scoped local storage
format. A product without sufficient saved reference information does not offer
an invented favorite. Undo is an explicit on-screen action, not a timed snackbar.
Manual food's Add food action saves that food explicitly. When other search
items are staged, it leaves them selected and shows a success message; those
items still require the toolbar Add action. Otherwise it returns to the meal.

## Verification

Automated checks and read-only phone checks are recorded separately. Passing
the former does not imply that account writes or a real barcode were exercised.

- TypeScript and Expo lint: pass.
- Unit/regression tests: 366 pass; 15 integration/emulator tests skip in the
  ordinary run. Separate Firestore emulator run: all 14 rule tests pass,
  including date metadata ownership and atomic default/name updates.
- Expo web export: pass.
- Read-only Samsung phone checks: diary, calendar, empty meal, real oatmeal
  search result and quantity editor; dark and light appearance; Android Back
  and scanner outside-tap dismissal; portrait/landscape keyboard visibility;
  200% diary and macro legend reflow. Original font size, theme and rotation
  were restored. No account records or camera permissions were changed.
- The pre-existing tab labels wrap within words at 200% on this narrow phone.
  The diary itself remains scrollable; a separate shared-navigation accessibility
  refinement is still warranted. Do not interpret this as full screen-reader QA.
- Existing Metro's stale asset-module graph caused an unknown-module error.
  A fresh temporary Metro resolved it and loaded actual food data. No dependency
  reinstall, food-database edit or native rebuild was used to hide the issue.
  At the user's request, Metro on 8081 was subsequently restarted using
  `npm run start:dev-client`; the phone was reconnected there and temporary
  Metro on 8082 was stopped. A real oatmeal search on 8081 returned results;
  the manual-food form opened and Android Back dismissed it without saving.
- Account-write checks, real barcode recognition, permission denial/settings
  handoff, logged-food Move/Delete/Undo and manual-food saving await user testing.

## User Review

1. Review the diary, macro colors/labels and meal ledger against the browser study.
2. Open the date picker; select another day and return to Today.
3. Reorder two meals, leave and return; verify order persists without renaming foods.
4. Rename a meal and edit its time. Cancel must not change either value.
5. Search a food, review nutrition, change grams/calories/servings, confirm and add.
6. Edit a logged quantity. Its initial grams and unit conversions must remain correct.
7. Move a food to another meal; delete it and use Undo. Check totals and record date.
8. Copy previous and log a saved meal. Deleting a template must not delete a log.
9. Scan a known product; check missing-product, camera denial/settings and manual entry.
10. Check keyboard visibility, landscape, enlarged text and Android Back/outside dismissal.

Do not use fake records or alter a real account merely to create screenshot states.

## Resume Checkpoint: October 17

- Home: commit `0ce11a2`, PR #35 merged as `de52be8`; feature branch deleted
  locally and remotely. Shared rules v1.9 include the final Home review feedback.
- Nutrition: implemented on `feature/nutrition-notebook-ui`, based on merged
  main. Changes intentionally remain uncommitted for visual/user acceptance.
- Run `npx tsc --noEmit`, `npm run lint`, `npm test` and Expo web export if code
  changes after this checkpoint. Latest logs/screenshots are under ignored
  `.dev-tools/nutrition-*`; they are local evidence, not shipped assets.
- Next: obtain user review of the diary, meal/search/editor, manual-food and
  organization flows above. Exercise account writes only with user approval.
  Then commit/push Nutrition and open its own PR when asked; do not merge it
  solely because Home was approved.
- No changes to dependencies, food database, releases or account records were
  made for this migration. The additional nutritionDays rule was deployed after
  emulator tests. Account deletion already recursively deletes this metadata.

## October 17 Review Checkpoint

- Restored the fork-and-knife Nutrition icon. Reorder arrows are always visible.
- Removed the extra rule above the first meal/search content section.
- Meal names now resolve date override first, then account default. Optional
  default updates are atomic with the current-date override and preserve other
  dates' overrides. Profile resets only defaults, not date-specific names.
- Search clear action is inside its field; provider/source labels are omitted;
  dates use centered, muted, human-readable text.
- Ordinary-text nutrition facts use four equal columns; enlarged text can reflow.
- Food rows expose favorite and Move actions directly. Move destinations use
  ruled action rows and a separate unboxed Cancel rather than bordered tiles.
- Chart date selection is local; browsing no longer triggers a full history
  refetch on every first snapshot. Actual changes to known dates still refresh
  history. Target text receives scalable width/height instead of a 10 dp clip.
- Final perceived chart responsiveness and account-write workflows still need
  user confirmation. No claim of a measured frame-time improvement is made.

## Follow-up Review: October 17

- Reorder arrows are vertically stacked, each retaining its own 44 dp target.
- The optional-default switch has a framed, contrasting off state.
- Food result rows no longer show database-provider labels. Saved source data
  remains intact; static serving references in the nutrition card remain useful.
- Both quantity editors use synchronous quantityNutrition derivation. The facts
  card remains mounted even for empty/invalid input, so edits cannot replace it
  with a short hint and then reinsert it. Confirm/Save remains disabled when
  invalid. Unit conversion and partial decimal input semantics are preserved.
- Long-press and swipe delete open a notebook confirmation with error/retry,
  Back/outside cancellation, pending-state protection and existing Undo.
- Two additional tests cover equivalent units, intermediate decimals, missing
  facts, invalid amounts and zero-calorie foods.
- Read-only phone check: preview heading bounds remained exactly
  `[142,1133][940,1188]` while changing oatmeal from 100 g to 200 g with the
  keyboard open. The calculated calories updated to 724; no food was saved.

## Meal Ledger and Keyboard Review: October 17

- Removed inter-row container gaps while retaining equal 12 dp top/bottom meal
  padding. Food names replace counts as small-font bullets; totals align with
  the heading rather than the middle of a long food list.
- AdaptiveModalCard now has optional pinned footer and focus-start placement.
  Only the two quantity editors opt in; existing callers retain their defaults.
- Phone check on a logged food: with keyboard open, amount input was at
  [108,530][921,677], and Cancel/Save at y=1154-1215, above the keyboard.
  No quantity was saved. The same shared shell serves search Confirm.
- Swipe and confirmation use the same theme-aware destructive foreground.
  Added an opaque moving foreground to prevent action-icon bleed-through.
  Open/close swipe and long-press confirmation were checked without deleting.
- One additional test verifies grouping of actual food names, preserving meal
  IDs, duplicates and order. TypeScript, lint and all 364 ordinary tests pass.

## Full-width Meal Details and Shared Dialogs: October 17

- Food bullets use a separate full-width block below the summary's P/C/F row.
  Equal row padding remains regardless of whether foods are present.
- Swipe delete is icon-only with an explicit accessible Delete [food] label.
- Copy previous is labeled Copy meal; behavior remains the nearest earlier
  instance of that meal, appended to the destination without deleting food.
- AppDialogHost now uses NotebookAppDialog on Home, Workout and Nutrition,
  including success/error notices and Copy confirmation. Non-migrated pages
  retain their existing dialogs. Shared tab-height geometry keeps root-portal
  dialogs above the same tab bar; two tests cover route boundaries and height.
- Saved-meal success explains: open the destination meal, Add items, Saved meals,
  then Add. That Add writes the saved template's foods to the selected date/meal;
  it does not require the search toolbar Add button.
- Read-only phone check: full-width bullets and the Copy meal notebook popup
  were visually inspected. Copy was cancelled; no records or templates were saved.

## Meal Column Refinement: October 17

- Supersedes the full-width bullet layout above: all food bullets now stay in
  the middle column between time and reorder arrows. Meal name/calories share
  the first row, macros occupy the second, and foods follow below. Time and
  arrows center vertically across the entire entry; equal row padding remains.
- Swipe delete now matches the favorite/move Lucide icons at 20 dp and 1.5 dp
  stroke, without reducing its touch target.
- Saved-meal Add uses the theme's contrasting foreground instead of body ink:
  dark on light coral in dark mode and light on dark rust in light mode.
- Follow-up: right-align macros underneath calories, omit the final meal's
  bottom rule, and narrow swipe delete to a 48 dp button in a 56 dp reveal area.
- Food lists now start collapsed behind an item-count/caret button below the
  name, opposite the macros. The separate meal heading still opens the meal;
  expansion is inline with a 44 dp target and accessible expanded state.
  Expansion state is scoped to the signed-in account and selected diary date.
  No popup or button-color changes were needed for this interaction.
