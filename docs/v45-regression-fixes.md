# v45 regression fixes — November 7, 2026

Branch: `fix/v45-release-regressions`, based on release commit `0e911622`.
The user approved Git delivery and preparation of the next production update after
the phone review below. The EAS-handoff rules are delivered as a separate commit.

## Program calendar

A completed program occurrence previously retained its scheduled date even when
the saved workout had a later date. The following rest day could therefore elapse
one day too early. A synthetic program anchored on November 4 with workouts saved
on November 5 and 6 reproduced Day 4 on November 7 instead of Day 3 Rest.
The exact original start date of the reported production run has not been inspected.

Completion now uses the saved workout date. Finishing late moves the remaining
calendar forward; completing a future day out of order does not move an earlier
unfinished workout. Explicit skips, swapped prescriptions and subsequent
resume/shift anchors are preserved.

On loading an active run, the repository checks older completed marks against
their exact workout ID and program/run/ordinal link. Verified dates repair the
run and occurrence documents in one transaction, including re-evaluating elapsed
rest days. Unrelated or same-named workouts never count as evidence. The workouts
themselves and unfinished drafts are not rewritten. Missing/unlinked records do
not supply dates. An optional per-completion version prevents repeated checks;
new completions written by an older client remain eligible for a later check.

Home and Workout share this repository-backed run. Concurrent checks are
idempotent, use current transaction state, and retain account ownership checks.
The subscription ignores stale asynchronous results after a newer snapshot or
account/run change. A failed/offline check retains the saved run and offers retry.

## Health-sync feedback

Sleep's optimistic conflict check used JSON serialization of Firestore maps.
Equal maps with different key order could falsely exhaust retries and report
that another device changed the data. Keys are now compared in canonical order,
while array order, real field changes and full timestamp precision remain
significant. Genuine conflicts still fail without writing the proposed change.
Provider cursors and consent/permission behavior are unchanged.

Body import already deduplicated measurements correctly, but returned `no_data`
for both an empty provider response and an already imported snapshot. It now
returns `unchanged` for the latter. Profile refreshes its body view and says
"Body composition is up to date." Existing import timestamps/history are not
advanced merely by checking again. Empty provider responses remain distinct.
An overlapping Home import could explain the reported chart refresh; that timing
has not been established on the user's phone. No steps behavior was changed.

## Mixed-workout sharing

The adapter previously forwarded a stale weight unit for cardio (or distance
unit for resistance), which the strict sharing contract rejects as "Invalid
exercise." It now prefers each exercise's explicit mode and chooses a display
unit valid for that mode. Valid lb/mi preferences are preserved; canonical kg/km
values are unchanged. Privacy allowlists, server validation and set limits remain
intact. The precise stored unit on the reported workout has not been inspected.

No additional data collection, provider transfer or retention is introduced;
privacy-policy and Play declaration changes are not needed for this correction.

## Validation

- Full ordinary Vitest run: 133 files / 944 tests passed, 100 emulator-only tests
  skipped as expected without emulator environment variables. Two additional
  program-calendar cases subsequently passed in the focused 11-test flow suite.
- Firestore emulator: 38 tests passed across program persistence, body import
  concurrency and scoped sleep command integration. The concurrent calendar
  repair assertion was added afterward; all seven program persistence tests
  passed again, including two simultaneous repairs producing one revision.
- TypeScript and focused ESLint passed. No native dependencies or backend
  contracts changed.
- Android 16 disposable emulator, dev package, verified local
  `demo-lastrep-sharing` backend: displayed Continue program Day 3; opening it
  showed Day 3 Rest, November 7. Runtime checks confirmed surrounding dates
  November 5/6/7/8, nine mixed sharing exercises and a successful sleep transaction.
- The actual Share action opened Review workout for a synthetic eight-strength /
  one-cardio workout with a deliberately stale cardio weight-unit preference.
- The sole task-created local account and all its documents were removed after
  sign-out. Existing QA servers, ADB mappings and phone production data were not changed.

## Phone review accepted — November 7

The updated dev app was reopened on the connected Android 13 phone, using the
normal Lastrep backend. Runtime checks confirmed the corrected implementation was
loaded. The user signed in to their normal workout account and verified:

- Continue program opens Day 3 Rest, November 7, in the schedule popup. Opening
  schedule controls rather than loading an exercise log is expected on a rest day.
- Sync now succeeds without the false sleep conflict. Feedback distinguishes no
  new sleep records, body composition already up to date, and no steps today.
- A resumed QA workout with bench press plus an added treadmill exercise opens
  sharing and sends an in-app request. Awaiting acceptance is the expected state;
  this review did not establish recipient acceptance or viewing of this new share.

The user performed these account actions. Automated checks did not edit their
workout or health records. Automatic calendar repair remains limited to provably
linked completions. Existing drafts remain intact, so an already-open later
program workout is not silently replaced by Rest.

Production v45 remains unchanged until the subsequent app update. No Firebase
deployment is required: these changes affect client code and existing account
documents under the current backend and rules.
