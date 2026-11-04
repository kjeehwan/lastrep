# Program sharing

Approved mockup checkpoint: `e18c5f1`, pushed on `feat/program-sharing`.
Native/backend changes were accepted on the connected phone. Split commits,
PR review, merge and deployment are the next release steps; the AAB follows
real HTTPS checks against disposable deployed accounts.

## Implementation

Programs use strict version-2 snapshots alongside unchanged version-1 workout
plans. Each day refers to a local snapshot routine key; account/routine/run IDs,
program progress, completed sets, actual effort and personal notes are excluded.
Only referenced routines are included. Repeated routine assignments reuse one
copy; identical names never determine routine identity. Include weights off
removes weights from every routine's actual outgoing payload.

The existing sharing callable, recipient discovery, requests, accepted senders,
blocking, retry receipts, per-account quotas, bearer links, 30-day retention,
cleanup and account-deletion handling are reused. Inbox and Sent entries include
a plan-kind label. Whole-program bounds are 14 days/routines, 160 exercises,
1,600 sets and 120,000 serialized characters, in addition to existing per-workout
bounds. Program snapshots reject unknown/private fields and missing references.

Import is one transaction creating a saved program and independent routines.
There is no initial run or activation. Retries of one delivery reuse the import;
a deliberate later delivery can be imported separately. Previously edited
imported routines are never overwritten. Program deletion/reimport reuses surviving
routine copies. A separate imported copy remains after source sharing deletion.
Reopening an already-started import offers View program and preserves its run.

Starting uses the existing program-start confirmation and workout draft slots.
The previous workout stays available in the native Resume workout picker. Its
separate/program/day identity, weights, reps and effort are retained.

Existing `/w/` links and Android association routes carry both plan versions.
New app and hosted-page requests advertise version-2 support. Older installed
clients receive an update message rather than a program payload they cannot
render. The hosted page previews the cycle and expandable routine prescriptions;
it retains Open in Lastrep and the standard Google Play listing link. Native
Messages/Email drafts identify the shared item as a program; Copy link uses the
real clipboard. No external messages/emails are sent by automated checks.

## Local verification environment

Use only `demo-lastrep-sharing`: Auth 19100, Firestore 18081, Functions 15001,
Metro 8082. Local hosted-page proxy is 4318. The emulator and connected Galaxy
use the same local backend, with disposable Alex Program QA / Ben Program QA
identities. Ignored `.dev-tools/program-sharing-native-accounts.json` contains
only those disposable demo credentials; do not copy them into tracked files.

Program imports and native send/accept/import/start were checked on Android 16
emulator. A separate 42 kg × 10-rep workout was restored unchanged through the
picker after starting the imported Chest + Triceps program. Galaxy checks
confirmed received-preview order, preserved targets/rest/tempo, grouped sets,
weight omission in preview and reopening an existing import without another run.
Both devices read one imported program, four routines (including the recipient's
own routine), and one run. Imported notes were empty. The user accepted the day
previews, weight toggle, send/receive/Sent UI and receipt icons on November 4.

Backend transaction checks cover retry duplication, acceptance, older-client
compatibility, same-name routine isolation, repeat deliveries, expiry and sender
sharing-data deletion without deleting imported copies. Browser automation
rendered the real hosted-page code against a local version-2 snapshot with no
JavaScript errors. Android and web exports, native configuration checks and
TypeScript passed. Final check counts are recorded in the completion note.

Ignored helper/results prefix: `.dev-tools/program-sharing-*`.

## Completion checks

The ordinary suite passed: 123 files, 891 tests (7 files / 50 tests skipped).
The local Firestore transaction, retention and rules suite passed all 22 tests
across four files. TypeScript and sharing/workout ESLint checks passed after the
final UI changes. Android and web exports and native configuration checks passed.

On the Galaxy, sending with Include weights off produced a version-2 snapshot
with three routines and 12 sets, all without weight values. Sent history opened
that snapshot. Sending again while acceptance was pending showed Request pending
without creating another delivery. Copy link wrote an actual development URL to
the clipboard; opening that copied URL launched the app's Received program
preview with the full day cycle. No extra import was created by this link check.
These checks used disposable local accounts, not production account records.

Sent now displays per-recipient receipts: clock / Awaiting acceptance, one check
/ Delivered (available in Inbox), and two checks / Viewed (preview opened).
Acceptance and viewing update the sender's existing Sent record transactionally;
concurrent recipients cannot overwrite each other's state. Legacy deliveries are
matched by their exact hashed delivery identity, and retries never downgrade
Viewed. External bearer links do not identify or report individual viewers.
The receipt addition passed 23 emulator transaction/retention/rules tests, backend
build, TypeScript and focused lint. The connected Galaxy's Sent list updated live
from Awaiting acceptance to Delivered and then Viewed as the disposable recipient
accepted and opened its preview in the Android emulator. Privacy/help text now
describes these receipts. Public HTTPS testing remains possible in the dev app
against a deployed backend; laptop-only snapshots cannot be resolved by public
Firebase Hosting.

## Release follow-up

Phone acceptance is complete. Review/split commits, push and PR/merge as requested.
Deploy the updated `workoutSharing` callable and sharing Hosting before enabling
program links in a release. Existing rules/indexes/retention collections suffice;
no new public database access is required. Publish the updated `doc/privacy.md`
to the public policy page. Real HTTPS/Play-signed opening remains a deployment
and subsequent AAB check; local custom-scheme checks do not establish it.
