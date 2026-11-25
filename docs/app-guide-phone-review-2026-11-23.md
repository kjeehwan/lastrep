# App guide: complete phone review

Status: user review identified visual-fidelity and interaction-design problems; guide not accepted. Branch `feat/native-guided-onboarding`, based on `9d6f57d`.
The user requested a fresh review of the complete native sequence before another
user review. Earlier emulator interaction checks were not visual acceptance.

## Scope and evidence

Review the welcome, all eight sections, each instruction, section chooser,
completion, Back/Skip/Exit, keyboard and scroll transitions. Use the Galaxy A51
dev package with in-memory practice examples; do not create or alter account
workouts, phases, health records or permissions. Settings replay must not write
onboarding completion. Private captures remain under `.dev-tools/`.

## Problems found in the first phone traversal

- The top bar labels the entire experience as practice but leaves the section
  chooser as an unexplained icon. Its modal is oversized and has no descriptions.
- The lesson and instruction titles have nearly identical weight. The coach uses
  too much space, and its Back/Show me/Skip ordering and Continue placement change
  the apparent primary action. Back is enabled on the very first instruction.
- The imitation bottom tabs look usable but do not navigate. They also take space
  away from forms. There is no clear handoff between sections.
- Rows accumulate scene gaps, row padding and divider margins. Heading sizes
  differ arbitrarily between scenes rather than following main-page/sheet roles.
- The workout example lacks the real date/timer/header structure and set-column
  headers. The guide outlines the entire native table for a single field, and the
  entire action grid for a single action. Some read steps outline large blocks.
- The routine builder inherits the completed workout's load/reps/Done state.
  Saving a named one-exercise routine then selecting a different named,
  three-exercise routine breaks the lesson's continuity.
- The finish-workout example demonstrates reviewing but not saving. It talks
  about feedback controls that are not actually present in the example.
- Program examples offer a seven-day button that cannot change the practice
  cycle, and the schedule explanation is a text wall duplicated across panes.
- The recovery annotation covers the entire ratings group when the instruction
  asks about fatigue. The note instruction conflates a general note with the
  structured additional-activity controls.
- Today's Plan's recovery-edit action jumps to a different lesson rather than
  returning to the review. Fixed example results must be distinguished from a
  fresh review using edited inputs.
- Sleep history presents the same date row twice for different claimed actions;
  selecting a date should reveal a separately labeled session.

## Resulting presentation and sequence

- App guide / Examples only header, explicit Sections action and an eight-section
  chooser with descriptions replace the unexplained sidebar icon. Inactive
  imitation bottom tabs are removed. The narrow phone keeps its content width.
- A compact subordinate section label, progress bar, instruction title and body
  give the coach a consistent hierarchy. Back, outlined Show me and primary
  Continue/Next section stay distinct; the first Back is disabled. Completion
  has one Finish tour action and an optional section replay choice.
- Main scenes use notebook editorial page titles; modal scenes use notebook sheet
  titles and equal-size action pairs. Row padding/dividers and target clearance
  are consistent. Caret anchors, native input/checkbox geometry and individual
  action-grid anchors replace overlarge group outlines.
- Workout logging demonstrates actual set columns, completion, Finish and Save
  workout. The routine follows Start empty → builder → Save routine → name → Save
  and then loads that exact template with its planned sets. Program practice uses
  the real Days −/+ controls, assigns all three days and confirms Start program.
- Recovery highlights the requested rating. Its structured pain/activity controls
  are distinguished from the general note. Editing recovery from Today's Plan
  opens the shared form and returns to review. Fixed example guidance is labeled.
- Nutrition includes local food search, amount confirmation and the actual
  expandable meal item/P/C/F structure. Sleep history separates the date, session
  row and detail. Health practice explains access without granting permissions.

## Behavioral and architecture fixes

