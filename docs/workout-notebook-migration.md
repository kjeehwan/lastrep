# Workout Notebook Native Migration

Branch: feature/workout-notebook-ui. Design authority: training-notebook-design.md v1.7.

## Boundaries

Migrate Workout only. Home, Nutrition, Sleep, Profile and Settings retain their
current native UI. The tab bar may use the notebook appearance while Workout is
focused, but must restore the existing appearance on other tabs. No schema,
recommendation algorithm, consent, entitlement or workout-save changes.

## Component Map

| Approved element | Native owner | Preservation contract |
| --- | --- | --- |
| Paper/ink, fonts, controls | src/ui/notebook | Scoped to Workout; no app-wide Text defaults |
| Sticky centered header, Finish | NotebookHeader + workout/log.tsx | Back keeps draft; discard remains explicit |
| Date, title, elapsed time, phase | WorkoutSessionCard | Existing timer clock, title and date handlers |
| Routine/change and setup | workout/log.tsx + routine section | Keep builder, append, deload, repeat and save actions |
| Today's Plan review sheet | WorkoutTodayPlan | Existing freshness, Apply/Undo and context rules |
| Exercise Demo/Rest/Tempo/Note | workout/log.tsx | Same demo/history/timer/note/tempo handlers; no persistent placeholder |
| Set / Last / load / reps / effort / Done | NativeSetRows + Android RecyclerView | Exact-field focus, decimals, completion, copy Last, swipe delete/Undo |
| Large text set reflow | Android rows + JS fallback | No compressed six-column table at enlarged system text |
| Add/search/custom/selection | add-exercise.tsx | Account-scoped selections/favorites, clear query and selected chips |
| Sheets, history, available weights | existing Workout modal components | Keyboard avoidance, cancel, validation, existing data and actions |
| Finish/save/routine update | workout/log.tsx | Save confirmation precedes routine-update prompt; deload guard unchanged |

The native set-list templates must match tracked Android sources, including
Last-tap events, no-op column-label updates and no-fullscreen keyboard flags.
Never replace those behavioral fixes with older prebuild template code.

## Verification

Baseline: 326 active tests pass; 14 existing emulator/integration tests skipped.
Run tests, TypeScript, lint, Android-native configuration verification and web
export after migration. Build/install only the dev package, never uninstall it
or clear app data to bypass a problem. Do not alter or save the user's existing
workout records during device testing without approval.

Device coverage: cold entry, empty/setup, routine load, native reps/RPE focus and
decimal edits, copy Last, completion, add/delete/Undo, Demo/Tempo/Note, timer
pause/resume/background, guidance review, history, discard cancellation, portrait,
landscape, enlarged text and dark paper. Record actual observations separately
from code/test coverage. Workout save and destructive actions require a test
account or explicit user confirmation; do not fabricate a successful device test.

## Implementation Notes

- Bundled static Source Sans 3 Regular/Semibold and Source Serif 4 Semibold.
  Android rendered the browser variable font too thin; static instances were
  checked on the phone. OFL notices and source provenance are in assets/fonts.
- The notebook provider and font loading are scoped to the Workout stack. The
  tab bar and status-bar icon style change only while that stack is focused.
- Session setup/recommendation controls remain available through Workout options;
  they no longer occupy the space above an active workout's exercise rows.
- Routine, recommendation, history, note, tempo, favorite, reorder, available-load,
  set-type, Last copy, completed-set and save handlers retain their existing logic.
- Android rows preserve the precise-field focus guard and partial-decimal handling.
  First-tap selection runs after touch release so Android cannot immediately
  collapse it. The owning ScrollView keeps the complete editor above the keyboard.
- Large text uses a set summary plus labeled load/reps/effort lines. Wider header
  actions move below the centered title. Tab labels wrap and gain vertical space.
- Native source/template parity tests prevent a future prebuild from reverting
  the checked input, event and keyboard fixes.

## Verification Record / October 16, 2026

Automated: 332 active tests, TypeScript, lint, Android-native configuration verification,
web export and devDebug compilation passed. Existing rules/emulator-dependent
test skips are not counted as passes. No dependency or backend schema changes.

