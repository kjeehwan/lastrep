# Performance batches

## Scope

1. Startup and Nutrition context: remove app-wide food search prewarming. Apply
   relevant Nutrition fields directly from the existing user snapshot, ignoring
   unchanged targets, sections, phase and units. Meal subscriptions stay live.
2. Timer rendering: countdown text owns per-second display updates. The Workout
   screen keeps timestamp anchors and handles rest completion at its deadline,
   not every second. Save and duration editing read the current elapsed clock.
   Display clocks catch up after returning to the foreground.
3. Food loading: scan a complete, generated name/alias catalog to select matching
   records before loading and indexing their nutrition data. Keep ranking and
   full-dataset coverage. Yield during longer scans. Only load the USDA fallback
   when canonical candidate resolution actually needs it.

## Search integrity

The legacy search index contains IDs whose chunk locations do not match the
current packaged files. The candidate catalog is generated from the actual core
and numbered chunk files rather than trusting those locations. Existing capped
canonical/token lookup behavior is unchanged in this performance batch.

`node scripts/build-food-search-catalog.mjs` regenerates the catalog from packaged
assets. The food import script also regenerates it after importing a dataset.
The catalog adds approximately 8.6 MB of uncompressed asset data. It avoids
creating indexed objects for the entire nutrition dataset for each broad search;
very broad queries can still require many nutrition chunks.

Regression fixtures capture 27 queries at limits 3, 10 and 20 before the change.
Tests compare complete results, including order, nutrition values and helper
fields. A separate test checks every catalog candidate against packaged data.
Update fixtures intentionally if the dataset or ranking changes in a future task.

## Verification

- Warm phone baseline, SM_A516N: two rounds of Home, Workout, Nutrition, Sleep
  and Profile, with upward/downward scrolling on each page. 983 frames, 36
  deadline misses (3.66%), p95 20 ms, p99 73 ms. This is not a cold-start trace
  and does not establish a cause for every perceived delay.
- Valid after-change comparison, after confirming Lastrep Home and dismissing
  Expo's developer overlay: 990 frames, 41 deadline misses (4.14%), p95 22 ms,
  p99 97 ms. This does not show a warm-navigation improvement over the baseline.
  A prior sample on Expo's connection-error screen was discarded as invalid.
- Local Hermes sampling profile of the same navigation sequence captured 25.5
  seconds. React synchronous root rendering accounted for approximately 1.46
  seconds cumulatively; Firestore snapshot/query processing also appeared.
  No food-search scan ran during this warmed navigation profile. These are
  profiling leads, not proof of the cause of all perceived latency. The profile
  is stored only in ignored `.dev-tools/lastrep-navigation.cpuprofile`.
- Device follow-up: repeat the same navigation sequence after loading the new
  bundle; check elapsed/rest timers, pause/resume, background catch-up and draft
  restoration. Check targets/phases/unit changes and food search on the device.

No native rebuild is required. The retained improvements were accepted for
commit after the profiling-free smoke test below; this is not a claim that all
perceived lag is resolved. See the archived targeted-profiling findings for the
remaining normal-mode delay and measured fast-mode improvement.

## Profiling-Free Phone Smoke Test

October 14, 2026, Samsung SM-A516N, normal development mode:

- Cold restart loaded Home; the removed profiling global was undefined.
- Tab navigation and Workout scrolling reached the footer and all four sets.
- Native decimal weight input accepted 105.5. Editing Reps and RPE kept focus
  on their respective fields rather than moving to Weight.
- Rest countdown advanced from 1:30 to 1:24 across app switching. Pause kept
  the display at 1:28 with Start available; the paused value remained stable.
- Workout elapsed time advanced to 0:06 across a five-second background interval.
- Four-set draft, temporary edited values and running timer survived a cold
  reopen. Original local drafts were restored afterward. No workout was saved.
- Oatmeal search returned plain Oatmeal, Quick Oats, Rolled oats and other
  relevant entries using Android's asset loader. The selected-amount facts
  displayed 190 kcal, 5 g protein, 38 g carbs and 2 g fat. Preview was cancelled;
  no food or meal was saved.
- Profile reported Connected, Sleep Ready and Body comp Ready (partial).
  Sleep displayed the saved 7h 48m record. Permissions were not changed; a new
  health-data import was not required or asserted by this smoke test.
- Typecheck, lint and web export passed; 275 active tests passed, 14 skipped.
  Five tests for removed profiling infrastructure were intentionally removed.

Temporary profiling hooks, globals, capture scripts and npm commands are not
retained. Unsuccessful FlatList and conditional swipe-import experiments were
removed. Android hierarchy dumps can time out while timer text ticks; timer
assertions used screenshots rather than treating those timeouts as successes.
Audio gong delivery, a full workout save and a release build remain outside
this focused smoke test.

Final review also added a regression test for an expired restored countdown
with zero seconds still marked running; it now stops and clears its deadline.