Android keyboard avoidance now reserves the coach while entering text. Dialogs
use the measured stage height, scroll inside it and keep their footer reachable;
full-window dialogs outside the guide retain their existing sizing path.

A practice store is owned by effect setup, disposed on cleanup and never reused
after Strict Mode/Fast Refresh cleanup. Account-change guards and late-write
rejection remain. Workout/routine/program field state is kept distinct. The guide
passes a read-only title to the shared workout header to prevent native input
focus transferring into it during table transitions; ordinary callers remain
editable by default.

Examples remain memory-only. No personal workout, routine, program, recovery,
sleep or permission record was created/edited for this audit. Settings replay
skips onboarding-completion writes. No new data collection or transfer requires
a privacy-policy change.

## Validation

- Galaxy A51 / Android 13 dev app: traversed **all 70 steps** on the final runtime
  source using native taps, typing, rating input and scrolling. Captured and
  visually inspected every step, section chooser and completion. Sections contain
  10 workout, 14 routine, 13 program, 5 recovery, 8 Today's Plan, 9 nutrition,
  8 sleep and 3 health steps. Captures stay private under `.dev-tools/`.
- Additional phone checks: Finish returns Home; actual Settings → Support → App
  guide opens the replay welcome; embedded recovery cancellation returns to the
  review; Continue works with the keyboard open; Back retains entered load;
  Show me does not advance; Skip advances a section; Exit returns Home.
- Android 16 emulator: dark/default keyboard entry and section replay/Back/Skip;
  light 150% text entry; 150% text landscape exercise selection, native set inputs,
  scrolling section chooser and Nutrition selection. Inspected representative
  captures. Original font, rotation and night-mode settings restored.
- Final source checks: TypeScript, lint on changed guide/shared controls,
  **991 unit tests passed, 100 skipped**, and web export of **49 routes** passed.
  Ordinary unit tests do not run the Firebase/Storage emulator-dependent suites.
- The emulator's Expo development launcher crashed during repeated activity
  recreation/relaunch while changing display settings (`App react context
  shouldn't be created before`). Restarting only the emulator dev package
  restored testing. This audit does not claim that native launcher problem is
  permanently fixed. The full phone traversal did not encounter that crash.

## Remaining boundaries

User visual acceptance is still pending. Native first-registration completion
and backend retry/account-switch behavior are covered by unit tests/code review,
not a new live-account registration in this audit. The guide's Today’s Plan is a
fixed example, not a new live recommendation. Optional health permission dialogs
are intentionally not invoked. No deployment, release build or Git delivery was
performed. Earlier mockup changes and unrelated application notes remain intact.


## User feedback after the complete traversal

The automated traversal did not establish that the guide matched the experience
of the real app. The user identified different exercise-selection controls, an
ill-fitting note outline, lagging/floating highlights while scrolling, meal times
in the wrong location, an overly reduced Profile and an overall robotic flow.

Corrections in this follow-up:

- Guidance outlines now render inside the target's own native content subtree.
  They scroll/clip with the target instead of following screen coordinates on a
  350 ms timer. Measurement is retained for revealing a target, not rendering its
  outline. The Sleep editor and nested Recovery form use the same mechanism.
- Anything else? uses the input boundary and radius. Its guide wrapper no longer
  includes the input's top margin in the highlighted rectangle. Ordinary form
  layout outside a guide is unchanged.
- Exercise selection uses the active Add exercise screen's left-side add/check
  circle rather than an invented square checkbox; lesson instructions match.
- Nutrition diary times use a separate left column, with meal heading, calories,
  expandable item count and macros to its right.

The Profile lesson remains limited to health sync. It does not yet teach the full
Profile. The broader flow still consists of scripted scenes with some inactive
controls. These are unresolved design limitations, not justified simplifications.
A subsequent redesign should use the actual presentational screen components
with local data and fewer task-level hints; it must not mount account-writing
controllers just to obtain visual fidelity. Do not request another full user
review on the basis that the local defect fixes resolve those limitations.