Device: Samsung SM-A516N, connected via USB; installed dev package with `adb -r`,
without uninstalling or clearing data. Normal-mode Metro, not the minified fast
mode. Verified the preserved Bench Press draft, native decimal input (105.5),
Reps and RPE focus/first-value replacement, keyboard visibility, search/results/
clear/back without adding records, paper/dark styles, portrait/landscape layout
and the 200% set-row reflow. Temporary numeric edits
were restored to 105 x 3, 85 x 6 and 85 x 6, with blank effort. No workout or
routine was saved, overwritten or deleted in the account.

Original phone settings: font scale 1.1, rotation lock on / portrait, night mode
yes. Temporary font/theme/orientation changes are restored after the checks.

Still requires user confirmation: overall visual/interaction approval, a real
Finish/Save and routine-update sequence on a suitable test workout, Today's Plan
Apply/Undo against an appropriate plan, and extended training/timer usability.
Those flows have automated/code coverage but were not claimed as live account
write tests. This branch is uncommitted pending review.

### Browsing Crash Follow-Up

The reported browsing crash was confirmed in Android logcat: native set-input
focus reached ReactScrollView.scrollToChild and threw `IllegalArgumentException:
parameter must be a descendant of this view`. The Workout ScrollView now disables
Android's automatic child-focus scrolling; native set inputs retain their own
keyboard-visibility handler. Exact-field touch focus is preserved to prevent
the earlier Reps-to-weight regression. Touch focus and posted focus restoration
are guarded against detached views and recycled holders. Both native source and
prebuild templates contain the fix.

Rebuilt and installed the dev APK without clearing data. On the connected Samsung
phone, repeated scrolling and switching between Reps/RPE produced no new crash
entries after the final build launch. The focused Reps input was visible above
the keyboard. Temporary input changes were restored; the draft remains
105 x 3, 85 x 6, 85 x 6 with blank effort, and no workout was saved.
Automated checks: 333 active tests pass (14 existing skips), TypeScript and lint
pass, native configuration verification passes, and devDebug compiles.

### Workout Review Adjustments

- All Workout dialogs use a shared system-inset wrapper so sheet controls stay
  clear of Android navigation buttons and landscape side insets.
- The timer is a compact play/clock button with a two-digit minute display.
- Today's Plan uses a stable-height sheet, explanations expand after their
  toggle, and every changed exercise has a separator. Review matches Change.
- New pain/activity entries begin unselected; incomplete enabled sections explain
  what needs selecting rather than silently saving invented defaults. Existing
  saved selections remain editable.
- Routine/recommendation/session controls are visible between the session summary
  and exercises, not hidden in Session options. Add exercise and Save as routine
  use matching secondary-button styling.
- Active set rows use a subtle tint and margin marker; focused native fields gain
  an accent border. Lifting and cardio use the mockup's square, drawn-checkmark style.
- Distance editors are wide enough for multiple digits; rest presets have a
  larger gap before the custom field. Selected search filters remain readable.
  Set-type help expands within the notebook sheet instead of a system alert.

Device observations: Tempo and Set Distance action buttons clear the Android
navigation area; the distance editor displayed 12 without applying it. The active
row tint and drawn native checkbox were inspected. No test workout was saved.

## Resume Checkpoint / October 16, Late Evening

Latest review changes remain UNCOMMITTED on feature/workout-notebook-ui.
Native dev APK was built and installed without clearing data. Normal Metro was
already running. The connected phone is R5CN506HB8D. Do not save a test workout,
change the user's existing values, uninstall, or clear data.

Implemented: slimmer outlined timer; text-style session actions in two rows;
notebook routine action rows; one separator per exercise group boundary; separate
Set types help sheet with Close; additional bottom-tab icon spacing. Native
confirmed-tap activation and global activeSetIndex/onSetActivate plus
editingSuspended wiring were added. Distance initial selection uses
useNumberEntry/inputSelectionGate rather than native selectTextOnFocus.

Checks: devDebug build, lint, TypeScript and 339 active tests pass (14 existing
skips). Native sources/templates are synchronized. These passes do NOT establish
that the remaining interactions work correctly.

Phone checks still failing / must finish before approval:
- Swipe across a previously inactive Reps input scrolled without keyboard or
  row activation: observed passing.
