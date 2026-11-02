# Unified Today's Plan — browser review

October 29, 2026. Proposed design, not native behavior. Replaces the proposed
standalone per-exercise Progress action; previous progression studies remain
available as historical design examples.

## Purpose and screen changes

Today's Plan answers what to train and how to approach it today. Performance
progression is part of that review, constrained by today's inputs and explicit
exercise preferences. Positive readiness alone never justifies an increase.

Workout shows a compact seven-day strip only with a program enabled. Numbers
identify cycle days; the accent identifies today's scheduled day. A checkmark
replaces the number when completed. Rest and skipped states are described in the
day preview and accessible labels; the squares contain no secondary text.
The strip shows the program week from its start date, separately from training
and diet phase weeks. The program name is editable in its popup; its pencil
focuses and selects the current title.
Tap a day to preview it without changing the schedule or active workout. When
disabled, a quiet Program / Off entry allows re-enabling without showing the strip.

Each day is assigned a saved routine by stable ID, or marked Rest. Routine names
are presentation text, not matching keys. The picker includes duplicate-name
Chest + Triceps fixtures with different exercises and IDs. Selecting a new
assignment is staged until Save assignment, and does not replace the open draft.
Assignments also update the normal template for future cycles. A completed
occurrence keeps its original routine and checkmark; edits affect its future
cycles, with the new assignment shown separately in the preview.

The existing editable title, phase, exercise log and six workout actions remain.
One Today's Plan entry opens the contextual review. The i button sits beside the
title. There is no separate Progress button on each exercise. Targets, equipment
weights and progression preferences remain accessible through exercise options.

A review leads with one concise result. Changed exercises have selection controls,
before/after prescriptions on one row at normal text size, and expandable reasons.
Checkboxes are centered in the entry; each entry has equal top/bottom padding.
Unchanged exercises collapse below a separator. The disclosure uses the same
right-chevron path, rotated down when expanded. Review context describes context
and data sources; tapping an exercise explains its particular prescription.
The context row has symmetric padding and a single bottom separator, equally
spaced from the button above it and the footer action below it. At enlarged text
sizes, prescriptions may wrap rather than shrink or clip.
Apply selected changes and guarded Undo are explicit. A valid result is Keep your
plan. Declined changes are not immediately offered again within this study session.

## Agreed behavior represented

| Situation | Proposed behavior |
| --- | --- |
| Empty workout, active program | Preview the scheduled routine, load only by confirmation, then review its prescriptions. |
| Empty workout, no program | Choose a saved routine; no order or schedule is inferred. Existing Recommend remains available. |
| Rest or skipped day | Keep the day visible; do not automatically create a workout or shift future sessions. |
| Another workout open | Review that draft. Show the scheduled routine as context without replacement. |
| Workout in progress | Protect completed sets and any set with recorded effort. Review only untouched working sets; current effort above target blocks further progression for that exercise in the example. |
| Missing today's inputs | Show the last input date and open the complete Recovery check-in used by Home, prefilled from the saved browser draft where available. All three ratings, detailed discomfort, activity and daily note are present. Missing answers do not mean none. Save returns to the review; Cancel preserves saved answers. |
| Pain/discomfort | Show the affected exercise for manual review; no automatic progression of it. Positive readiness does not clear it. |
| Recent load reset | Exclude heavier results from before the reduction; use the rebuilding baseline. |
| Suggested deload | Show evidence, start/end, affected prescriptions and preserved program before acceptance. Week number alone is insufficient. |
| Return after deload | Review the preserved normal prescription; do not add an automatic load increase. |
| Manual edits | Invalidate a previous review. Re-review the current draft without automatically undoing the user's prescription. |