## Usage-limit savepoint

Stopped before the broader redesign at the user's 2% usage warning. Work remains
uncommitted on `feat/native-guided-onboarding`; no Git delivery was authorized.
Unrelated changes, including production-access notes, are preserved.

Follow-up validation: TypeScript and changed-file lint passed; 28 focused tests
passed. Emulator dark-mode captures verified picker selection, note boundary,
Sleep scrolling and left-column meal times. The phone initially retained an old
bundle after USB reconnection; its first pass was stale and is NOT verification
of the fixes. Fully restarted only the dev package and confirmed the new picker
instruction before rerunning. The fresh Galaxy A51 pass completed all focused
cases and asserted the time is left of the meal heading. Captures are private in
`.dev-tools/guide-audit-attached-highlights-phone-current/` (11 screens).

Reusable guidance now receives outline policy from the onboarding feature; it
does not contain lesson identifiers. Target registration enables Show me for
late-mounted controls. Only reveal operations measure screen coordinates; rings
render inside their target. Phone is left in the expanded example nutrition
diary. No personal records were changed by the practice checks.

Remaining: the user?s overall concern is valid. Profile still shows only health
sync, and the 70-step sequence remains overly scripted with reduced screen
replicas/inactive controls. Do not present these local fixes as resolution of the
whole guide. Next discuss/implement shorter task-level guidance on actual shared
presentational screens with memory-only data. The proposed broader redesign in
`onboarding-native-guided-practice.md` is not implemented. Before Git delivery,
review all intended changes and obtain the existing required authorization.

## November 24: task-based redesign checkpoint

The proposed structural redesign above is now implemented as a candidate; user
acceptance is still pending. Eight optional sections contain 17 task outcomes,
replacing the 70 field-by-field steps. Scene navigation and task progress are
separate. Inputs can be entered in any order, dialogs can be cancelled/reopened,
and program days can be assigned in any order. Revision guards reject stale
callbacks. Show me briefly highlights the actual target; ordinary scrolling has
no floating overlay. New forms open at the top rather than scrolling immediately
to their Save button.

Profile now includes identity, phases, units, body measurements, nutrition/sleep
targets and health sync. Shared Profile controls and the actual PhaseEditor are
used with local values. Done stages changes and Save keeps them in the practice
session; Cancel leaves previous values. Some scenes remain bounded local examples,
not the full account application. TDEE is explained rather than calculated;
health permissions, remote recommendations, sharing and purchases are not executed.
Schedule choices explain their effect without changing the account schedule.

Validation on the Galaxy A51 dev package, light mode/font scale 1.1:

- All eight sections completed using synthetic, memory-only examples. Checked
  workout field order and cancellation, routine continuity, arbitrary program
  assignment order and rest day, recovery and Today's Plan, Lunch, sleep history,
  Profile Cancel/Done/Save, health disclosure and Finish tour returning Home.
- Final focused pass checked Recovery opens with its three ratings visible,
  Show me reveals Save, the shared phase editor opens/closes and Profile Back
  returns Home. The dev app is left at the fresh guide entry.
- TypeScript, changed-file lint, 24 focused tests and web export (49 routes)
  passed. Full suite: 995 passed, 100 skipped. Diff whitespace check passed.

Private captures: `.dev-tools/guide-audit-task-flow-20261124/`. One automated
program run was invalidated by Fast Refresh during development; the remaining
flow was rerun after source changes stopped. A final helper initially looked for
Cancel in PhaseEditor, which uses a header Close control; the corrected check
verified it. Profile's route transition needed time to settle before assertion.

No fresh dark/landscape/iOS or new-account/cloud registration pass was conducted
for this candidate. No personal records or permissions were changed. No new AAB,
deployment, commit, push or PR delivery was performed. All intended changes remain
on `feat/native-guided-onboarding`; unrelated production-access notes are preserved.

