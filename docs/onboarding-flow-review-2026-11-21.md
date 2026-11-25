# Lastrep onboarding review and proposed flow

Reviewed November 21, 2026, against main `9d6f57d`. Proposal only: no app behavior,
account, onboarding progress or permissions were changed.

## Current flow

After registration, users see Experience, Availability, optional Nickname and
Optional health sync. Back retains answers; Skip advances one step. Each step
saves account-scoped progress, and the final step completes setup and opens Home.
Health sync is informational here; it does not connect services or request access.

The current flow explains setup more than actual use. It does not teach users
how to record a set, distinguish a workout from a routine or program, or find
Today's Plan. Home already has a dismissible Get Started card with Create routine
and Start workout shortcuts when no saved workout exists. It does not need a
second competing checklist.

Experience is saved by onboarding, but the inspection found no active consumer
outside onboarding. Availability is saved and editable in Profile; the current
program builder starts with empty days rather than generating a program from
that answer. Nickname is also editable in Profile. These questions do not need
to delay the first workout.

## Recommended introduction

Replace the four setup screens with three short, skippable teaching screens.
Keep production branding, notebook typography and one useful visual per screen.
Use small examples drawn from the real interface, clearly presented as examples;
do not add sample workouts to the user's account.

| Screen | Suggested copy | Visual |
| --- | --- | --- |
| Log your workout | Add exercises, enter weight and reps, then mark each set done. Previous performance appears in Last when available. | One resistance exercise with Last, weight, reps and Done visibly identified. |
| Build your training | Save exercises as a routine. Arrange routines and rest days into a program when you want a schedule. | A routine linked to a short program strip, including a rest day. |
| See the bigger picture | Home brings your training and progress together. Record nutrition and sleep in their tabs, and use Profile for preferences and optional health sync. | The real tab order with short labels; avoid a dense dashboard screenshot. |

Use Next and Back, plus Skip intro that completes the introduction and opens
Home from any screen. On the final screen, offer Start workout as the primary
action and Explore Home as the secondary action. Start workout opens the existing
Workout entry flow. It does not start a timer, create exercises or assign a
program automatically.

The first screen is where we demonstrate the fundamental task. The second
explains the reusable structure without making a program mandatory. The third
shows where other information belongs without teaching every feature at once.

## Help during actual use

Keep detailed guidance close to the task rather than adding more intro pages:

- First empty workout: a dismissible hint beside Add exercise. After exercises
  are added, explain weight/reps and Done without covering inputs or gestures.
- Routines and programs: concise empty-state guidance explaining that a routine
  can be used on its own and a program assigns routines to days. Reuse the current
  create/assign flows; do not require users to build a program before logging.
- Today's Plan: explain it beside the action when there is a planned workout:
  review possible changes using recovery and recent performance before applying.
  Do not present invented history or guaranteed personalized output for a new user.

Reuse Home's existing Get Started card rather than adding another onboarding
panel there. Allow the three-screen introduction to be reopened from Settings
under Support, using the established row design. Replaying it is help viewing,
not a reset of account setup or workout data.

## Profile questions and health sync

Remove Experience from required introduction screens; retain existing stored
values. Keep Availability and Nickname in Profile, where they are already
editable. Do not add another profile questionnaire at the end of the introduction.

The health introduction should say connection is optional and available in
Profile. Keep the detailed data-use explanation and actual consent/permission
flow at connection time. Removing the informational intro page must not remove
or bypass those controls.

## Implementation boundaries after design approval

- Preserve existing account fields, drafts, routines, programs and health choices.
- Completed accounts should not be forced through the new introduction.
- Handle accounts paused on any old onboarding step and old route links. Use an
  explicit compatibility mapping; do not reinterpret experience or availability
  values as tutorial completion.
- Retain account-scoped completion, sign-out cleanup, save failure/retry and
  stale-request protection. Skip intro must not report completion after a failed
  required save. Reopening help must not write or reset onboarding progress.
