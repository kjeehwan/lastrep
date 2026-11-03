# Workout programs and unified Today's Plan — native review

November 3, 2026. Branch: `feat/workout-programs-todays-plan`.
The user accepted the native program flow, recovery details and draft behavior on
the connected phone and authorized split commits, push, PR review and merge.
No production rules/functions deployment or new AAB is included in this step.
The historical local WIP checkpoint `3349b65` is replaced by the focused native
commits prepared after final phone acceptance.

## Changes completed after the savepoint

- Continue program opens its assigned workout directly and preserves an existing
  occurrence draft. The extra preview/Load workout step was removed following
  phone feedback; Today's Plan is reviewed on the workout page.
- Parked program drafts use both run and occurrence identity. Skipping to another
  day cannot silently open the previous day's draft.
- A stale program manager cannot overwrite a newly activated run. Interrupted
  deletion remains visible and can be retried. Same-name routine and run rows use
  stable IDs. Completed history preserves its original day number.
- Routine-builder Save is visible and disabled when empty. Android/header Back
  confirms cancellation; Save and Cancel restore the previous workout and
  return to program setup. Assignment saves the selected routine ID.
- Save persists only completed sets and refuses a workout with none completed.
  Failed linked saves preserve the draft and do not advance the program.
- Review rows use compact set × rep × load prescriptions without flattening
  mixed loads. Target summaries sit below Note and above Add warm-up.
- Deload markers now survive native draft hydration. Returning to normal compares
  editable set values rather than object order or hydration defaults, while
  retaining recorded/edited sets. Repeated review does not compound reductions.
- Draft loading ignores stale account reads. New program and progression inputs
  avoid Android fullscreen editing; their sheets compact vertical padding in
  landscape so the focused field remains visible above the keyboard.

## Verified locally

All synthetic account and health/recovery/workout fixture writes were confined
to `demo-lastrep-sharing` Firebase emulators. No real user's records were edited.

- Full suite after phone-feedback changes: **879 passed, 46 skipped**. The skipped rules/transaction tests were
  also run explicitly against the local backend where applicable.
- Local Firestore owner-rule and transaction suite: **21 passed**.
- TypeScript and targeted ESLint: passed, no findings.
- Android JavaScript/Hermes export: passed; this is bundle validation, not an AAB.
- Android 16 emulator: program creation/assignment/start; cold reopen; separate
  and program draft switching; staged recovery Save/Cancel; progression Apply
  and Undo; native progression settings Save; stale review after input changes.
- Home's recovery form displayed the same dated ratings used by Workout's
  review. Missing ratings required the shared check-in before review.
- Standalone save left the program unchanged. An intentionally denied local
  linked save failed without advancing its day; after restoring normal local
  rules, retry saved once and completed the correct run/day.
- Next-day routine preview, restart confirmation, archived completed-day history,
  routine-builder disabled Save, Android Back/Keep editing, actual routine Save,
  Cancel/restoration and stable-ID assignment of same-name routines.
- Tomorrow shifted the pending schedule anchor without marking completion.
  Move, Swap, Skip and resume date semantics are covered by pure tests; a full
  touchscreen matrix of every scheduling combination has not been claimed.
- Program deletion left five routines, six saved workouts and the current draft
  intact. An interrupted-deletion fixture exposed its retry action and finished
  cleanup. Zero completed sets produced an explicit save rejection.
- Deload decline/confirm/apply, cold reopen without another reduction, and return
  to the original 3 × 6 × 80 kg prescription. Unit coverage also protects edited
  and effort-recorded sets and seven-day expiry.
- Light/dark appearance, 1.3 font scale, first/middle/last program rows, and native
  landscape keyboard visibility. Emulator font scale, rotation and system theme
  were restored after testing.

Ignored artifacts are under `.dev-tools`: `program-final-tests.log`,
`program-final-lint.json`, `program-layout-final-lint.json`,
`program-native-export.log`, and named emulator screenshots/XML dumps.

## Next: phone review

The Samsung SM-A516N is now connected. Lastrep Dev is open on Workout choices
through Metro 8082 with ADB-reversed local emulator ports. Runtime inspection
confirmed `demo-lastrep-sharing`. A fresh disposable account, Program phone
review, contains three sample routines and two comparable Bench Press sessions.
The phone entry screen, blank program setup and routine picker were inspected.
The first hands-on review identified fixes recorded below; re-review is pending.
No production rules were deployed and no
real account records were used or changed.

Review the entry choices and program strip; create/assign/edit a program; switch
to a separate workout and return to its saved program draft; review/apply/undo
Today's Plan with a shared recovery check-in; and inspect typography, spacing,
keyboard behaviour and both themes. Only after phone review should commits,
remote PR review, merge, deployment or release work be proposed.

## First phone review fixes

Follow-up review supersedes two points below: Use program has now been removed
in favour of Save/Start and a Stop action in active-program details. Last and its
previous-set text are left-aligned; the remaining headings stay centred. Pain
details use the compact area-selector flow described at the end of this section.

- Off-state program switch uses a visible track and contrasting thumb in dark
  mode; on-state thumb also contrasts with the accent track.
- Removed the intermediate program workout preview.
- Review and recovery use one native modal host. Async check-in loading resets
  only the form, not the native modal. Review selection is scoped by result ID
  rather than remounting the whole review when a result arrives.