## November 24: candidate rejected after user review

The task-based candidate is not accepted. Passing scripted interactions and tests
did not establish that the guide was understandable or faithful to normal use.
Do not ship it or describe it as ready based on those checks.

User-reported problems confirmed by inspection:

- `workout-saved` renders a bespoke "Example saved" page, not the actual
  workout completion flow. The practice finish dialog is also separate from
  the finish dialog in `app/(tabs)/workout/log.tsx`.
- The routines section starts at `workout-tools`; its hint targets Create routine
  but its copy says Add an exercise. The saved-routine hint targets its title
  instead of the My routines action.
- `program-edit` always targets the program-name field, regardless of completed
  inputs or remaining assignments.
- `plan-review` always targets Review context, even after inspection. The applied
  workout repeats the review instruction, creating an apparent loop.
- Profile initially targets a whole header, not an actionable editor. Its section
  requires a saved edit as well as health disclosure, leaving users who only
  inspect health access at 1/2. The disclosure offers only Not now.
- Highlight decoration extends beyond some small caret targets and can be clipped.
  Title/header targeting does not reliably communicate a next action.
- Sleep omits the real trend presentation. Guide chrome and completion pages
  reinforce a separate, incomplete version of the app.

Recommended replacement direction, pending the data-mode decision: optional
contextual tips on the actual tab routes and their existing dialogs, without a
separate App guide header, practice replica routes or compulsory task counters.
Normal Back, cancel, save and completion flows remain owned by each feature.
Tips observe successful actions and existing state, never synthesize saves or
replay writes. Existing records must not require duplicate practice actions.
Health access is optional; declining or dismissing must not block other guidance.
End by dismissing the final tip on the real screen, not a separate completion page.

The actual workout route directly owns drafts, persistence and finish behavior;
the tab layout also schedules account health sync. Mounting actual routes inside
the old temporary guide would not make them safe temporary practice screens.
Clarification requested: guide normal real use with normal saves (recommended),
or retain temporary-only practice requiring explicit data adapters. Until that
decision, no live account writes, permission changes or replacement implementation
are authorized by this checkpoint. Historical candidate code is preserved.

Next verification must inspect every displayed tip/highlight visually at its
actual native target, including after typing, expansion, scrolling, cancellation
and successful completion. Assertions that a target exists or a walkthrough can
finish are insufficient. Verify independent exit/replay and optional health access.


## November 24: real-use guidance implementation

The user explicitly chose "Guide real use; normal saves". The reachable guide now
uses the actual tab routes and feature dialogs with optional in-flow annotations.
Welcome explains normal account writes. The practice URL redirects to replay
Welcome; replica screens, split viewport, counters, Show me outlines and artificial
completion pages are no longer part of the reachable experience. Historical
practice source remains for review/cleanup before Git delivery; it is not the
active guide. See `onboarding-native-guided-practice.md` for the current source map.

Guidance owns topic/dismissal state only. It follows real tabs and remembers the
selected Workout topic when returning from Profile. Feature validation, draft
ownership, persistence, retry and cancellation are unchanged. Cross-topic controls
are omitted inside dialogs and staged-food selection. The normal Profile leave
guard blocks topic switching while edits are unsaved or saving. Account changes
clear the guide, and stale success events are rejected. No new repository,
collection, analytics event or external recommendation request was introduced.

Relevant corrections include routine creation versus workout logging, successful
routine loading, acknowledgment of an available review even without Apply, a
no-change review that does not demand Apply, honest Sleep trends/history, and
optional real health connection without a completion gate. Program instructions
stay stable while typing instead of resizing around the active input. There are
no detached/clipped highlight decorations to chase controls.

Verification:

- Galaxy A51 dev app, light mode/font scale 1.1: real introduction, Home, Workout,
  program editor, Sleep and Profile were inspected without entering/saving test
  records in the user's account. Final entry explicitly discloses normal saves.