- Store contextual-hint dismissals per account. Do not show them on every exercise
  or every app launch. They must remain optional and avoid taking focus from
  logging. Decide how existing users can dismiss/reopen help without a forced tour.
- Update the design specification when the replacement flow is approved; its
  current four-step rules remain historical guidance, not approval for this proposal.

## Recommended next step

Review a mockup of the three screens and the first-workout hint together before
native implementation. Show light/dark mode, narrow width, larger text, Skip intro,
and reopening help. Do not bundle Terms of Use drafting into this UI change.

This review was code inspection. No new emulator or phone checks were run, and
no proposal was added to the user-maintained feedback log as an implemented fix.

## Implementation evidence

- `src/onboarding/OnboardingScreen.tsx`: current screen content and navigation.
- `components/OnboardingLayout.tsx`: fixed four-step progress and shared layout.
- `src/onboarding/onboardingState.ts`, `onboardingService.ts` and
  `OnboardingProvider.tsx`: field writes, account-scoped cache and retry behavior.
- `app/(tabs)/home.tsx`: existing Get Started visibility and actions.
- `app/(tabs)/profile/index.tsx`: editable nickname and availability.
- `src/workouts/WorkoutProgramPanel.tsx`: current empty program creation.
- `docs/onboarding-notebook-migration.md` and section 23 of
  `docs/training-notebook-design.md`: earlier approved flow and constraints.

The unused sample-program helper and older onboarding suggestion document were
not treated as evidence of current user behavior.

## November 21 browser mockup

The proposal is available on the usual local study page,
`http://127.0.0.1:4317/onboarding.html`. The original questionnaire study is
preserved at `onboarding-setup.html`; the app remains unchanged.

The interactive example includes all three introduction screens, Skip intro,
Start workout/Explore Home, the existing Home-style starting actions, empty
Workout guidance, an exercise picker, editable practice sets, a dismissible
logging hint and an explanation beside Today's Plan. Settings replays the intro
without resetting the practice workout. Other feature sheets are explanatory
examples, not full implementations of routine/program creation or health sync.

Browser interaction checks covered Back preserving the example checkbox,
program-day previews, tab descriptions, picker cancellation, set entry and Done,
adding a set, popup Escape/Close and replay returning to Settings with workout
values intact. Layout checks covered eight states, four viewports, both themes
and default/200% text (128 combinations), checking horizontal overflow and
44-px button geometry. Compact program examples wrap to preserve touch targets.
Light screenshots and a dark enlarged-text screenshot were inspected. Native
keyboard, permissions and account completion/retry are not implemented or
verified by this mockup. No sample records are stored outside page memory.

## Guided practice revision after introduction feedback

The user found the separate introduction screens unclear and visually too far
from Lastrep. The current `onboarding.html` replaces that candidate with small
anchored guidance popups over the existing complete browser screen studies.
The prior candidate is retained at `onboarding-introduction.html`, rather than
being treated as the approved native direction.

Eight optional sections teach logging, routines, programs, recovery editing,
Today's Plan, Nutrition, Sleep and optional Health Connect. A static target
outline identifies each control. Show me demonstrates its location briefly;
the user performs the action. Input steps wait for Continue. Each section can
be skipped or restarted, and the tour can be exited. Reduced motion avoids the
moving indicator. This is a proposal for review, not a mandatory 57-step signup.

The sections use separate synthetic scenarios. Some steps switch to a saved-plan
example rather than persisting the plan created in the preceding scene. Today's
Plan uses deterministic example history and recovery, not a live recommendation
service. Health Connect ends at a simulated disclosure. Existing screen-study
session-storage check-in/preferences are snapshotted and restored on Exit or
page departure; no account or health records are touched.

All 57 steps advanced successfully in browser interaction checks. Guidance and
target bounds were checked at every default-phone step and at the initial step
of each section across four viewports, two themes and two text sizes (128 initial
layouts), with no target overlap found. Actual pointer interaction checked the
Nutrition sequence and initial Workout action in addition to scripted DOM
interactions. Light and dark enlarged-text screenshots were inspected. Native
keyboard, screen reader behavior, completion persistence and old-account route
compatibility remain outside this browser mockup and require native work after
design approval.

