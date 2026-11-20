# Beta core workflow review

Reviewed November 20, 2026, against main `a0f13c1`. The exercised registration,
routine, recording, draft recovery, finishing and in-app sharing paths worked.
The review found two reproducible layout issues and two copy issues. These were
addressed together on `fix/beta-workflow-polish`; verification is recorded below.

## Findings

### W1 Offline banner covers bottom navigation

**Priority: P2. Confirmed native behavior.** Reopen a signed-in app with networking
off. The offline banner occupies the same space as the bottom tabs. Tapping
Workout dismisses the banner and leaves Home selected; a second tap is needed
to navigate. The overlay's Pressable intercepts that first tap.

`components/OfflineBanner.tsx` positions the root overlay at `bottom: 0` with a
high z-index and no route/tab-bar clearance. Reserve the actual bottom navigation
height on tabbed screens, while retaining appropriate placement on auth and
onboarding screens. Check narrow screens and enlarged text when fixing it.

### W2 Sharing acceptance feedback is clipped

**Priority: P2. Confirmed native layout.** Accept an incoming request, leaving
Requests selected. The request moves to Inbox correctly, but the feedback
"Request accepted. Open the plan from Inbox." is almost entirely below the
visible edge of the Sharing card. Its visible height was only about 15 pixels
on the 1080×2436 test display. The screenshot confirms clipping, not merely an
accessibility-tree anomaly.

`src/sharing/SharingDialogs.tsx` gives the center card a fixed height and its list
a separately calculated fixed height. Feedback is rendered after that content
without reserving its space. Let the list use remaining space and keep feedback
visible within the card. Check all three tabs, loading/errors and enlarged text.

### W3 Onboarding describes an inactive AI flow

**Priority: P3. Confirmed copy mismatch with the current review path.** Optional
health setup says summaries may support AI-assisted recommendations and that a
separate disclosure appears before sending context to OpenAI. Current Workout
review calls `useWorkoutTodayPlan` and `buildDeterministicTodayPlan`; this path
does not call OpenAI. The conditional wording is not evidence of a data transfer,
but can give a new user the wrong expectation about the current feature.

Update `src/onboarding/OnboardingScreen.tsx` to describe the training/recovery
guidance currently available. Keep any future provider disclosure tied to an
actual enabled provider flow. Review related policy wording when implementing
this copy change; no data transfer or policy was changed during this audit.

### W4 Sharing copy assumes workouts or plural counts

**Priority: P3. Confirmed native copy.** The empty Inbox says "No shared workouts
yet" and empty Sent says "No workouts sent yet", although both support programs.
The two-day fixture also displays "1 workout days", "1 routines" and
"1 routines saved". Use workout/program-inclusive empty text and singular-aware
count formatting in the sharing views.

## Passed checks

| Workflow | Actual verification |
| --- | --- |
| Registration | Empty-email validation; offline submission blocked with fields retained; online retry created one local account. |
| Onboarding | All four steps; Back/forward and changed experience; nickname saved; optional health setup completed without requesting health permissions. Backend completion checkpoint confirmed. |
| Routines | Created a mixed Treadmill/Bench Press routine through the picker; native My routines listed it; applying it restored its prescriptions. Backend copy confirmed. |
| Recording | Cardio duration and resistance load/reps entered; RPE and completion recorded. Duplicate last set copied load/reps while leaving the new RPE and completion blank. Optional rest-alert setup was declined. |
| Draft recovery | Leaving and resuming retained the draft. Cold reopening offline retained sign-in and all draft prescriptions, effort ratings and completion flags. Resume workout reached the same draft after dismissing W1's banner. |
| Finish and history | Cancel preserved the workout. Saving wrote one record containing cardio plus the two completed resistance sets; the unfinished third resistance set was excluded. Declining Update routine preserved the original routine. Finished draft disappeared from Resume workout; exercise history displayed the saved load/reps/RPE. |
| Receive program | Enabled sharing through Settings; accepted a local peer's request; previewed resistance/cardio prescriptions and target reps/RPE; saved independent program/routine copies. Starting could be cancelled, then confirmed; Day 1 loaded the correct exercises and prescriptions. |
| Send workout | Native people search found the local peer; a mixed workout sent successfully. Actual sender UI displayed Awaiting acceptance, Delivered and Viewed after corresponding local peer actions. |

## Environment and limits

- Existing dev APK with current main JS through normal development Metro;
  Android 14/API 34 generic emulator, 1080×2436 at 420 dpi, default text/light mode.
  This review did not repeat the earlier multi-device/theme matrix.
- Explicit demo Firebase project with local Auth, Firestore and current compiled
  sharing functions. Current Firestore rules/index definitions were copied for
  the local environment. No production account or record was used.
- The app registered the first synthetic account through its UI. The second local
  account was a backend fixture: its program send and acceptance/read responses
  used the real local callable. These do not constitute a second device UI test.
