# Home calendar, progress and phases

This batch is based on `fix/workout-search-effort-set-options`. Merge that batch
before this branch to keep review scope separate.

## Changes

- Calendar cells show dates, today/selection states and a single workout dot.
  Tapping a date opens its workout/program details; closing returns to the same
  calendar month. Current phases appear below the month title; dated historical
  phases appear in day details when known. The calendar scrolls in short windows.
- Progress has a '+ Add/edit' action. New manual entries support
  weight, body fat, lean body mass and skeletal muscle mass, with optional fields,
  validation and kg/lbs conversion. These muscle measurements remain distinct.
  New-entry placeholders show the latest value for each metric, not defaults.
  Tapping a chart point only selects its value/date. '+ Add/edit' opens a sheet
  defaulting to Add today, with a dated Edit selected mode for the viewed point.
  Edit mode fills existing values; mode-specific drafts are retained when switching.
  Edits preserve the original date. Imported points receive Lastrep-only corrections.
  Missing latest values use example placeholders. Edit mode allows confirmed entry
  deletion; removing a correction restores its imported original. Imported entries
  can be read again during a later sync. Deletion does not change provider records.
  Weight storage and display preserve up to two displayed decimals. Previously
  rounded values cannot be recovered. Muscle definitions expand from help
  buttons. Successful saves refresh history and open a recorded metric.
  Each metric plots only its latest measurement per local calendar day; earlier
  same-day records remain stored. Equal values on different dates remain visible.
  Empty-field examples use regular text rather than Android's native hint drawing,
  avoiding reliance on native hint redraw. Verify placeholder visibility after
  rotation on the phone. Deleting the latest entry can reveal an earlier same-day
  record; confirmation explains this rather than silently deleting other entries.
- Home has two compact phase selectors near the top, with selection popups.
  Home saves phase changes immediately. Profile keeps its existing Save/Discard
  workflow. Both write through the same transaction against the user document.
  Only a changed phase receives a new start date/history entry. Unknown historical
  starts remain unknown. Profile listens for externally changed phases without
  overwriting locally edited phases or marking clean fields dirty.

## Device checks

1. Calendar: browse months, distinguish today/selection/workout dots, select a day
   and open its details. Close/Android Back must return to the same month.
   Check short landscape windows and known/unknown historical phases.
   Dates without recorded workouts show Rest Day and one empty-state message.
2. Progress: save a weight; confirm its point/value appears immediately and after
   reopening. Save body fat alone; confirm Weight gets no fabricated point.
3. Add separate lean/skeletal values and check each metric tab. Test pounds, blank
   fields, invalid input, cancellation and save failure without losing input.
   Check today's date and example placeholders in Add body composition data.
4. Change training phase on Home; check Profile reflects it with no unexpected
   save prompt. Diet's week must stay unchanged. Save a diet change on Profile;
   return Home and check its Week 1 while training's week stays unchanged.
5. Save an unrelated Profile field; verify phases and start dates remain intact.
   Reopening retains both phases; selecting the current phase does not restart it.
6. Cardio: select Zone 1-5 on Workout; tap the selected zone again to clear it.
   New rows inherit the zone;
   completed rows retain theirs. Reload the draft, save a workout, then check the
   zone in calendar day details. Unspecified zones should not show a '-' label.
7. Select an older chart point, open '+ Add/edit', switch to Edit selected and
   verify its date/value, nearby records and latest
   measurements remain correct after reopening. Check editing in pounds without
   changing untouched fields. The editor uses the app's default font family and
   16px labels/input/unit text, in label/input/unit rows. Check that Add today is
   blank and uses today's date even while viewing an older point. Test Delete
   entry/Keep entry, concurrent changes, restored imported corrections and failure
   recovery. Verify deletion remains reflected after reopening.
8. Compare calendar-opening responsiveness. Visibility is handled within the
   calendar overlay, so opening no longer rerenders the full dashboard. Device
   tap-to-visible latency still needs a phone check; no device timing was recorded.

No native dependency changed; Metro reload is sufficient. Backend deployment is
not needed. This batch does not change meal logging or nutrition search.
