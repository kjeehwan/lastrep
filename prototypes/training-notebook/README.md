# Training notebook / Browser studies

A standalone, dependency-free browser design study based on
[`docs/training-notebook-design.md`](../../docs/training-notebook-design.md).
Workout, Home, Nutrition and Sleep incorporate the approved review refinements.
Profile and Settings also incorporate the approved review refinements. All six
main screen design directions are approved. None replaces a Lastrep application screen.

## Open it

**Home study:** after starting the server, open
**http://127.0.0.1:4317/home.html**. The studies link to one another from the
review sidebar. Home has 25 example states; its design direction is approved.

**Nutrition study:** **http://127.0.0.1:4317/nutrition.html**. It has 44 example
states and shares the approved notebook typography, colors and control rules.
All six studies are linked from their sidebars and available bottom-tab destinations.

**Sleep study:** **http://127.0.0.1:4317/sleep.html**. Its 33 example states use
the approved notebook typography and restrained chart palette.

### Sleep review paths

1. Overview: selected night, duration, target comparison, source and saved time.
   Tap a chart date or calendar day; missing nights show Not recorded, not zero.
2. Scroll the chart. It opens on the latest nights, including after changing
   viewport; deliberate browsing is retained. Weekly averages count only recorded
   nights and show coverage. A nearby date/duration readout follows bar selection.
   View records opens five records; View more appends five at a time.
3. Record sleep using the circular 24-hour clock: drag B/W handles or type HH:MM
   times, review explicit dates under both time fields and the calculated interval,
   then Cancel
   or Save. Duration-only mode remains for imported records without timestamps.
   No times are invented. Saved manual times preload on edit. Date-specific and
   time-based entry are proposed; native schema, DST, override and gesture checks
   remain necessary. The interval does not subtract time awake.
   Tap either date to change it; a calendar cancellation keeps the time draft.
   Tap Your target to edit the target directly; Cancel changes nothing and Save
   updates this study's summary and chart. Native Profile/Sleep must share one
   preference; the Profile candidate now demonstrates this within the browser tab.
4. Review disconnected/saved, removed permission and unavailable states. Account
   records remain visible. Health-access controls link to the Profile study rather than
   pretending to grant a device permission. No real health access occurs.
   Missing/outdated Health Connect offers setup steps; unsupported devices offer
   manual logging without promising installation will fix them.
5. Sync sleep asks for destination-account confirmation. The simulated check keeps
   records unchanged and reports No new records; last sync changes, saved time
   does not. Failure, offline, loading and stale records have separate states.
6. Review dark, 200%, compact, landscape and tablet layouts. No bedtime, sleep
   stages, quality scores or recommendations are inferred from duration.
7. Split night: two entries (23:00–03:00, 04:00–07:00) total 7 hours. Add a nap;
   only that session is added. Edit/delete through each entry, not the daily total.
8. Wearable split: provider sessions retain source and stable IDs. Repeating the
   split-session sync simulation does not duplicate records. Corrections/exclusions
   in Lastrep survive it. Provider-overlap keeps sources visible but counts time
   once. The mock counts session windows, not stage-verified time asleep.
9. Overlap review retains the draft and requires confirmation before replacing
   the listed entries. Legacy totals with unknown times are not silently summed
   with new sessions. This proposes a session store; native imports still flatten
   sessions to daily totals. Migration/provider reconciliation is not implemented.

Sleep uses an independent in-memory fixture. No account, health or API access;
no sleep data is shared with Home. Reset/reload discards edits.
Checks: `node --test prototypes/training-notebook/sleep.verify.mjs`.

### Profile and Settings approved baseline

**Profile:** **http://127.0.0.1:4317/profile.html** (29 states).
**Settings:** **http://127.0.0.1:4317/settings.html** (20 states).

1. Profile: edit identity/photo, cancel and reopen; then stage a change and try
   Back or a bottom tab. Check Save/Discard/Keep editing and save-failure retry.
   Photo uses an illustration only, not your camera, files or cloud account.
2. Change and save a phase; inspect it on Home. Change it on Home and return to
   Profile. Save a sleep target in either Profile or Sleep and inspect the other.
