# Workout layout follow-up

October 28, 2026. Group 2 implements the approved browser layout on the existing
Group 1 branch. Group 3 Settings consistency and Group 4 chart ranges are not
implemented by this change.

## Changes

Equal header gaps, canvas title with pencil selection, planned set/volume summary,
and evenly spaced single-row Demo / time / tempo-or-Zone controls. Rest keeps its
live countdown. The shared exercise renderer also supplies the sharing plan editor,
so it inherits the compact controls and Zone sheet. Other editor behavior remains.
The new input surface option defaults to the existing input token; only Workout's
heading requests canvas. Source routine identity is independent of title edits.

Cardio Zone choices are staged; Done applies, while X/outside/Back cancel. Existing
zone application still preserves completed rows. Planned totals include warm-ups,
ignore completion state, exclude incomplete/invalid load-rep values from volume,
and count cardio separately. No records or backend schemas are changed.

## Verification

- TypeScript, ESLint and web export passed.
- 33 targeted tests passed: planned totals, zone behavior, draft persistence,
  clocks and native notebook contracts.
- Android 16 local demo: 20 kg x 4 warm-up and two 60 kg x 8 working sets plus
  Treadmill produced 3 sets / 1,040 kg volume / 1 cardio exercise. Pencil selected
  the entire existing title: typing replaced it, while the source routine label
  remained unchanged. Native tool bounds showed equal outer and inner gaps.
- Tested light/dark. At 360 dp and 200% system text, title/summary reflowed and
  controls remained visible. Restored the emulator's original 420 density and
  1.0 font scale afterward.
- Native Zone selected 3 and applied; choosing 4 then closing kept 3; selecting
  3 again and tapping Done cleared it. Completed-row preservation is covered by
  the existing zone tests. The connected user's cardio values were not edited.
- Galaxy Android 13: reopened Lastrep Dev on current Metro, checked the new title,
  pencil, actual draft totals and compact controls. No workout/profile entries
  were edited during the phone review. The phone remains on Workout for review.

The sharing editor reuses the changed renderer and passed TypeScript/web checks;
a separate native sharing send/receive review was not repeated for this layout.
No new native dependencies or AAB build are required for the dev review.


## Approved compact refinement

The native header now combines phase and set/volume totals, omits the duplicate
Routine row, and uses the approved six icon-and-label actions below Today's Plan.
Routine association and action handlers are preserved. Empty drafts omit Share
and Discard; larger text uses two columns. Exit builder remains available.

Android 16 local fixture: My routines and Create routine opened their sheets;
Repeat showed its expected no-history feedback; Recommend opened its setup;
Share opened Review workout; Discard opened confirmation and Keep editing kept
the draft. No workout was sent or discarded. At 360 dp / 200% text, the grid
reflowed to two columns and all labels were reachable by scrolling. Restored the
original density/font settings. Galaxy Android 13 showed the new layout with the
existing Back + Biceps draft intact; no user entries were edited.

TypeScript, ESLint and 25 focused totals/draft/zone/contract tests passed. Web export passed.


## Share validation and popup edge follow-up

Cardio stores its zone in the legacy exercise tempo field. The sharing adapter
now excludes that field for cardio rather than submitting a zone as resistance
tempo. Resistance tempo validation remains strict; the active workout is untouched.
A regression test covers a cardio zone with a timed set.

Removed the shared popup's extra 12 dp bottom clearance and the Workout shell's
duplicate safe-area wrapper. NotebookModal retains system/tab/keyboard clearance.
On Galaxy Android 13, Share opened Review workout for the user's existing draft.
My routines, Create routine, Recommend and Discard sheets were checked at the
bottom tab edge and canceled; no routine was applied and no workout sent/discarded.
TypeScript, lint and focused sharing/popup/native-contract tests passed.