Schedule editing offers Skip, Move to a rest day, and Swap. Each previews affected
days and preserves every other day. It never silently replaces the open workout.
Shift is a separate, explicit choice for a missed current session. Its
dated preview shifts that session, every subsequent workout and rest day, and the
next cycle one day forward while preserving routine order. Applying it leaves
today paused and the open workout unchanged. The program week still reflects
elapsed time since starting; a one-day pause does not reset it.
The study edits the visible cycle. Native edits should be dated occurrence
overrides, not changes to the repeating routine template; future cycles should
retain the normal program unless the user deliberately edits that program.
The exception is the explicitly requested schedule shift, which offsets future
occurrence dates without rewriting the routine sequence. Shift cannot
be applied repeatedly on the same paused date in the study.
The proposed calendar is date anchored. Native backlog carry-forward needs an
explicit migration decision; this mockup does not change existing program data.

The synthetic deload lasts Oct 29–Nov 4. Three working sets become two, with a
target RPE of 7 or easier; the normal prescription remains in memory for Undo.
The return fixture illustrates Nov 5 behavior conceptually, rather than advancing
the host computer clock. Neither fixture establishes a clinical recommendation
or implements a production week-long scheduling engine.

## Existing implementation inspected

- `src/workouts/workoutLog/useWorkoutTodayPlan.ts`: review loads context and calls
  the local deterministic engine. It does not currently call OpenAI. It stores a
  result in account data. The browser study makes no corresponding calls.
- `src/workouts/workoutLog/WorkoutTodayPlan.tsx`: grouped exercise changes,
  expandable reasons, inputs, stale/applied states, and a single Apply action.
  Selective acceptance is a proposed addition.
- `app/(tabs)/workout/log.tsx`: guidance uses the open draft plus available weights.
  It detects changed drafts/dates, applies adjustments and retains before/after
  snapshots for guarded Undo. An empty log supplies source `none`.
- `src/services/decision/todayPlanEngine.ts`: pain/activity/recovery adjustments,
  readiness-only empty state and rest-day handling already exist. Increases use
  phase/readiness/performance rules, not the newly agreed target graduation,
  preferred/max increase and post-reduction history rules.
- `src/services/decision/todayPlanContext.ts`: performance summary looks at the
  latest three name-matched sessions within 42 days. It does not yet enforce the
  agreed equipment, working-set-count, mixed-prescription or reset boundary rules.
  Its aggregate/top-set metrics cannot establish all sets met a target.
- `src/services/decision/loadWorkoutPlanContext.ts`: phase types and nutrition are
  loaded; phase week counts and program scheduling are absent from this context.
  Recovery values are persisted without a date and have fallback defaults. Fresh
  versus missing inputs needs an explicit model, not just new copy.
- `src/types/decision.ts`: planned exercises do not currently include the new
  exercise targets/progression preferences in this decision payload.
- `src/profile/phaseState.ts`: custom phase names and week anchors already exist.
  Reuse `phaseName` and `currentPhaseWeek` for context, including user-edited week
  bases, rather than infer weeks from an unrelated start date or the display name.
- `src/services/decision/todayPlanDraft.ts`: skips done and warm-up sets, but does
  not also protect unfinished sets with recorded effort. Proposed protection must
  cover those rows before applying any new prescription.
- `src/workouts/program.ts` and `app/(tabs)/workout/program.tsx`: a seven-day
  active program, start date, routine references and rest days already exist.
  Calendar generation currently queues missed sessions forward. Fixed dates with
  explicit moves are a real proposed behavior change, not existing functionality.

## Review and limits

Open `http://127.0.0.1:4317/index.html#layout-minimal-today-planned`.
Use the Unified Today's Plan group for empty/rest/off, unchanged, recording,
pain, missing inputs, load reset, deload, return and different-draft examples.
All exercise histories, dates, check-ins and recommendations are synthetic.
This is not a production algorithm, phone check, backend migration or deployment.
Nothing is written to the user's account. Schedule/program/selection changes are
in-memory and reset with the example.