3. Review grouped Units/RIR and Nutrition targets editors, TDEE disabled/valid
   states and the body snapshot. Tap each body metric to edit, including lean
   mass; use adjacent help buttons for definitions. Closing a sheet must preserve
   the page position. TDEE stages calorie changes and keeps protein. Goal and
   Meal labels cards are removed; rename meals directly in Nutrition. Saved
   effort/weight defaults appear in Workout.
4. Compare disconnected, consent, permission review, partial, revoked and
   unavailable health states. Cancel must not connect; permissions alone are not
   consent. Disconnect keeps saved timestamps. Sync is explicitly simulated.
5. Settings: check Account/Support/Legal alignment, neutral nickname access badge,
   App version inside Support with its outlined information icon (no About section),
   dev billing, manual Premium,
   all four Restore outcomes, logout/delete cancellation and Back to Home.
   Store actions are previews. Policy/mail links open only when explicitly tapped.
6. Use the viewport controls, dark paper and 200% text for both screens. Workout,
   Nutrition and Sleep now share the centered root title/Back to Home pattern.

Only selected synthetic preferences share same-tab sessionStorage: identity/avatar,
phase history, sleep target, meal labels, effort/weight defaults and health-state
simulation. Profile/Settings Reset clears these preferences. Explicit review
states remain canned examples. Other record fixtures stay independent: Home body
history, Nutrition records/targets, Workout drafts and Sleep sessions are not a
unified account. No actual health, photo, billing, login or deletion API is called.

Checks: `node --test prototypes/training-notebook/account.verify.mjs`.
All prototype models: `node --test prototypes/training-notebook/*.verify.mjs prototypes/training-notebook/verify.mjs`.

October 16 approved baseline verification: 86 prototype model tests and 1,022 browser
layout checks across the six studies passed. Interaction checks covered Profile
Save/Discard, nested photo cancellation, shared phases/targets/units,
TDEE, consent/permissions/disconnect, save retry, restore outcomes/dev isolation,
deletion previews and navigation. Additional checks covered four-metric editing,
focused inputs, preserved scroll, help separation, access badges, Support version and
centered headers/back navigation. Lint, JavaScript syntax and diff checks passed.
No browser errors or unintended external requests were recorded. This verifies
the mockups, not the corresponding native app features.

### Nutrition review paths

1. Daily diary: review calories/protein bars, zero/near/over-target labels, macro
   composition and the timed meal ledger. Recommended macros use the illustrative
   profile targets, including 170 g protein. Percentages are calorie-based.
2. Open a logged meal, tap its food and review the quantity editor. It starts in
   grams at the recorded amount. Switching grams/calories/servings preserves the
   equivalent amount; Cancel leaves the log unchanged. Selected-amount nutrition
   and optional per-100-g facts are available in the same editor shell.
3. Search foods, tap an item, edit and Confirm amount. The summary in the search
   results must show the changed quantity. Add the selection to the meal; matching
   foods merge their grams rather than silently replacing the previously logged amount.
4. Rename a meal, change its logging time, add a custom meal section and try
   Reorder beside Log meals. Unboxed up/down chevrons appear beside the calories; Done
   hides them. Name, contents and time move together. The meal-page toolbar has
   no redundant options menu.
   Empty meals open from the meal name, without a duplicate plus button.
   The workbench also previews named meals and Meals 1–6.
5. Save a meal combination, reuse it from Saved meals, and delete its saved
   template. Deleting a template must not delete food already logged. Copy previous
   meal shows the source date and foods, adds rather than replaces, and uses the
   fixture copying time of 18:30. Empty previous meals cannot be copied.
6. Swipe a food left and Delete, or use its options menu. Undo restores the food
   and logging time. Browser pointer simulation is not native gesture validation.
   The menu avoids duplicate editing and offers Move to another meal, Favorite
   (database foods) and accessible Delete. Move is a proposed native feature.
7. Barcode scanner is a static layout, not a live camera. Simulate recognized
   product or enter `5901234123457` to review the sample milk. Other 12–14-digit
   inputs show Product not found. Camera-denied and connection-failure states
   are separate. Manual food entry remains available without camera permission.
   Allow camera and Open camera settings lead to explicitly labeled simulations,
   never a real camera request or a claim that device permissions changed.
