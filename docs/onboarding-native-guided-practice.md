# Native onboarding and contextual app guidance

Current checkpoint: November 25, 2026, `feat/native-guided-onboarding`, base
`main` at `9d6f57d`. The user rejected the separate practice guide and authorized
**guiding real use with normal saves**. Historical practice checks and rejection
are in `app-guide-phone-review-2026-11-23.md`; they do not validate this replacement.

## Current entry

New registrations and unfinished version-1 questionnaires open the brief welcome
on Home. The concise welcome says "Get to know your training notebook."
Show me opens Home with the Explore Lastrep chooser and no selected topic; Skip enters Home
without tips. Both complete the introduction transaction, preserving existing
profile fields and records. Failed saves leave Welcome open for retry.

Settings > Support > App guide uses `replay=1`, without rewriting onboarding
completion. The old `/onboarding/practice` URL redirects to this introduction.
The rejected native replica screens and task controller were excluded from delivery;
the historical browser study and review notes preserve the design history.

## Real screens, normal controls

`src/onboarding/live/` owns a session-only topic selection and dismissed-tip state.
It does not own feature navigation state, forms, drafts, permissions or saving.
The actual tab routes and dialogs render optional in-flow notebook annotations.
A compact rounded guide bar sits below each real main-screen header. There is no
split practice viewport, task counter, Show me highlight, synthetic success page
or tour-complete page.

Topics cover Home/recovery, workouts, routines, programs, Today's Plan, Nutrition,
Sleep, Profile setup and optional health access. The topic selector in the guide
bar opens Explore Lastrep; Finish ends the session. A dialog
or staged-food screen does not offer cross-topic navigation: close/cancel normally
first, preserving unsaved input. Profile switching is refused while it has unsaved
changes or is saving; its normal Save/discard flow stays in control.

Tips stay within the topic explicitly chosen by the user. Visiting another tab
does not start its guide; returning to the chosen topic resumes its tips. Workout
completion can still appear on Home after saving, and Sharing dialogs can open
over any tab. Panels have a separate surface, border and restrained shadow. There is no repeated
Got it / Other topics footer. X dismisses the current tip only. Finish in the guide bar ends all guidance.
Neither changes feature data or requires completing an action. Settings can
restart guidance. Tips disappear on sign-out/account change and app restart;
no guide progress is written to Firestore or device storage.

- Workouts use the actual Add exercise, set controls, Finish workout, Save and
  confirmation flows. Successful saves update guidance only after the normal
  account write succeeds. A new editor does not repeat the last save message.
- Routines use the actual Create routine builder, Save routine and My routines
  application. Existing loaded routines count as loaded, without requiring a
  duplicate creation. Template and finished-workout flows are distinct.
- Program guidance is inside the real editor/assignment/schedule dialogs. Its
  instruction stays stable while typing, avoiding layout changes around the input. No fabricated program or routines are seeded.
- Today's Plan uses the actual current workout, recovery record and rule output.
  Expanding Review context changes the annotation toward choosing changes;
  applied results stop asking users to apply again. Keeping the plan is valid.
- Nutrition uses actual meal names, Add items, portion confirmation, staged
  selection and Add controls. Nothing is logged by a tip.
- Sleep retains its actual trend chart, dates, entries and editor. Empty accounts
  have honest empty history; examples are not inserted to make charts look full.
- Profile retains its actual editors, Done and Save. Health sync uses the real
  consent/permission flow. Declining is valid and does not block guidance.

## Architecture and safety

`AppGuideProvider` is inside the root app tree. Feature-local annotations receive
existing state; pure workout/routine tip selection is in `workoutTips.ts`. The
reducer rejects late success/dismiss events from an earlier account. Guidance
contains no feature repository calls and cannot synthesize successful saves.
Existing feature persistence, validation, retries and account cleanup stay owned
by their original controllers.

Normal user saves, health sync and optional connections retain their existing
collection, permissions and provider behavior. No new collection, analytics event,
provider transfer or retention purpose is introduced. Reviewed `doc/privacy.md`:
this change needs no new disclosure or Play data declaration. The entry wording
explicitly distinguishes this mode from the retired temporary examples.

## Verification checkpoint

The real-use candidate passed TypeScript, changed-file lint and the full unit
suite (1,002 passed, 100 skipped). Seven focused guide tests cover account
isolation, tab following, replay/dismissal and workout/routine/review continuity.
Web export passed with 49 routes; final copy/selector refinements were subsequently
type-checked and tested. Whitespace checks passed.

Native evidence includes the Galaxy A51 light-mode real screens and a disposable
account on the Android 16 emulator in dark mode. Actual workout save/history,
routine save/load, program name entry/assignment, staged Profile edits/leave guard,
recovery save and a no-change Today's Plan review were exercised. Enlarged 150%
text in landscape was checked for the annotation and topic chooser, and emulator
settings were restored. Screens and helper details stay private in `.dev-tools/`.