- Recovery choices and Save/Cancel labels are centred within their hit areas.
- Multiple discomfort reports have independent area, side, severity, trigger and
  note. Older single-area data remains readable. Normalization, input hashing,
  schemas, per-exercise review and backend guardrails consider the whole list.
  Backend code was compiled locally, not deployed to production.
- Target-summary spacing accounts for neighbouring hit areas. Set-table headings
  mirror the native row's actual fixed widths, input proportions and end margin.
- Emulator verification: Continue opens the workout directly; missing recovery,
  Save and Edit work within one modal. Two independently entered areas were saved
  and restored, and the returned review used the relevant report. Data inspection
  confirmed the two reports and their distinct severity/trigger values.
- Design specification v1.49 records the contrast, alignment, spacing, modal-host
  and multi-area requirements. Recheck these items on the phone before acceptance.

Follow-up recovery layout: the main check-in shows area chips with reported areas
highlighted. Tapping a chip opens a small side/severity/trigger/note popup. Done
stages the area without writing it; Cancel/Back/outside tap leave the check-in
draft untouched. Remove area is available for existing reports. Older multiple
reports for the same area remain individually editable. Only Save check-in
commits the staged reports and ratings. Design specification v1.50 records this
flow, explicit program actions and the Last alignment exception.

Compact-flow emulator results: adding a third area with Done left the backend at
two reports; cancelling the main check-in restored those two. Cancelling a changed
shoulder severity restored Moderate, and Android Back closed only its detail
popup. A subsequent Save check-in committed three reports. Stop program cleared
the active selection while preserving run `Kb2hiTWP8SHePeAQFacz` and the unfinished
workout; details offered Resume. All 879 tests, TypeScript, targeted lint and the
Android bundle export passed. The phone was reopened on Workout for re-review.

## November 3 phone feedback

- Recovery area details: equal Cancel/Done geometry, symmetric 16-point spacing
  around Optional detail, and a compact left-aligned trash/Remove action.
- Active program details: six icon actions with labels below, matching Workout's
  action grid. Share explains that program sharing is not available yet; no new
  sharing backend or delivery behavior is enabled. Previous runs remains separate.
- Design specification v1.51 records these rules for subsequent work.

Verification for the November 3 layout changes: TypeScript and targeted ESLint
passed. Android emulator inspection confirmed equal Cancel/Done touch bounds
(425 x 129 px each), symmetric detail-field gaps (42 px each at this density),
staged area removal, a six-action active-program grid, the Share placeholder,
and Delete cancellation. Only disposable local-emulator account data was used.
The connected phone's dev app was reopened with its demo-backend ports restored.

### Resume date and action colors

Resuming an earlier unfinished workout updates its date to today before writing
a fresh draft-save timestamp. Continue program, Resume workout and the saved-draft
picker share this restoration path, including the already loaded slot. Sets,
effort and program occurrence identity remain intact. Continue/Resume/Start now
use normal ink in program details; Delete retains danger red. Design v1.52 records
the local color distinction and resume behavior.

Six draft-slot regression tests, TypeScript and targeted ESLint passed. Phone
Continue program verification confirmed November 3 and the Today's Plan row.

### Details spacing follow-up

Remove and the footer divider now have symmetric 16-point gaps above and below,
with inherited footer border/padding disabled for this editor. Emulator screenshot
and native bounds verified the spacing around the Remove touch target; TypeScript
and targeted ESLint passed. No recovery data was saved during this visual check.

### Restart, recovery requirements and draft labels

Restart previously activated a new run but left the prior workout in the editor.
Activation now returns the transaction's committed program/run, loads its pending
routine directly, and parks the old draft. Rest days return to workout choices.
The native emulator verified Restart from a renamed Back + Biceps draft opens
Chest + Triceps on Day 1 and retains the prior draft as Previous run.

Resume rows now show Separate workout or program name/day, with a Previous run
marker when applicable. Current in-memory drafts include their program link in
the picker metadata. Recovery ratings remain required only for Today's Plan,
are labelled when missing, and validation/save errors use danger color. Optional
Home saves retain their existing behavior. Emulator missing-input submission
showed the validation message without saving recovery data.

Thirteen targeted draft/persistence tests passed against the local demo emulator;
TypeScript and targeted ESLint passed. Design specification is now v1.54. The
phone dev app was reopened for review; its program was not restarted by automation.

### Draft picker loading follow-up

The current draft and parked drafts previously loaded independently, allowing a
partial list to appear. Cache hydration now reads both keys together. Each Resume
workout request also opens a loading state and publishes one complete snapshot,
including the current in-memory draft metadata. Requests are scoped to account
and sequence; failures offer Retry and preserve stored drafts.

Nine draft tests, TypeScript and targeted ESLint passed. Native review confirmed
the complete labelled list after loading. The pending-read behavior is covered by
the delayed cache unit test; attempts to inject a paused read into the running
emulator did not establish that the visible picker was held, so no native
slow-read pass is claimed. Temporary runtime patches were removed by restarting
the disposable emulator app. Metro was restarted with a cleared development
cache; both phone and emulator use the local demo backend. Recovery validation
was already verified in the prior emulator check; the user need not clear ratings.

## Merge boundary

Program sharing remains a future feature: Share shows an unavailable explanation
and does not deliver programs. Before releasing the new native program flow,
deploy the owner-only program/run/occurrence Firestore rules. The multi-area
backend validation/guardrail changes are also included as source, not deployed.
The approved browser studies remain design references rather than claims of
production behavior. Temporary QA helpers, fixture accounts and runtime patch
scripts are ignored local artifacts and are excluded from the commits.