The Home and Workout browser check-ins now share the same detailed discomfort
renderer, full form and validation. The earlier partial missing-input screen was
a fixture shortcut, not detection that the omitted answers had been recorded on
Home. It has been removed. Saved synthetic check-ins retain their fields in this
browser tab. Canceled edits do not modify saved answers. Recovery values are
also synchronized into the example's pain/soreness/fatigue guards when loaded
from Home. This aligns the study with the richer native context fields; it does
not change native code or establish a production input-freshness model.

October 30 feedback verification: title editing, elapsed program week, number-only
and checkmark-only squares, stable-ID duplicate-name selection, staged and future
assignments, explicit skip/resume dates, unchanged open workout, row geometry,
disclosure/divider spacing, detailed missing-input validation and Home reuse/cancel
passed. Layout checks cover 240 main combinations and 48 supplementary sheets.

## October 30 follow-up

- Change schedule uses Skip / Move / Swap / Shift in one row at default text
  sizes. The Shift preview retains the explicit resume-tomorrow meaning.
  Enlarged text may reflow to two columns to avoid clipping.
- Only the switch control toggles Use program; its text and surrounding row do
  not. The control retains a 44-high hit area.
- Program days and routines are grouped into gap-free lists with symmetric
  16-top/16-bottom content padding and separators between rows. This rule was
  added to the shared design specification; exceptions must be explicit.
- The exercise disclosure chevron is centered against the whole compact entry,
  rather than against the title line alone. Review context is restored as the
  context-view label, separate from each exercise's expandable reason.
- Today’s Plan now opens Recovery check-in, using the exact same full renderer
  as Home. Editing is available from Review context even when inputs are present.

The current native engine combines sleep, soreness, fatigue and motivation into
readiness (30%, 30%, 30%, 10%), then applies separate pain/movement, additional
activity, recent effort, muscle overlap and nutrition rules. Those native rules
still have their earlier progression heuristics. The agreed unified replacement
will establish a candidate from comparable completed working sets and exercise
targets/preferences, then constrain it with current-day context. Positive
readiness alone is not progression evidence.

The browser study demonstrates high-soreness/high-fatigue holds and affected
exercise review for discomfort. It does not implement the full native readiness
engine or interpret free-text activity and notes into prescriptions. Native
activity decisions use structured type/effort/duration/context fields; free-form
notes are not currently interpreted by its deterministic rules. Phase weeks and
deloads remain explicitly synthetic review examples pending native integration.

Follow-up checks cover toggle-only activation, equal row geometry, one-row
schedule choices, centered disclosure icons, matching complete Home/Workout
forms, shared saved values, staged Cancel and Save, soreness holds, and pain
detail validation, across 80 supplementary layout combinations.

Before native implementation, approve the flow, define an explicit input freshness
model and canonical prescription/review payload, retain per-set history rather
than infer graduation from averages, and replace the competing progression paths
with one shared engine. Keep clinical clearance outside this feature's claims.
# October 31 review: first-time setup and context

Follow-up: discomfort review headings now depend on actual flagged exercises,
not simply whether any discomfort was reported. A no-match result explicitly
states that no exercises were flagged by the mockup and does not establish
suitability. Shoulder discomfort lists the flagged pressing/fly exercises with
expandable reasons; manual-review-only results do not show an empty Apply
action. Manual flags also take priority over keep-plan fixture shortcuts and
cannot be removed by declining a progression suggestion. Region matching is
still a synthetic name-based heuristic, not a validated movement assessment.

Proposed Workout entry states: an unfinished draft takes priority; otherwise a
new user sees Start workout and optional Create program. A returning program
user sees their program day and a primary Start today's workout action, with a
secondary Start a different workout option. Create program can select existing
routines or create routines during setup. Do not present a mandatory chooser on
every visit or automatically load/replace a workout. Program users retain the
program strip and schedule controls; free workouts retain the same exercise
editor and Today's Plan review without an invented program day. This entry flow is now implemented as an in-memory browser study; see the
Workout entry review below.