- Android 16 emulator/dev package: created a disposable account (private identity
  under ignored `.dev-tools/`). A completed 40 kg x 8 set saved through the normal
  Finish/Save confirmation; Home history showed one workout and 320 kg volume.
  Cancel returned to the intact set before the successful save.
- Saved and applied a real routine; its name and planned set persisted. The
  annotation acknowledged loading instead of repeatedly requesting it.
- Entered a name in the real program editor and opened Day 1 assignment. Full
  program activation was not part of this check. Tested Profile RIR staging,
  blocked topic switching with unsaved edits, then normal Profile Save.
- Saved synthetic recovery ratings through the real form; Today's Plan returned
  Train as planned. The review explained no Apply was required; Back to workout
  showed the successful-review acknowledgment, removing the repeat-review loop.
- Inspected real Nutrition diary/meal and Sleep pages. Their existing food/sleep
  saving commands were not rerun end-to-end in this batch.
- Verified 150% text/landscape annotation and chooser controls after restarting
  guidance following Android's font-setting activity recreation. Restored original
  font scale, rotation and auto-rotation. Existing tab-label wrapping at that size
  is outside this guide change.
- TypeScript and changed-file lint passed. Full suite: 1,002 passed, 100 skipped;
  seven focused guide tests. Web export passed (49 routes), followed by type/lint
  and behavioral tests for final selector/copy refinements. Diff check passed.

Private native captures are in `.dev-tools/guide-audit-live-guide-20261124/` and
`.dev-tools/guide-audit-live-guide-emulator/`. Early helper runs were invalidated by
stale XML during timer animation, cold-start timing, delayed dev reloads, or
portrait-only coordinates after rotation. Those failed assertions are not pass
evidence. Fresh screenshots and explicit current-copy assertions were used for
valid reruns. The initial dynamic program annotation was replaced with stable
copy; final name entry kept focus. Do not infer a production crash from the
invalidated automation runs.

Remaining scope: user design acceptance; applicable-change review, full program
activation, food/sleep save flows under annotations, real permission grants, and
first-registration transaction failure were not freshly tested natively here.
No iOS check, new AAB, deployment or Git delivery was performed. The user's real
records were not edited for test scenarios. Unrelated files remain preserved.


### Follow-up verification (November 24)

- TypeScript and changed-file ESLint passed. Full Vitest: 1,005 passed,
  100 skipped. Focused guide/draft tests: 29 passed, including availability-based
  copy and preservation of a program draft through serialized routine-builder
  switching. A subsequent retry/account-guard edit passed TypeScript and lint.
- Android 16 emulator, disposable account: fresh welcome/first-workout copy,
  direct routine builder, cancel confirmation, save to the real routines store,
  return to choices and Resume with the original 40 kg x 8 prescription intact.
  Saved/cancelled builder did not remain as a resumable routine draft.
- Dark mode at normal and 150% text: panel, topic chooser and close controls
  inspected; ending guidance removed the panel. Font scale restored afterward.
  An initial large-text automation run raced the activity restart; only the
  rerun after startup settled is pass evidence.
- Connected Galaxy A51, light mode: inspected welcome, Home coaching panel and
  Workout choices with its existing draft/program. No test records were saved
  on the user's account. Phone left at the updated Welcome for user review.
- Evidence stays private in `.dev-tools/guide-audit-followup-20261124/` and
  `.dev-tools/guide-audit-followup-phone-20261124/`. The initial resume assertion
  read only visible inputs before scrolling; the corrected native run inspected
  the actual load/reps fields after both save and cancellation.

These are targeted follow-up checks, not a new full tour, production test or
permission-flow verification. Changes remain uncommitted; user acceptance is
pending. No AAB, deployment or Git delivery was performed.


### Second follow-up checks

TypeScript and changed-file ESLint passed. Full Vitest: 1,008 passed, 100 skipped;
focused tests cover missing feedback, `not_used`, distinct progression reasons,
and local dismissal versus ending the guide. Final subsequent edits were wording.