- First tap on Set 1 Reps still left Set 1 kg focused and no keyboard. A following
  Android Back went Home. Investigate native touch delivery, adapter-position
  guards and focus ownership; do not remove safety guards blindly. The new touch
  handler defers untouched-input events until confirmed ACTION_UP and replays a
  native TextView tap. Check that it actually receives UP and its valid-holder
  condition passes. No temporary diagnostic logs have been added yet.
- New Set Distance whole field starts at 0. First-focus sequential ADB input `1`
  then `2` produced `10` then `120`, not 12. Closed WITHOUT Apply; saved cardio
  distance was not changed. The selection gate avoids late reselection, but the
  setNativeProps selection call did not replace the initial zero. Local RN
  TextInput.js exposes a public setSelection(start,end) command around line 483;
  inspect/use the supported command and retest first-focus replacement and saved
  values. Do not claim the distance bug fixed yet.
- Verify exiting the cardio editor preserves the cardio active row and viewport,
  and tapping a lifting/cardio checkbox activates exactly that row. Restore any
  temporary completion toggle to its original state.
- Visually recheck bottom tabs: marginBottom:6 was added to icons, but screenshot
  showed labels cramped at the lower edge. Increase usable tab-bar height/spacing
  together rather than pushing labels outside their container.
- Timer, routine menu, two-row actions, help Close/back and single separators
  still need final visual acceptance.

Phone draft currently includes Bench Press and Treadmill. User has edited it
since earlier records above (Bench Press first RPE is now 8; completion flags
changed). Treat the current device draft as authoritative; do NOT restore the
older blank-RPE / unchecked baseline. At checkpoint the distance test popup was
closed without applying. Last crash-log cutoff for this build: 10-16 22:48:44.305.
Usage limit reached 3%; work paused at this documented checkpoint, not completed.

## Resumed Verification / October 16, 2026

This section supersedes the failure status in the preceding checkpoint.

- Confirmed by native traces: a Reps tap focused Reps, but RecyclerView layout
  recovery redirected focus to Weight within about 50 ms. Disabled automatic
  RecyclerView focus recovery; the existing exact-field owner handles it instead.
  A first Reps tap then retained Reps focus and opened the numeric keyboard.
- Replaced generic setNativeProps selection with React Native's supported
  TextInput.setSelection command. First-focus, sequential typing produced 1 then
  12, replacing the initial zero. Closed without Apply; no saved distance changed.
- Returning from the cardio editor retained the visible Treadmill row and its
  active highlight, with no stale native input focused.
- Checkbox activation selected the intended lifting row. Restored the temporary
  checkbox toggle. Also separated completion drawing (isActivated) from row
  selection (isSelected), since Android propagates row selection to children.
- Increased notebook tab-bar height with icon spacing; labels no longer clip.
  Visually inspected the notebook routine menu with ruled text actions and Close.
- Removed all temporary native focus diagnostics; synchronized prebuild templates.
  Rebuilt/installed the clean dev APK without uninstalling or clearing data.
- 339 active tests pass (14 existing skips), TypeScript and lint pass, native
  configuration checks pass. No test workout/routine was saved or replaced.

Overall visual acceptance of the timer, action layout, Today's Plan separators
and Set types help remains with the user. Changes remain uncommitted.

## Android Back Policy / October 17, 2026

All application modals now declare an Android Back dismissal handler, including
previously missing Workout, Home, and program-picker handlers. Back uses existing
Close/Cancel cleanup, never Save, Apply, Update or Delete. Back from workout-save
acknowledgment skips the optional routine update and completes the existing close
flow. NotebookModal and WorkoutModalShell require a handler in their types. An
AST regression test scans app, src and components for missing modal handlers.
Existing in-flight-save dismissal guards remain unchanged.

Restored normal icon/label spacing in notebook tabs and moved the extra 8 dp
into bottom padding below labels. Workout already follows the OS color scheme;
an in-app theme selector is not implemented yet.

341 active tests pass (14 existing skips); TypeScript, lint and whitespace checks
pass. On the phone, Android Back closed Adjust Tempo and kept Workout open without
saving. These are JS-only changes; no native rebuild required.