8. Review dark, 200%, loading/error, narrow macros and empty states. The mockup
   uses kcal and grams; do not infer that native energy-unit preferences are removed.
9. Tap the diary date, then a calendar day: it selects immediately. There is no
   duplicate toolbar calendar or nested browser date control. Time editing uses
   styled hour/minute lists with Save/Cancel, rather than the browser time picker.

The review-state selector preserves its original order on every study. It opens
scrolled to the current state, with earlier states available by scrolling up.

All food values, brands, serving sizes, search ordering and barcode mappings are
illustrative. This study does not improve or verify the actual food database or
coverage. No database, camera, nutrition API or network save is invoked. Its food
diary state is in memory, separate from Home; resetting/reloading loses edits.
The Home Log a meal preview can link here or separately simulate its Home action.

Nutrition checks: `node --test prototypes/training-notebook/nutrition.verify.mjs`.

From the repository root:

```powershell
node prototypes/training-notebook/serve.mjs
```

### Home review paths

- Returning user: review the phase selectors, workout shortcut, Progress,
  Readiness and Weekly Trends. Scroll the screen; the header and tabs stay put.
- Change a phase, then tap the profile initial: its phase controls share the
  same in-memory state. Changing to a different phase starts week 1; selecting
  the current phase preserves its start date. Calendar past-day phases stay historical.
- Tap a Progress point: it only selects a record. Tap Add/edit to open the form.
  Add today and Edit Oct 12 (for example) explicitly name their dates; switching modes
  preserves each temporary input draft. Save replaces the latest mock daily
  entry rather than adding multiple same-day chart points. Delete confirms the date.
- Switch to Body fat: its latest observation is in July, not the date of the
  newest weight. Lean mass intentionally has no records. Skeletal muscle is a
  distinct metric. Large text enlarges chart labels/marks and scrolls to selection.
- Open Calendar, tap a date, then close day details: return to Calendar. Rest
  days show one No workouts logged message. Workout indicators are completed
  records, not today's unfinished plan. Phase information lives in day details.
- In Complete today's picture, mock logging a meal removes only that action.
  Connecting health data links to a scope preview, not a fake permission grant.
- Check new-user, disconnected/saved, sparse, loading, error, dark and 200% states.
  Returning-user loading never flashes Get started. Saved data is not evidence
  that sync is currently connected.

Home interactions are illustrative. Profile and Settings remain scope previews.
Workout, Nutrition and Sleep link to their separate browser studies. Saved
recovery check-ins (ratings, discomfort, activity and note) are shared only
between Home and Workout using same-tab session storage.
Other state is not shared. Reset example clears the saved check-in. No values
are transmitted to a server.
The logo retains the current production gradient treatment; no branding assets
or native app files are changed.

Home model checks: `node --test prototypes/training-notebook/home.verify.mjs`.

Open **http://127.0.0.1:4317**. Keep that terminal running. Stop with Ctrl+C.
If that port is occupied, choose another:

```powershell
node prototypes/training-notebook/serve.mjs 4318
```

This server listens only on laptop loopback. It is not a phone/LAN server and
does not use or stop Metro on port 8081. No npm install, dev-client rebuild,
Firebase credentials or Figma access is required. Use the server rather than
double-clicking the HTML file: browsers restrict ES modules on `file://` URLs.

## Start with the approved screens

The initial example shows the approved active Workout and a static reps-editing
reference side by side. The left frame is interactive; the reference is inert.
Uncheck **Compare approved screens** for a single-frame review.

The two screens preserve the approved revision:

- Warm paper and charcoal, Source Serif 4 titles and Source Sans 3 interface text.
- An 80-high header with space above/below Finish.
- No redundant remote `Timer running` label.
- Matching right edges for Change and Review.
- The original equal-width supporting controls (subsequently revised to Demo,
  Rest and direct Tempo, with a visible Note field in this browser prototype).
- Previous effort in Last, such as `105 x 3 @ 10` (or `@ 0` for RIR).
- The exact synthetic chest/triceps fixture, including mixed dumbbell loads,
  completed first bench set and blank new effort fields.

The frames are recreated in code, not embedded Figma screenshots. Browser text
rasterization can differ from Figma. Dimensions are CSS logical pixels.

## Review the rest

The **Review a state** selector contains these groups:

