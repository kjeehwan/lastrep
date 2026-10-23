# Native warm-up set helper

October 23, 2026. Browser and native directions approved after phone review; implemented on feature/workout-warmup-helper. No release build is part of this work.

## Behavior

- + Add warm-up is left aligned between Note and resistance set headers.
- The preview uses plain total weights, centered Set/unit/Reps columns and W markers. Weights/reps are editable. Android reuses Workout's native set rows: a full left swipe deletes, with Undo; tapping W offers Delete without swiping.
- New rows are inserted before the first working set. Existing warm-ups, working sets, completion, effort, notes and the timer are retained. Opening again matches existing automatic suggestions by occurrence and does not duplicate them. Explicit + Add a set rows may repeat existing kg/reps.
- Working sets number independently from 1. Last values and the copy-Last action use corresponding non-warm-up rows from the latest recorded exercise; warm-up Last cells are blank and nonactionable.
- The last added setup is stored locally per account and normalized exercise name. Fixed weights use canonical kg; other rows remember proportions of the first working weight. Saved available-weight settings control rounding; otherwise the editable example uses 2.5 kg / 5 lb increments. Barbell examples start with an editable fixed 20 kg / 45 lb row. This does not assume every bar has that weight.
- A missing working weight can be supplied as a preview reference without filling the working set. Cancel, outside tap and Android Back do not apply preview or preference changes. An account change dismisses the helper; stale set snapshots are rejected before insertion.
- Preferences are remembered on this device; they are not synchronized between installations. Saved workouts and routines use their existing persistence paths.

## Initial verification (before phone-review refinements)

Fresh TypeScript, lint and native configuration checks passed. Full unit suite: 741 passed, 22 emulator-dependent skips. Local dev APK compiled for the phone and emulator; web export passed. Final gesture refactor and native accessibility-label adjustments have separate final check logs in ignored local tooling.

Android 16 disposable emulator with local Auth/Firestore:

- Correct 100 kg x 8 context and 20 x 4 / 60 x 4 / 80 x 2 editable preview.
- Swipe from a number field reveals Delete; Delete, non-swipe Delete and Cancel/reopen checked.
- Adding two warm-ups preserved three working sets, their values/completion/effort, note and stopped timer, confirmed in stored local draft.
- Native table visually showed W, W, 1, 2, 3; blank warm-up Last cells and previous working values 90 x 8, 85 x 10 and 80 x 12 aligned correctly.
- Reopening offered no duplicate insertion. Changing the first working load to 120 kg adapted the remembered two-row setup to fixed 20 kg and proportional 70 kg, retaining existing warm-ups unchanged.
- Numeric typing with the portrait keyboard was visible. Rotation retained entered text; keyboard focus after rotation was not confirmed and is not counted as a pass. Dark appearance and 200% text were visually checked; scrolling reached Add and Cancel. Test display settings were restored.
- Reopening the dev app retained the warm-ups, manually edited first working weight and remembered setup.

Samsung Android 13 phone: installed the final development APK; opened and closed the preview without adding sets, then left it open for the user's native review. The nine-exercise workout draft fingerprint matched its original value after the APK update and cancellation. No real workout was saved or altered. The subsequent phone review and refinements are recorded below.

Screenshots, local accounts, fixture data and checkpoints remain ignored. Tests never write a real account's records. Physical phone checks must preserve the existing workout draft and distinguish canceled preview edits from the user's own intentional additions.

## October 23 phone-review follow-up

- Shared NotebookTextInput and native input token now match Workout kg/Reps/RPE backgrounds across native screens and popups, in both themes. Existing refs, focus handlers and modal keyboard reveal are retained.
- Fixed the escaped-dash placeholder: blank warm-up rows show the unit and Reps.
- Disposable Android 16 emulator: full swipe removed the row; Undo restored it. A manually added 20 kg x 4 row successfully repeated an existing 20 kg x 4 warm-up. Stored local draft retained both and preserved all working values, note and stopped timer. Last displayed all three recorded previous RPE values; warm-up Last cells stayed blank.
- Missing historical RPE remains blank. A read-only account check confirmed that some latest exercise records contain no saved effort; no values were invented or copied from older records.
- Fresh follow-up TypeScript, lint and native verification passed; full unit suite 742 passed, 22 skipped. Web export and dual-ABI development APK build passed. Samsung Android 13: updated the dev APK, opened/closed/reopened the helper without applying sets, and verified the current nine-exercise draft fingerprint was unchanged. The helper is left open for user review. Light popup and dark set-table surfaces were visually checked on the emulator; Profile Identity input focus/reveal was checked in Light. Broad source coverage is not a claim that every field was manually visited.

## Accepted phone review

The user approved the refined helper on October 23, including intentional warm-up additions. After adding three warm-ups and deleting the last one from the workout, reopening suggested the missing row from the remembered setup. This is intended: deleting a set from today's workout does not rewrite the remembered setup. The suggestion is inserted only after confirmation.

Latest verification includes 93 prototype model tests. Enlarged-text and rotation coverage above retain their stated limits; no production release was built for this feature.