The populated seven-day program and named routines are synthetic review examples,
not a proposed default for new accounts. Recommend no active program or generated
routines at signup. Offer optional Create program, with configurable days and
explicit Rest or Unassigned choices. Allow saving an incomplete program draft;
an unassigned day must ask for a routine rather than inventing a workout. Let the
assignment picker select a saved routine or create one without requiring users
to prepare every routine first. Resolve assignments by stable routine ID.
This first-time creation flow remains a native implementation requirement. The
new-user browser example now demonstrates it with an in-memory program builder
and the shared workout exercise editor for routine creation; populated examples retain their fixtures.

Inspection found native program writes only on an explicit program save. Its
create mode omits template titles and exercises; a non-create screen without a
saved program can display a sample template. Neither is evidence of automatic
routine creation at signup.

Program title/caret hit areas now stay bounded to their content and a minimum
44 px touch height. The gap and read-only week indicator do not open Program.
The shared design specification records this rule.

Review context uses regular-weight entry text, separate Recovery check-in,
Recent performance and Training context sections, compact recovery ratings and
an outlined Edit recovery check-in action with a right caret. Home and Workout
reuse the same check-in fields and saved same-tab session data. Direct Home
check-in entry now initializes its draft too, so note-only edits save correctly.
Browser checks cover saves in both directions and cancellation. No native or
account-backed synchronization changes were made in this review.


## Workout entry review (October 31)

New browser states: `layout-minimal-today-entry` (active program),
`layout-minimal-today-newuser` (no program or routines), and
`layout-minimal-today-resume` (unfinished workout). The entry page offers
Continue program, Create program and Start workout as applicable, with Resume
workout first when a draft exists. The Workout header's Back button reopens this page from the
editor. Outside-program workouts hide the program strip and do not change
program dates, assignments or completion.

Create program starts with a blank name and unassigned days, with a 1-14 day
cycle selector. Each day can select an existing routine by ID, be Rest, remain
unassigned while drafting, or create a local routine. Routine creation now reuses the browser Workout exercise editor, including
sets, weights, targets, warm-ups, rest and tempo. Native implementation should
likewise reuse its actual routine editor. Save for later preserves
the current active program. Starting requires a name, at least one routine and
no unassigned days, then explicitly activates the new program.

The browser can keep an unfinished workout while opening a second workout.
Saved/current drafts can be resumed or swapped from the entry choices; a guard
prevents silently overwriting either with a third workout. Program and workout
drafts are in memory only and reset when another review example is selected or
the page reloads. Previous programs and saved-for-later drafts are now available through My
programs on the entry page, including explicit activation and confirmed deletion.

Browser checks exercised the three entry states, cancel/save/activation, empty
new-user routines, creating and assigning a routine, loading it into the editor,
program schedule preservation, unfinished-workout resumption and 48 combinations
of viewport, theme and text size.

## November 2: navigation, routine picker and program library

Removed the in-content Workout choices action and Outside your program label.
The existing Workout header Back control returns to the entry choices, while
the exercise picker Back control still returns to the editor. Add exercise now
uses the native workout screen's actual secondary button label and style values.
Routine assignment choices are plain rows without boxed or separator borders.

My programs sits below the three entry choices. It lists programs by stable ID
with Active, Saved program or Saved for later status. Creating a program always
starts a separate setup; saved drafts reopen through My programs. Save for later
preserves the active program. Starting another program retains previous programs
and their schedules, allowing a saved program to resume its prior day and week.

Each program detail has Delete program with a confirmation. Deleting the active
program stops its schedule and removes Continue program; routines and unfinished
workouts stay available. Drafts can also be deleted. No account or backend data
is changed: the library remains synthetic, in-memory browser state.

Checks cover navigation, exact Add exercise style values, borderless routine
choices, multiple programs/drafts, activation/restoration, deletion cancellation
and preservation of the unfinished workout, plus 64 popup/layout combinations.