| Group | What to inspect |
| --- | --- |
| Approved screens | Active log and reps editing with illustrative keyboard |
| Setup | Empty session, routines, recommendation setup, multi-selection, loading, no matches, error and custom exercise |
| Active controls | Exercise/set options, reordering boundaries, rest running/paused/detail, exercise details, available weights and inline set Undo |
| Today's Plan | Entry, disclosure, busy, no changes, selected changes, grouped explanation, stale, applied/Undo, error and optional daily inputs |
| History and types | History/progress, empty history, cardio unset/selected, bodyweight and custom placeholder |
| Completion | Finish review, saving, error, saved acknowledgement, optional routine update, updated acknowledgement, deload and discard |
| Responsive checks | Dark theme, compact phone, landscape keyboard, 200% stacked rows and two tablet sizes |

Direct links can select a state, for example `/#plan-changes` or `/#landscape`.
Changing examples or pressing Reset example starts a new synthetic session.
Viewport, dark mode, text scale and RPE/RIR can also be changed independently.

### Useful interaction paths

1. Edit Set 2 Reps, delete a digit and verify focus stays there. Weight accepts
   intermediate strings such as `20.`. The illustrated number pad can type into
   the focused field; a normal desktop keyboard also works.
2. Tap Last to copy that set's recorded values. New exercises do not automatically
   inherit recorded effort. Check a set; add or duplicate a set.
3. Open a set marker, choose a set type or delete it. Undo appears at that exercise.
4. Open exercise options. Try moving the first exercise down; Up is initially
   unavailable. Units, replacement and available-weight entry are mock controls.
5. In Add exercise, change the query, remove a selected chip and Add the selection.
   A new custom exercise stays local and retains Demo, Rest, Tempo and Note. Demo
   opens the unavailable-media placeholder only when tapped.
6. Start rest, pause and resume. The mock countdown is derived from a deadline;
   only its text updates. Skip clears the dock. No notifications are sent.
7. Open Selected exercise changes, inspect each set, Apply, then View and Undo.
   Completed/warmup sets stay unchanged; editing afterward makes Undo unavailable.
8. Finish, save and acknowledge Workout saved before deciding whether to update
   the routine. The deload example does not offer to overwrite its source routine.

Escape dismisses non-busy dialogs or the mock keyboard. Outside-click dismissal
and dialog Tab containment are supported. Real focus and scrolling still need
device validation when implementing the native screen.

## Important limits

### Review changes after the first state walkthrough

- Custom resistance exercises keep Demo, Rest, Tempo and Note. Unavailable demo media appears
  only after tapping Demo, never as a permanent block in the exercise log.
- Details is replaced by a direct Tempo control; Note remains visible below
  the controls. Tempo shows a saved value only when one exists. Cardio has no
  lifting-tempo control. Available weights stays in the three-dot menu only.
- At 200%, the history plot doubles its rendered labels and points and scrolls
  horizontally rather than compressing them into an unreadable chart.
- Search failure says `Try another search.` Selected chips remain visible.
- The saved confirmation places its checkmark beside the title.
- Cardio completion uses the same checkbox treatment, beside time and distance.
- Guidance demonstrates both load reduction (bench) and rep reduction (incline),
  including before/after reps. These are synthetic examples, not prescriptive advice.
  The final interface must support changes to load, reps and working-set count.
- Pain choices are illustrative, not a two-area product restriction. The expanded
  list demonstrates selection and layout; body-area-specific guidance, laterality,
  severity and movement-trigger inputs still need real implementation review.
- The 200% view is an accessibility stress test for enlarged system text, not
  the default design. Full-width sets use aligned label/input pairs and Done rows.
  Native font scaling, screen readers and device usability still need verification.

- Everything is synthetic. Record edits are in memory; recovery check-ins and
  selected demo preferences use same-tab sessionStorage as described above.
- No account, Firestore, OpenAI, health, billing, camera or production API calls.
- Saving and AI review delays are short simulated transitions, not performance
  claims about real services. Explicit failure states are chosen in the selector.
- Recommendations load a display fixture; this is not a recommendation engine.
  The example adjustments demonstrate UI and preservation rules, not medical or
  training guidance. The historical chart is also synthetic and explicitly labeled.
