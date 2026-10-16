# Training notebook / Browser studies

A standalone, dependency-free browser design study based on
[`docs/training-notebook-design.md`](../../docs/training-notebook-design.md).
Workout, Home and Nutrition incorporate the approved review refinements.
None replaces a Lastrep application screen.

## Open it

**Home study:** after starting the server, open
**http://127.0.0.1:4317/home.html**. The two studies link to one another from the
review sidebar. Home has 25 example states; its design direction is approved.

**Nutrition study:** **http://127.0.0.1:4317/nutrition.html**. It has 44 example
states and shares the approved notebook typography, colors and control rules.
All three studies are linked from their sidebars and available bottom-tab destinations.

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

Home interactions are illustrative. Profile, Settings, Sleep and Nutrition
destinations are scope previews, not complete redesigned pages. Workout opens
the separate approved study. Saved recovery check-ins (ratings, discomfort,
activity and note) are shared across those pages using same-tab session storage.
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

- Everything is synthetic and in memory. Refreshing/resetting discards edits.
- No account, Firestore, OpenAI, health, billing, camera or production API calls.
- Saving and AI review delays are short simulated transitions, not performance
  claims about real services. Explicit failure states are chosen in the selector.
- Recommendations load a display fixture; this is not a recommendation engine.
  The example adjustments demonstrate UI and preservation rules, not medical or
  training guidance. The historical chart is also synthetic and explicitly labeled.
- Demonstration videos/images and other app tabs are outside this study. Those
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