### Guided-practice review corrections

- Highlight outlines coincide with existing control edges, without an outer halo.
- Section headers use a progress bar. Show me is outlined, Skip is a separate
  text action, and the redundant highlighted-control instruction is removed.
- Popup placement protects the whole dialog and explicitly relevant adjacent
  actions, rather than only a highlighted title. When needed, the study viewport
  makes room below (or beside in landscape) for guidance. Explanations remain
  independently scrollable, with no guidance laid over them.
- The routine-save step keeps Add exercise visible and explains that the routine
  may contain more exercises.
- Guided practice prevents unrelated clicks from changing its example state.
  Exit opens Home for free exploration. This restriction is scoped to the
  synthetic tour; native onboarding must never strand real drafts or health
  permission flows when a user leaves guidance.
- Pending transitions are canceled on restart, section change and exit, with
  generation/step checks protecting against late events. Finish tour loads fresh
  Home and closes the health disclosure; it does not grant simulated access.

Verification: 57 steps completed and 285 per-step layouts checked (all four
viewports in light/default text and standard phone in dark/enlarged text).
No overlaps with protected dialogs/actions or popup-boundary overflow were found.
Actual pointer checks covered the program routine picker, Today's Plan expanded
explanation and context, an unrelated action, and Finish tour returning to Home
with no dialog. A section change during a pending action preserved the new first
step. Screenshots of the reported explanation/context, routine-save and program
picker states were inspected. This remains browser-only work.

### Second guided-practice review corrections

The brief Welcome is restored as the entry state and a sidebar option. Back
returns to the prior step; from a section's first step it opens the previous
section, with Welcome before workout logging. It reconstructs synthetic state
and retains entered values, rather than attempting to undo real records. Replay
jobs are canceled on section change/exit, and the study is inert during replay.

Highlights use rounded corners when the target has no radius; existing control
radii remain unchanged. Checkbox highlights follow the inner visual checkbox,
not its larger touch target. Confirmation toasts are shown as inline status in
the guidance, preventing them from covering the next highlighted control.

The short workout-save review can overlay optional recommendation-feedback
questions while keeping its title, completed-set/volume summary and save actions
clear. Complex forms, including Recovery, retain reserved guidance space. The
older study's routine-save dialog is corrected to show template information and
planned sets rather than workout completion and recommendation feedback; the
tour now performs its simulated Save and shows Routine saved.

Program practice uses a complete three-day example rather than an unfinished
seven-day program. The user selects three days, assigns all three, starts the
program, selects Day 2 and opens Change schedule. The guide explains longer
cycles and save-for-later, and leaves the example schedule unchanged.

All 62 revised steps and 310 per-step layouts passed browser checks, including
protected-content bounds and the absence of overlaying confirmation toasts.
Back preserved an entered weight and restored routine-save/Today's Plan states.
Screenshots of Welcome, checkbox alignment, save review, routine confirmation,
schedule controls and Nutrition/Sleep status were inspected. Eight existing
study model tests passed. A transient local module-load failure was observed;
loading now retries once and exposes Restart/Exit on failure. Native onboarding
and account data remain unchanged.

The Recovery confirmation review also exposed a target partly behind the bottom
tabs after the inline status resized the available screen. Target reveal now
uses the actual scroll viewport bounds after that resize. A final pass through
all 62 steps found no clipped targets that fit within their scroll viewport;
the corrected Recovery screenshot was inspected separately.

### Third guided-practice review corrections

Welcome now overlays full-height Home. Borderless action targets have an 8-px
horizontal inset, and checkbox emphasis uses its actual border plus an inset
stroke to avoid an overlapping darker edge. The older study's automatic Close
focus is redirected to the guided action, preserving keyboard focus styling
without presenting two accent targets.

Back still reconstructs only synthetic state, but intermediate iframe renders
are concealed until the destination has been laid out; the practice remains
inert while this runs. This is a short loading state, not native instant undo.