This is not a fresh end-to-end test of every existing feature. Native verification
of a review containing applicable changes, full program activation, food/sleep
saving under tips, first-registration transaction failure and actual health
permission grants remains outside this pass. User visual acceptance is pending.
No production data was used for synthetic saves; existing user records were not
edited for testing. No commit, push, merge, deployment or build was performed.
Unrelated production-access notes and historical mockup changes are preserved.

## November 24 follow-up: entry and independent routines

Welcome no longer explains ordinary account saves. Initial workout guidance uses
actual draft/program availability, prioritizing Resume when drafts exist, then
Continue for an active program, otherwise Start your first workout. Checking a
set changes the instruction toward reviewing/finishing; builder mode teaches
routine creation rather than logging a workout.

Workout choices now includes Create routine, using the existing builder in the
`builder:routine` draft slot. `routineBuilderReturnSlot` is optional local draft
metadata; older drafts remain compatible. Existing switch/park persistence keeps
the previous workout intact before opening the builder. Save/cancel restores that
slot and returns to choices; program-assignment builders retain their existing
return path. No Firestore schema, collection or provider transfer is added.

Validation for this follow-up is recorded below after native checks; earlier
checks in this document apply only to their dated implementation.


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

## November 24 second follow-up: optional review and local dismissal

Finish-workout feedback no longer gates saving. Unanswered fields retain the
existing `unknown` value; Today’s Plan feedback additionally accepts `not_used`,
distinct from a negative usefulness answer. The reviewed flag still belongs to
its draft and persists across resume. No review/application is required to train.
Existing workout storage accepts these feedback fields; no provider transfer,
permission or collection change is introduced. The privacy categories remain
unchanged (optional app feedback).

Progression eligibility is unchanged. Explanations separately identify no working
sets, already recorded effort/completion, special set types and mixed load/reps.
Only copy changes in the progression engine; historical and planned sets remain
untouched. Saved-workout guidance gives the Home calendar/date path and a clear
Explore topics / End guide choice, including after the real confirmation returns
to Home. X dismisses one tip across its instances; other tabs remain guided.
Routine-builder title placeholder and accessibility labels now distinguish a
routine from a workout session.


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

## November 24 topic and wording revision

Guide entry sends a one-use route request to show Workout choices. This changes
only presentation state; the actual hydrated draft, program link and builder
return slot are preserved. Routine-builder copy does not override the choices
screen just because a builder draft exists. Resuming a builder explicitly explains
that it is a template draft and offers returning to choices.

Tab navigation no longer changes the selected topic. Tips check both the selected
topic and current feature path, including nested nutrition routes. Explicit
completion on Home and Sharing dialogs over other tabs are bounded exceptions.
Choosing another topic still honors the unsaved Profile guard. Guide state remains
account-bound and session-only, with no new analytics or saved progress.

Main-screen copy now introduces a goal and next action rather than listing every
control. Profile Done/Save guidance lives in its editing sheets (phase guidance
appears only when Done is available). Sharing is a selectable topic with brief
send/received-program guidance; it does not automatically opt other topics in.
Real permissions, send/import operations and records remain under normal controls.


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

## November 24 explicit chooser and persistent navigation

Welcome Show me begins an active, account-bound guide session without choosing a
lesson. It returns to Home before opening Explore Lastrep. Its topic goals include
Home/recovery, logging a workout, routines, programs, Today’s Plan, Sharing, food,
sleep and health data. Choosing a topic retains existing navigation/save guards.
The session has an active flag distinct from its nullable selected topic. Finish
guide and account changes clear it. No progress is saved to a backend or analytics.

A small labelled Guide topics row sits below the existing main-screen headers,
outside page scrolling. It names the chosen topic and remains present on Home,
Workout, Nutrition, Sleep and Profile even after X dismisses a tip. This replaces
the unexplained per-tip list icon. It does not overlay controls, change tab-bar
geometry or turn unrelated tabs into lessons. Initial/topic-chooser dismissal and
Finish guide remain separate operations.

Untouched empty routine builders are excluded from resumable drafts and parking;
a name or exercise qualifies them. Local editor recovery metadata can temporarily
exist during slot hydration, but is never shown as an empty Resume entry. Leaving
an empty standalone builder restores the prior slot without confirmation; a
meaningful builder is preserved by Back. Discard routine draft has destructive
styling/confirmation for meaningful content and retains prior workouts. Existing
empty parked builders are filtered without touching recorded workouts.

Workout guide copy uses the same displayed program occurrence/date as Continue.
Completed days acknowledge completion; rest days explain no program workout is
scheduled. Schedule calculation and program records are unchanged.


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


## November 25 outcome acknowledgements and clear exit

App guide replaces Guide topics as the main-screen chooser action. A separate
Finish guide ends the session directly from that row; dismissing a tip still
only dismisses the current tip. The row retains native headers/tabs and uses
bounded text/icon touch targets. Explore Lastrep remains the chooser title.

Profile setup and optional health access now have separate topics. Selecting
Profile scrolls to its setup content; selecting health scrolls to Health sync.
Dedicated guide route parameters do not open consent or request permissions.
The existing unsaved Profile guard still blocks switching topics until edits
are saved or discarded. Ordinary health entry paths retain their behavior.