On Android 16 with the disposable account: reviewed Today's Plan, checked a set,
opened Finish, saw the optional question and Didn't use it, and saved with every
feedback option unanswered. Actual Workout saved confirmation appeared. Continue
returned to Home with calendar directions and Explore topics / End guide. The
routine builder displayed Your routine. Dismissing Sleep retained Nutrition tips;
End guide stopped them globally. Screenshots were visually inspected; one idle
dump failed during a running timer, so fresh subsequent screens establish the
finish/save results. Evidence: `.dev-tools/guide-feedback-native/`.

Galaxy A51: read-only check of the updated Dismiss tip control and topic chooser's
End guide; returned to Welcome for review. No personal test records saved.
New enum persistence is covered by feedback serialization tests and optional-save
native verification; a separately selected not_used answer was not freshly saved
natively. No new AAB, deployment or Git delivery. Changes remain uncommitted.


### Topic revision validation

Full Vitest: 1,010 passed, 100 skipped. TypeScript passed. Changed-file lint
passed after removing an unused callback dependency. The Sleep source check first
failed on CRLF introduced during copy editing; restoring LF fixed it without
changing the test or sleep behavior. Route-entry state updates are scheduled,
with choices derived immediately while the entry request is pending.

Android 16 disposable-account checks confirmed: Show me opens Workout choices;
the existing routine draft with Bench Press remains resumable; its resumed tip
explains the template; visiting Sleep does not start a new topic; Back preserves
the standalone routine draft. Profile identity showed the local Done/Save tip;
Sharing showed its workout-send tip. No sharing request or hosted link was created.
One Sharing dump was interrupted; a fresh current-screen capture established the
preview result. Initial pre-fix header/entry assertions are not pass evidence.
Received-program guidance was inspected in code, not freshly exercised natively.

Galaxy A51 read-only review confirmed choices entry and no automatic Sleep tip.
The phone is at Welcome; no personal test records saved. Private captures:
`.dev-tools/guide-topic-native/` and `.dev-tools/guide-audit-topic-phone-20261124/`.
No deployment, AAB or Git delivery; changes remain uncommitted for user review.


### Explicit chooser verification (November 25)

Final full Vitest: 1,014 passed, 100 skipped. TypeScript, changed-file lint and
tracked-file whitespace checks passed. Guide reducer tests cover active-with-no-
selected-topic, account reset and explicit selection; draft tests cover untouched,
named and populated builders; workout-tip tests cover completed and rest days.

Android 16 disposable-account checks: Show me opens the chooser first; the topics
row remains on all five main screens, after dismissal and in unrelated tabs;
explicitly choosing Sleep shows its tip; Finish removes the guide. Closing the
initial chooser does not automatically reopen it when returning to Home.
Untouched builders return without discard confirmation and have no Resume entry.
Populated builders remain resumable and show a destructive Discard routine draft
confirmation; Keep editing retains them. A native check caught a current-summary
projection missing exercises, now corrected. A picker automation run depended on
an exact scrolled-off exercise name; the final populated-draft check used a visible
catalog exercise. Do not treat those failed helpers as successful app checks.

Galaxy A51: chooser first, topic navigation after dismissal/tab change, and Finish
were checked without personal record edits. Header and Finish are fixed outside
the chooser's scrolling topic list. An initial phone XML snapshot preceded modal
mounting; the subsequent fresh snapshot and tap verified the visible footer.
Completed-day wording is unit-tested against the displayed occurrence flags;
this batch did not mutate a personal program to manufacture a completion state.

Evidence stays private in `.dev-tools/guide-chooser-native/` and
`.dev-tools/guide-audit-chooser-phone-20261124/`. Phone left at Welcome. No AAB,
deployment or Git delivery. Changes remain uncommitted for user acceptance.