The program practice selects its pending Day 1 before opening schedule controls.
The older study's Shift label is corrected to Tomorrow, as verified against
`src/workouts/WorkoutProgramPanel.tsx`. The final Today's Plan action opens
View changes; sleep practice selects a recorded night and opens its session
details. Both now require actual taps followed by readable detail screens.

Verification completed all 65 steps, plus actual pointer checks for the new
plan and sleep actions and Back restoration. Welcome, checkbox and inset action
screenshots were inspected. Eight existing study tests passed. The earlier
310-layout pass was not repeated for this revision. Native screens are unchanged.

## November 23: systematic highlight and completion review

The previous target-only padding workaround shifted highlighted rows relative
to neighbours and did not cover every target type. It is removed. Annotation
geometry now measures visible text and reserves 8 px inside the two-pixel stroke,
without changing row padding. Existing control boundaries are retained when
adequately padded; if expansion is required, the original control border/focus
outline is suppressed only while the annotation supplies its visible boundary.
Checkboxes keep a compact stroke. This includes headers, program assignments,
recovery links, plan actions, sleep records and health-sync labels.

The routine builder now saves in one tap, with no duplicate confirmation. The
tour goes through routine selection, preview and Load workout, then scrolls to
the loaded exercise and sets. The older applied-plan popup's confirmation-only
content is replaced with a snapshot of selected before/after prescriptions.
Schedule help defines Skip, Move, Swap and Tomorrow separately.

Verification completed 66 steps and a text-clearance audit across 330 layouts
(four viewports in light/default text and standard phone in dark/enlarged text),
with no clearance below 8 px found. This checks text ranges and input estimates,
not merely highlight/target overlap. Three geometry and eight existing model
tests passed. Browser verification confirmed Chest + Triceps loads three
exercises and the applied review lists Bench press and Cable fly with their
before/after prescriptions. Representative row, program-day, loaded-routine
and applied-change screenshots were inspected. Final visual review revealed
Close retaining a second focus outline in read dialogs; the focus rule now
covers those dialogs too. Native application screens remain unchanged.

### Caret emphasis and breakfast fixture

Rows with navigation carets now highlight the caret, while retaining the full
row as the action target. The demonstration indicator points to the same caret.
Rows without carets keep their existing padded highlight; checkboxes retain
their compact border. This changes guidance only, not row alignment or hit areas.

The onboarding Nutrition URL supplies `practice=onboarding`, selecting 08:30
as its synthetic logging time. The rest of the Nutrition study retains 18:30;
the native app's timestamp behavior is unchanged. Browser pointer checks
verified caret navigation and breakfast at 08:30, screenshots were inspected,
and all 19 Nutrition/geometry tests passed.

### Native meal parity and sleep clock validity

Inspection of `app/(tabs)/nutrition/index.tsx` confirms separate item expansion
and P/C/F totals. The old browser diary's food-count/protein-only row is replaced
with that structure: title opens the meal, item count expands names, and P/C/F
remain in the summary. The native onboarding implementation must guide the
existing native UI; the browser's older simplified layout is not its specification.

The sleep clock mutates input values directly and redraws its dial, without
dispatching the typing event the tour previously depended on. Continue now
refreshes validity from the current field on mutations and pointer/keyboard
completion as well as input/change. Clock controls are allowed during time
steps; HH:MM validation rejects invalid times. Actual pointer drags set bedtime
21:50 and wake time 07:30 and enabled Continue without typing. Keyboard clock
adjustments also passed; 99:99 kept Continue disabled. The meal caret expanded
to the logged food with P/C/F visible. Nineteen Nutrition/geometry tests passed.
Native source and personal records were not changed.


## Native implementation checkpoint ? November 23

Native work is now on `feat/native-guided-onboarding`. See
`docs/onboarding-native-guided-practice.md` for the account-completion migration,
local practice boundary, shared native controls and verification status. The user
authorized implementation and emulator checks, stopping before phone review.
This replaces the earlier "native unchanged" status for this branch only; no
release, deployment or Git delivery has occurred.