Food acknowledgements are emitted after successful manual, catalog/merged-food
or saved-meal writes. They are keyed by diary date and meal. The meal's current
subscription must also contain food before saying Food added; existing records
say Review your meal. Nutrition's overview points to totals and editing instead
of continually requesting food. Sleep saves use their actual saved date and the
same current-record check. Profile uses its existing confirmed save feedback.
Program instructions distinguish an existing program, an open workout, a routine
builder, completed days and rest days rather than always prompting creation.

These are account-bound, in-memory annotations. No schema, analytics, health
permission, backend, provider-transfer or retention changes were introduced.
No privacy/Play declaration changes are needed for these guide-only effects.
The separate top/back-off progression proposal is in
`docs/top-backoff-progression-proposal.md`; set types and progression behavior
are not changed by this batch.

### Verification

TypeScript and changed-file lint passed. Guide tests cover meal/date scoping,
existing versus newly saved records, missing/deleted records, ignored late saves
after Finish/account change, distinct Profile/health topics and program states.
Final focused guide suite: 20 passed. Final full Vitest: 1,020 passed, 100
skipped (141 files passed, 10 skipped).

Android 16 disposable account: Profile and health open at their respective
sections, without a consent prompt. A manual food save changes the meal tip to
Food added and the diary to totals guidance. A saved sleep duration changes the
tip to Sleep saved. Header Finish removes all guidance. Account identity was
confirmed in Settings before synthetic writes. Galaxy A51 read-only checks
confirmed the topic separation, section navigation and header Finish in light
mode at its existing font setting; no personal records or permissions changed.
The phone is at Welcome for review.

An initial native run had a stale bundle; a dev-app restart loaded the changes.
Two helper assertions looked for an off-screen heading or treated non-clickable
text as a button; fresh captures and corrected checks verified the actual UI.
The first sleep attempt correctly rejected a future wake time; a duration entry
then saved successfully. Those failed helper attempts are not pass evidence.
Private evidence: `.dev-tools/guide-followthrough-native/` and
`.dev-tools/guide-followthrough-phone/`. Changes remain uncommitted; no release
or deployment.


## November 25 rounded guide bar

The guide's ruled row is replaced with a rounded, inset bar using the existing
subtle color token, no shadow, and equal 8 dp outer vertical spacing. The left
control shows an information icon, selected topic (App guide before selection)
and dropdown caret; Finish stays on the right. Their empty separating space is
not tappable. Topic text wraps and buttons retain 44 dp minimum heights.
Explore Lastrep now has only its close action and topics, with no duplicate
Finish footer. Closing it does not finish the guide. Account/session/navigation
behavior and saves are unchanged.

TypeScript and file lint passed. Galaxy A51 read-only verification confirmed the
rounded bar, selecting/reopening/closing topics, and Finish. Phone left on
Nutrition with Log food guidance active for visual review; no personal records
were changed. Private evidence: `.dev-tools/guide-bar-phone/`.

Android 16 dark-mode verification also covered the long Sharing topic label,
200% font scaling, separated tap targets and Finish. Android recreated the app
when font scale changed, resetting the in-memory guide as expected; restarting
the guide at that scale verified wrapping. The original font scale was restored.
Private evidence: `.dev-tools/guide-bar-emulator/`. The initial phone launch
check ran before its Welcome route settled; the subsequent warm-route check
completed successfully. In-tip references now say guide bar because the topic
selector displays the chosen topic rather than a fixed App guide label.


## Delivery review (November 25)

The PR contains the final real-use guide and its approved routine-entry, empty-
draft and optional-feedback fixes. The rejected native practice implementation
was preserved privately and excluded from the PR. Its highlight instrumentation,
inline modal host and injected fake sleep/recovery stores were removed from real
screens. Welcome uses small guide-specific notebook controls. The historical
browser study remains clearly identified as superseded reference material.

State ownership: feature screens retain all record, form, program and draft
state; guide state is session-only and account-scoped. Writes emit acknowledgements
after success and reject stale account callbacks. Routine return slots park first
and keep previous workouts recoverable; the new standalone builder reuses that
existing storage boundary. Legacy onboarding URLs redirect without rewriting
profile answers. Existing onboarding completion fields remain compatible.

Final validation after excluding the rejected implementation is recorded in the
PR. Earlier test counts include archived practice tests and are historical;
removed practice tests do not imply lost coverage of the current guide. No new
permissions, provider transfers, analytics or health reads were introduced, so
no privacy declaration change is required. No backend deployment or AAB is part
of this delivery. Top/back-off progression is a separate unimplemented follow-up.


Delivery checks after review cleanup: TypeScript and full lint passed; 1,007 unit
and behavior tests passed with 100 existing integration skips; 109 browser-study
checks passed. Tracked Android verification, backend build and Expo web export
passed. The web export initially could not open Expo's local log under sandbox
permissions; it succeeded with the required filesystem access. Native Welcome,
topic selection and Finish were smoke-checked again on the disposable emulator.
