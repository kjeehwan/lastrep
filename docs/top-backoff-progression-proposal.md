# Top-set and back-off progression proposal

November 25, 2026. Proposed follow-up; no new set roles or progression behavior
are implemented by the guide refinement batch.

Native implementation and current verification status are recorded in
[the native implementation checkpoint](top-backoff-native-implementation.md).

## Current implementation

`src/workouts/workoutLog/workoutLogModel.ts` supports normal, warm-up, failure
and drop sets. `src/workouts/performanceProgression.ts` proposes one load/reps
pair for a uniform exercise. It deliberately declines mixed planned working
sets, special set types and exercises already being recorded. Targets currently
belong to the exercise, with per-set target effort overrides.

## Proposed behavior

- Add explicit Top set and Back-off set choices in the existing set menu.
  Do not infer roles from heavier/lighter weights or rewrite old records.
- Start with one top set followed by one uniform group of back-off sets.
  Keep other arrangements recordable, with an explanation when progression
  cannot be evaluated. Warm-ups remain excluded.
- Evaluate the top set and back-off group separately. The top set's success
  does not prove that the back-off group also qualifies, or vice versa.
  For example, suggest more reps for a qualifying top set while repeating
  back-off sets that exceeded their effort target.
- Each group needs its own target reps and effort, defaulting to exercise
  targets unless explicitly overridden. Keep prescribed effort separate from
  recorded effort, with the existing RPE/RIR preference and validation.
- Compare recent completed sessions with the same role, group set count and
  prescription. Untyped historical sets do not prove role-specific success.
  A changed prescription, missing effort, ambiguous history or a recent load
  reduction must not authorize an unsupported jump.
- Reuse rep steps, available weights, increase limits and recent-performance
  constraints per group. Do not force a fixed percentage relationship between
  top and back-off loads. This first version preserves user-chosen loads rather
  than recalculating back-offs automatically when the top set changes.
- Today's Plan remains the sole progression review. Recovery/context rules may
  hold or reduce a proposal; group qualification does not override today's
  restrictions. Do not increase an exercise once its recording has started.
- Show role-specific reasons and prescriptions in one exercise review. Apply
  and Undo must retain set roles, completed sets and subsequent user edits.

## Implementation boundary and compatibility

Adding menu choices alone is insufficient. Carry roles and group prescriptions
through draft recovery, routine/program save and load, completed history, repeat
workout, decision summaries and Apply/Undo. Replace the current single candidate
with proposals scoped to the relevant sets; avoid applying one group's load to
the whole exercise.

Update client and backend sharing validators, import/export and hosted previews
together. The current sharing contract only accepts the four existing set types;
older recipients may reject plans with new roles. Define rollout/version behavior
before enabling real sharing. Missing roles and overrides must retain legacy
behavior. Review privacy wording and Play declarations against any actual data
contract changes; this proposal adds no analytics or provider transfer.

## Next review

Confirm group targets/defaults and the first supported arrangement, then mock up
the set menu, targets editor and one mixed-result Today's Plan review before
implementation. Verify independent qualification, missing history, recovery
restrictions, load reductions, unit conversion, persistence and sharing round trips.


## Interactive mockup

Open `http://127.0.0.1:4317/index.html#layout-minimal-top-backoff` on the usual
training-notebook review page. The Top / back-off sets state group also opens
set types, grouped targets, a mixed-result review, missing history, recovery
hold and already-recording cases directly.

The exercise retains its existing set table and actions. T and B mark the new
roles; tapping a marker opens the existing style of set-type menu. Targets opens
exercise defaults and optional group overrides, reusing the approved compact
rep/effort editor. Close cancels a staged edit; Done commits it within the mockup.

The synthetic Deadlift example has a top set at 130 kg for 8 reps, target 6-8
at RPE 8, and two back-offs at 110 kg for 8 reps, target 8-10 at RPE 8. Its
previous top set met target effort while back-offs were RPE 9. The review
therefore offers 132.5 kg for 6 reps for the top set and keeps the back-offs.
Changing the back-off effort target can make that group qualify independently.
Select changes per group; Apply preserves other sets, and Undo refuses to
replace subsequent user edits. RIR display follows the existing preference.

The miniature fixture model demonstrates interaction boundaries only. It does
not implement production history windows, rebuild detection, routine/draft
persistence, sharing contracts, full equipment/units handling or medical rules.
The equipment increment is explicitly fixed at 2.5 kg for this fixture. Those
production concerns remain requirements for native implementation.

Verification: 117 browser/model checks passed, including eight new group-scope,
Apply/Undo, warm-up preservation, cancellation/validation and exclusion cases.
Playwright checks confirmed selected-group Apply/Undo, role changes, cancelled
target edits and 140 combinations of seven examples, five viewports, two themes
and normal/200% text without horizontal overflow. Paper and dark/enlarged views
were visually inspected. Synthetic browser-only work; no native account data,
permissions, Firebase deployment or AAB changed.


### Role-edit follow-up

Set-menu labels now use Top, Back-off and Drop. Target summaries and the review
follow the current roles rather than the initial fixture. Normal uses exercise
defaults; absent Top/Back-off overrides are hidden and retained for switching back.
Role changes preserve loads, reps, effort and historical roles, and clear stale
Apply/Undo state. Mixed Normal prescriptions explicitly hold progression and
show their actual differing prescriptions. Uniform Normal prescriptions require
comparable Normal history; previous Top/Back-off records are not relabelled.

Verification: all 120 prototype checks passed. Playwright confirmed shortened
labels, Top-to-Normal and all-Normal target/review changes, hidden inactive
overrides and accurate mixed-prescription display. The resulting review was
visually inspected. This remains a browser-only proposal.