- Native analytics collection was disabled before networking was enabled, and
  disabled again after the cold reopen while still offline. Local endpoint and
  account identity were verified before data operations.
- The ordinary Android hierarchy dumper cannot obtain idle state while the
  workout timer updates. Stale dump files were excluded. A read-only shell
  UiAutomation helper provided fresh hierarchy data for subsequent actions;
  screenshots and stored records corroborate the results above.
- No crash was recorded in the final emulator crash buffer. This was a workflow
  review, not a general crash/stress certification or a new automated unit-suite run.
- Google sign-in, real health services, Play billing, public-link/App Link delivery,
  production backend/index behavior and iOS were not exercised here. External
  sharing links were not published. The grey-strip investigation still awaits
  the tester's device details.

Screenshots, raw hierarchy snapshots and scripts are ignored under
`.dev-tools/workflow-review-2026-11-20/`. No application code, production settings,
deployment or build was changed by this review.

Both disposable local accounts and all demo-project documents were removed;
read-back confirmed zero accounts and collections. The dev app and shell probe
were removed from the emulator, its temporary port forwards were cleared and
networking returned to its original off state. The task's emulator, Metro and
Firebase services were stopped. No phone was used.

## Follow-up fixes and verification

Implemented after the review on November 20, 2026:

- W1: The root offline banner uses the shared navigation geometry plus the current
  safe-area inset and text scale. Tabbed routes reserve tab height once; auth and
  onboarding retain only their system inset. The banner has an explicit dismiss
  accessibility label and does not intercept touches outside its bounds.
- W2: Sharing status uses `AdaptiveModalCard`'s existing footer through an optional
  `WorkoutModalShell` prop. The outer scroll viewport yields space to the footer;
  on short displays the existing adaptive behavior makes the footer scrollable.
  The list has a maximum height rather than forcing a separate fixed height.
  Other modal callers retain their existing behavior.
- W3: Optional-health onboarding describes training/recovery guidance, including
  Today's Plan, without implying the current path sends context to OpenAI.
  Reviewed `doc/privacy.md`: this batch changes no collection, transfers,
  permissions or retention, so no policy or Play declaration change is needed.
- W4: Shared-list loading/empty text includes programs, and preview/save summaries
  distinguish one workout day or routine from plural counts.

Validation:

- TypeScript and ESLint on the changed application files passed.
- Focused sharing/navigation/keyboard-viewport tests: 43 passed, 8 skipped;
  emulator-dependent rule tests remain skipped in that ordinary unit-test command.
- Android 14 emulator: auth banner retains system clearance; signed-in Home and
  Workout banners clear the tab bar. A single Workout tap navigates while offline
  without first dismissing the banner.
- Default 1080 x 2436 display and a narrow 840 x 1600 viewport at 420 dpi, with
  160% text: checked empty/populated Sharing tabs, full acceptance feedback,
  received-program singular counts and saved-program singular confirmation.
- At narrow width with enlarged text, held a response and injected one failure
  through a temporary runtime-only wrapper of the local sharing service. Busy
  controls were disabled and the busy/error footer remained visible. After
  restoring the real function, scrolled to the request actions and retried;
  acceptance completed and its full wrapped feedback remained visible. This
  specifically verifies UI failure handling, not a real network outage.
- Reused only the two disposable accounts on `demo-lastrep-workflows` with local
  Auth, Firestore and sharing functions for automated data operations. No
  production record was changed. No deployment or new AAB is part of this batch.
- User phone review on the Galaxy A51 (SM-A516N): with Wi-Fi and mobile data off,
  the banner stayed above the tabs and Workout opened on the first tap. The user
  re-enabled connectivity afterward. Sharing feedback remains emulator-verified;
  no incoming production request was created for this review.

Initial native checks caught a populated-list busy message still below the card
with an intermediate flex layout. The final reserved-footer implementation was
then checked for busy, failure and successful retry at narrow width. This is why
the final change reuses the existing footer rather than adding another layout
calculation. Loading wording was inspected in code; a prolonged loading state,
rotation and dark mode were not repeated in this focused batch. Phone review
covered offline navigation only.

Follow-up cleanup confirmed zero local users and collections. Removed the dev
app, runtime fault wrapper, shell probe and port forwards; restored 1080 x 2436,
100% text and the original networking-off state. Stopped the task's emulator,
Metro and Firebase services. The crash buffer contained one Android System UI
subscription-ID exception at emulator boot, before the app checks; it contained
no Lastrep crash. This is not a general crash/stress certification.

During PR checks on November 21, the full suite exposed an existing Profile
wiring assertion that forbade any `pathname` reference in the global banner.
Updated it to reject route-dependent visibility guards while permitting the new
route-dependent positioning. Connectivity/dismissal visibility checks remain.
No application behavior changed in this test correction.