November 2 follow-up: My programs now uses the same full-width choice row,
label/detail typography, caret and symmetric 20 px divider spacing as the other
entry choices. Program details show each assigned routine's exercise summary,
resolved by routine ID using the same records as the assignment picker. Rest
and unassigned days do not invent exercise details. Locally created routines
now keep their selected exercise names in that summary too.

## November 2: library order, resume dates and shared routine editor

My programs sorts the active program first, drafts saved for later second, and
other programs last, alphabetically within each group. An inactive previously
started program offers Resume program; the active one offers Continue program.
A never-started setup still requires explicit Start program.

Resume program previews the first unfinished/unskipped saved day starting today
and subsequent dates in normal routine order. Resume today commits that change;
Cancel preserves both programs and the open workout. The gap is not converted
into missed workout records. Completed occurrences retain their original dates
and history. If the saved cycle is complete, the preview begins the next cycle
at Day 1 and retains the completed cycle in history. Program start date is not
reset; its week indicator remains elapsed weeks since the original start, as
previously defined, separately from phase weeks.

A Resume a saved program example uses November 2 as its synthetic today. Its
previous program stopped before Day 4 on October 15; Days 1-3 retain October
12-14 dates after resuming Day 4 on November 2.

Creating a routine from day assignment now opens the same browser Workout
exercise editor instead of an exercise checklist. It retains the normal Add
exercise picker, set controls, warm-ups, targets, rest, tempo and exercise menu.
The program setup and current workout are held separately. Save routine stores
the actual planned sets and targets and assigns the new routine to the selected
day; loading the routine uses those prescriptions, not generated example values.
Back permits canceling the routine draft while restoring the prior workout and
program assignment. Recorded effort, completion marks and Last-column fixture
history are not saved as part of the new routine prescription.

Checks cover ordering, resume preview/cancel/confirmation, repeated resumes,
completed-date preservation, cycle rollover, the shared editor and target
preservation through save/load, cancellation and original-workout preservation,
and 16 responsive resume layouts. All state remains synthetic and in memory.

## November 2: routine actions and restarting a program

Create routine in the day-assignment picker is now a separate outlined action
with a plus, rather than another plain routine row. Routine builder places Save
routine directly below Add exercise, for empty and populated builders; the
header no longer repeats Save. The shared editor, validation and cancellation
behavior are retained.

Previously started programs offer Restart program beneath their normal
Continue/Resume action. Confirmation explains that Day 1 starts today and that
the following days are scheduled from today. Cancel leaves the active program
and workout unchanged. Restart today archives the previous run, including
completed occurrences and original dates, resets program progress and the
program start date to today, and uses the normal routine assignments. Training
and diet phases, routines and recorded workouts are not reset. An unfinished
workout is kept through the existing draft-preservation flow.

Program details expose Previous runs after restart. This read-only popup shows
archived run dates and completed program days, including completed history from
earlier cycles. Repeated restarts append runs without modifying earlier archives.
All of this remains synthetic browser state, not account-backed program history.

Checks cover restart confirmation/cancel, Day 1 and program-week reset, preserved
completed dates and prior-run archives, repeated restarts, unfinished workouts,
the differentiated Create routine action and Save placement, plus 16 responsive
restart-dialog combinations and the existing program/routine regression checks.

## Final approved rules before native implementation

Finishing and successfully saving a program-linked workout completes its assigned
program day. Finishing a separate workout leaves program progress unchanged. A
missed program day remains pending until explicitly skipped or shifted. These
are approved implementation requirements; the browser study does not establish
that finishing workouts implements them.

Rust accent intentionally emphasizes the primary entry choice: Resume workout
when a draft exists, otherwise Continue program when active, otherwise Start
workout. Other entry choices are neutral. Program-detail Restart program and
Back to programs are neutral; borderless Delete program uses danger red and
retains confirmation. Rust and danger are different semantic tokens even if
their paper-theme hues appear similar.

The consolidated current requirements are in training-notebook-design.md,
version 1.48, under Workout programs and unified Today's Plan. Historical
standalone Progress examples do not override that approved direction.