- Demonstration videos/images and unimplemented destinations are outside this study. Those
  controls explain that limitation rather than silently navigating to a blank page.
- The illustrated keyboards are layout aids, not Android/iOS keyboard emulation.
  Landscape uses a shorter keyboard illustration. Actual IME dimensions and native
  focus behavior must be checked separately on the phone.
- Browser dark mode and 200% styling do not prove native accessibility support.
  Screen-reader behavior, large text and touch targets need native validation.
- The completed local states are not additional Figma frames. Figma's MCP quota
  blocked creation; the two approved Figma screens remain unchanged there.

## Checks

```powershell
node --check prototypes/training-notebook/prototype.mjs
node --test prototypes/training-notebook/verify.mjs
```

The Node checks cover fixtures, effort display, mixed-load adjustment safeguards,
completed volume, reorder boundaries and unit conversion. Browser checks during
development additionally exercise all 47 states and representative mock flows.
Do not mistake a passing prototype check for a Lastrep app regression test.

Verification snapshot (October 15, 2026): 8 prototype model tests passed;
47 state renders and 141 responsive/large-text layout checks passed in headless
Chrome. Interaction checks covered first-edit focus, decimal text retention,
viewport changes, Last/effort display, selection, custom exercise creation,
reorder boundaries, inline Undo, guidance Apply/Undo guards, cardio unselection,
history, timer pause/resume and save-before-routine-update ordering. No browser
JavaScript errors or external requests were recorded. Representative screen
captures were visually inspected; this is not an exhaustive device or assistive
technology test. Lastrep's 326 active tests, lint and typecheck also passed.

Fonts are bundled for offline use. License notices are in `assets/`. The prototype
has no imported runtime dependencies and does not change the root package files.


## Authentication and onboarding studies - October 19

Open `http://127.0.0.1:4317/auth.html` for Sign in / Sign up (user approved) and
`http://127.0.0.1:4317/onboarding.html` for the revised four-step setup proposal.
Both are linked from the six existing studies. If the server is not running,
start it from this directory with `python -m http.server 4317 --bind 127.0.0.1`.

Onboarding now covers Experience, Availability (1-7 day slider), optional Nickname
and Optional health sync, with a final Go to Home action. The existing Home logo
is at the upper left; Back/Skip sit below it. Goal, sample week and the standalone
save-failure example have been removed. Phases remain managed in Profile.

Use made-up credentials only. Inputs are in memory; no account, API, Google,
health or storage operation runs. Sign-up proceeds to the onboarding study;
Sign-in succeeds only as a local simulation. Authentication review selectors
expose invalid credentials, existing email, offline, connecting and success.
Onboarding selectors now show only actual steps. Back retains availability,
experience and nickname. Skip advances without requiring a choice. Health
connection remains available later in Profile; this study requests no permission.

Use Dark paper, 200% text and the five viewport presets to review both studies.
Native authentication/onboarding has not changed. Real keyboard and native
screen-reader behavior require a later implementation/device pass.

The earlier 280 browser checks covered the superseded first proposal. Current
verification: 220 layout combinations passed across all 11 current states, five
viewport presets, both palettes and normal/200% text. Interaction checks passed
for logo/Back/Skip placement, slider keyboard adjustment and bounds, optional
nickname, preserved Back entries, Skip progression and final Home navigation.
No browser exceptions, overflow defects or external requests occurred.

Final availability refinement: visible minus/plus buttons removed with user
approval. The latest 220 layout checks and interaction checks passed again,
including Arrow keys, Home/End, 1-7 bounds, updated accessible value and retained
Back selections. Production/dev logos remain separate; the study shows production.


All study sidebars use the same Screen studies navigation order: Home, Workout,
Nutrition, Sleep, Profile, Settings, Sign in / Sign up and Onboarding (omitting
the current page). Screen links sit above review controls and use Review labels
without a prototype suffix. Scope and review guide remains below the controls.

Password visibility now uses eye/eye-off icons with accessible Show password /
Hide password labels, matching native auth. The updated study passed the 220
layout combinations and flow checks again; no exceptions or external requests.

The password eye control sits inside the input's right edge with reserved text
padding; email/password borders have equal width. All 220 study checks passed
again, plus 40 auth geometry checks across themes, sizes and enlarged text.
