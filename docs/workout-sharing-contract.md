# Workout sharing contract and release checks

Sharing was merged in PR #61 and deployed. See the live verification record
below for coverage and remaining Play-build checks. The
[approved study](workout-sharing-study.md) records the UI decisions.

## October 28 visual follow-up

Edit workout uses the active Workout title's editorial font, 26-dp size,
32-dp line height and 600 weight. Workout sharing groups its header title and
circled i together, keeping Close at the trailing edge. No sharing handlers,
deliveries or active-workout data are changed by this layout adjustment.

TypeScript, focused lint and nine sharing tests passed. Android 16 local demo
checks confirmed the help placement and the serif title in a synthetic Sent
workout's editor; no workout was sent or imported. Galaxy Android 13 also
confirmed the help button sits beside the header title.

## Identity, delivery and privacy

Sharing within Lastrep is off by default. A user chooses an optional unique
username before enabling it. Saving the username does not enable sharing.
Profile and Settings edit the same username. Nickname remains a separate display
name. Search exposes only enabled users' nickname and username, never their email
or profile photo. Turning sharing off hides discovery and prevents new deliveries;
it does not delete existing history or imported copies.

One send creates an immutable plan snapshot and one independent delivery per
recipient. Recipients do not see one another. A first-time sender creates a request;
accepting allows future deliveries directly into Inbox. Decline imposes a seven-day
cooldown; block persists separately from history. Receiving never imports a workout
automatically. Imported routines are idempotent for the same snapshot. Deliberately
sharing the same plan again creates a new delivery and is allowed on any day.

The native client persists the request ID and creation time before dispatch. A
retry after an uncertain response uses the same identity. The backend stores the
result transactionally and rejects reuse for different content or recipients.
Expired send intents cannot recreate a delivery after their receipt has expired.
Authentication and expected-account guards protect asynchronous account changes.

## Plan contract

`src/sharing/sharingContract.ts` is canonical; the functions build prepares an
identical copy in `functions/src/workoutSharingContract.ts`. The deployment build
can consume this prepared copy without access to the native source tree.

The strict allowlist includes title, effort scale, exercise name/mode/units,
weights, reps, target effort, set types, rest, tempo, deliberate instructions and
cardio duration/distance/session type/effort. Weights are canonical kilograms and
distances canonical kilometres; display units are preserved separately. Target
effort is canonical RPE even when displayed as RIR. Unknown fields are rejected.

Exercise-level `targets` optionally contains nullable `minReps`, `maxReps` and
`targetRpe`. Both rep endpoints must be provided together as whole numbers from
1 to 100, with minimum no greater than maximum. Target RPE is 6–10. These defaults
stay separate from per-set prescriptions and recorded effort. Plans without the
new field preserve their previous serialized shape; clients predating targets
reject plans containing this field and need an app update to open them. Existing
plans without targets remain readable.

Personal exercise notes, logged effort, completion marks, workout history, health
data and account identifiers are not part of the shared plan. Include weights off
removes weights from the actual outgoing payload. Import creates fresh exercise
identities, unchecked sets and empty actual effort; prescribed target effort stays
separate. Editor changes never write to the active workout, its timer or its draft.

## Retention and initial abuse limits

The user approved **30 days** for Requests, Inbox, Sent and external links. Each
delivery has its own expiry. Reusing or refreshing a snapshot does not restore
access through an old expired delivery. A refreshed external link starts another
30-day window. Imported routines/workouts remain independent until deleted.

Expiry is enforced on preview/import and list queries immediately. Physical
deletion is asynchronous. A scheduled worker runs every 15 minutes, processing up
to 100 expired Inbox entries per run. Foreground and Inbox opening also request
bounded cleanup. Inbox cleanup is transactional: it updates badges exactly once
and removes only the matching pending-sender relation. It cannot recreate settings
for an account being deleted. Accepted-sender and block relationships are retained.

**Do not enable Firestore TTL on `sharingInbox`.** TTL cannot maintain its counters
or relationships. Counter-free snapshots, Sent entries, links, receipts and quotas
have prepared TTL policies in `firestore.indexes.json`. Monitor cleanup backlog and
increase worker throughput before activity exceeds its capacity. TTL deletion can
lag expiry; see [Firestore TTL](https://firebase.google.com/docs/firestore/ttl).

Initial implementation defaults, adjustable after observing actual usage:

| Control | Limit |
| --- | --- |
| Recipients per send | 10 |
| Attempted recipient deliveries per account per UTC day | 100 |
| Newly created in-app snapshots per account per UTC day | 50 |
| External-link creation/refresh calls per account per day | 20 |
| New pending senders per recipient per UTC day | 20 |
| People searches per account per minute | 30 |
| Public snapshot reads per token per minute | 120 |
| Exercises / sets per exercise | 40 / 40 |
| Serialized plan | 48,000 JavaScript characters |

Retries with a completed receipt do not spend the daily delivery quota twice.
Unavailable, blocked and pending recipients do not create another delivery.
The user approved the retention duration; the other numbers are initial engineering
defaults rather than separately approved product promises.

Account deletion removes discovery, username claims, snapshots, bearer links and
references held by other accounts. Previously imported copies remain independent.
The existing `deleteMyAccount` function must be updated along with sharing.

## HTTPS link preparation

Firebase Hosting serves only `hosting/workout-sharing`, not the Expo web export.
The production sharing host is `lastrep.web.app`; no purchased domain or Vercel
connection is needed. New links use `/w/<opaque-token>` and display a read-only plan using
the public bearer-token snapshot operation. The small same-origin
`/api/workout-sharing` rewrite targets the callable in `asia-northeast3`.

The page renders sender text with `textContent`, has no analytics or third-party
scripts, disables indexing/cache/referrers, and sets a restrictive CSP. New tokens have 192 bits of randomness and use 32 URL-safe characters. Older 64-character test links remain readable. A token in
the URL is a bearer capability: anyone holding it can view that plan until expiry
or revocation. It must not be pasted into logs, analytics or tracked examples.
Messages and Email create drafts; the user sends them. Neither creates in-app
Sent history. The page does not import anything or automatically launch the app.

`/.well-known/assetlinks.json` contains the public SHA-256 signer certificate read
from the Play-installed production APK, not the upload key or source-stamp signer.
The production flavor and Expo config claim only this host's `/w/` and legacy `/shared-workout`
paths. The dev package does not claim production links. The association JSON must
be served as JSON over HTTPS with no redirect; see
[Android App Links](https://developer.android.com/training/app-links/configure-assetlinks).

Until deployment is verified, native link generation uses its custom-scheme
fallback. After authorized Hosting deployment, set
`EXPO_PUBLIC_WORKOUT_SHARING_URL=https://lastrep.web.app` in the intended
production build environment. This is a public URL, not a secret. Do not enable it
in a build before the destination is live. Keep local QA pointed at demo Firebase;
never switch a synthetic account to production by changing this URL alone.

## Verification and deployment order

Local automated checks cover payload allowlists, retry identity, account changes,
identity races, opt-out discovery, multi-recipient isolation, accept/decline/block,
quotas, snapshot access, revocation, account deletion, 30-day expiry and imported
copy preservation. Rules tests exercise owner-only reads and server-only writes.
Landing-page tests cover token parsing, omitted weights, unit/RIR conversions,
safe rendering and unavailable versus retryable failures. A local HTTP proxy
retrieved a real synthetic snapshot from the callable emulator and rejected an
unavailable token. Production-flavor manifest merging succeeded without creating
an APK/AAB; the expected host/path/filter survived the merge.

Native checks use isolated synthetic Firebase accounts. They include requests,
accept/read badges, multi-recipient sends and double-tap protection, Sent editing,
active-workout isolation, link import, exact units/rest after reopening, enlarged
text, keyboard visibility and outside dismissal. User phone acceptance remains a
separate gate. Desktop browser automation was unavailable in this session, so the
new hosted page has not had a visual browser review. The Android emulator cannot
substitute for a deployed HTTPS association check.

Fresh results on October 26:

| Check | Result |
| --- | --- |
| Ordinary suite | 789 passed; 40 emulator-dependent cases skipped |
| Sharing transactions, retention and security rules | 33 passed separately against local Firestore |
| Existing sleep-persistence regression cases | 7 passed separately against local Firestore |
| Backend build / generated contract parity | Passed |
| TypeScript / lint / whitespace checks | Passed |
| Native configuration verification / production-flavor manifest merge | Passed |
| Web export | Passed |

The first final native send exposed an old local function worker that had not
reloaded the new retention code. That worker was restarted without clearing
emulator accounts or records. The repeated Galaxy send was verified in Firestore:
one recipient delivery, with exactly 30 days between creation and expiry. Local
HTTP preview checks were repeated successfully against the restarted worker.
Phone checks also confirmed the 30-day help text, valid-link preview, unavailable
link guidance and the corrected landing page. The phone is left on the isolated
sharing editor with synthetic data for user review.

October 27 UI follow-up: the disposable Android emulator was reset to recover
storage and rebuilt with the current x86 dev APK. With local-only accounts,
emulator and Galaxy checks covered Review title spacing, the isolated editor's
card margins and Demo / Rest / Tempo spacing, Workout-style Add exercise and
Tempo controls, Rest interval choices, inline Replace Close alignment, and
the send-result status card. A second local send to a pending recipient showed
Request pending without making another delivery. Current TypeScript, targeted
lint and sharing unit checks pass (16 passed, 8 skipped). A direct Android
custom-scheme intent opened the dev app; tapping the same kind of link in the
user's messaging app did nothing. Treat messaging-app opening as unverified
until the HTTPS app link is deployed and tested. User visual acceptance of the
latest phone UI remains pending.

The subsequent spacing review removed inherited top rules, aligned the plan
panel with its actions, labeled the title field and added explicit nested-control
gaps. Inline Replace uses an X. Six repeated tab switches kept the header,
popup and list bounds identical on Galaxy portrait and emulator portrait and
landscape; tab results remain visible from their own cache while refreshing.
TypeScript, targeted lint, whitespace and the 16 sharing unit checks passed
after these changes. User visual acceptance of this refinement remains pending.

Before deployment, review the final diff and obtain the user's phone acceptance.
On explicit deployment authorization:

1. Deploy Firestore rules/indexes/TTL policies. Wait for required indexes to be
   ready, including collection-group queries used by cleanup and deletion.
2. Deploy `workoutSharing`, `syncSharingNickname`, `expireWorkoutSharingInbox`
   and the updated `deleteMyAccount`. Confirm scheduler creation, region, access
   and actual cleanup/counter behavior in the intended project.
3. Deploy Hosting. Verify its JSON association, headers, callable rewrite and
   valid/revoked/expired links over the public HTTPS address. Measure real usage
   and set appropriate budget alerts; Hosting costs exclude database/functions.
4. Enable the public URL in the intended app build. Only after the separate build
   request, run a fresh Expo Doctor and normal release checks before an AAB.
5. With the updated Play-installed app, verify OS domain association and link
   opening from Messages/Email, including cold start, signed-out continuation,
   existing-workout conflict and the app-not-installed web/store fallback.
6. Test real sharing between two disposable production accounts. Update the
   published privacy policy from `doc/privacy.md` before public use.

Local emulators do not run Firestore TTL or Cloud Scheduler. Direct expiry tests
prove transaction behavior, not successful provisioning of those cloud services.
No deployment, commit, push, merge or production AAB is part of this local check.


October 27 final review: user approved the latest native sharing UI. Fresh
TypeScript, lint, backend build, native configuration and web export passed.
The ordinary suite passed 790 tests (40 emulator-dependent cases skipped);
18 sharing transaction, retention and security-rule tests passed separately
against isolated local Firestore. The short HTTPS route now uses the same
notebook dialog theme and tab-free spacing as the legacy shared-workout route.
Real two-account sharing, public HTTPS previews and OS domain association remain
post-deployment checks; native local tests do not establish those outcomes.


## October 27 deployment and live verification

PR #61 merged as `d644ba2`; PR and post-merge CI passed. Four focused commits
separate the browser study, backend/HTTPS support, native integration and docs.
The fresh ordinary suite passed 790 cases; all 40 emulator-dependent cases then
passed separately (18 sharing transactions/retention/rules and 22 existing
rules/sleep regressions). TypeScript, lint, backend build, native configuration,
web export and whitespace checks passed. These results precede the live tests.

Production project deployment is complete: all required indexes are ready and
eight counter-free TTL policies are active. The sharing callable, nickname sync,
expiry worker and account-deletion update are active. The expiry schedule is
enabled every 15 minutes; read-only logs confirmed ten successful automatic
executions. Inbox expiry remains transactional. No manual cleanup-job run was
performed. Actual expiry deletion/counter cases also passed local emulator tests.

Live tests used three newly created disposable accounts and synthetic plans.
A separate QA Hosting site and a local dev APK used a dedicated test-domain
association, without changing the production domain's package/signature claim.
A temporary auth-storage namespace preserved the ordinary dev sessions. A
standalone, locally built dev APK was used for cold-start checks because the
Metro dev client stopped at its development-server chooser. No EAS build or AAB
was started. All QA-only configuration and credentials stay outside tracked code.

Verified against the deployed backend and native phone/emulator:

- Default-off sharing, username uniqueness, saving identity without enabling,
  enabled discovery and discovery removal after opting out.
- Native multiple-recipient send, independent request deliveries, request badge,
  acceptance, Inbox preview/read state and routine import/application. Recipient
  records omit the other recipients; personal exercise notes are excluded.
- Deliberate repeat delivery to an accepted recipient, no repeated pending request,
  double-tap protection and concurrent same-ID retry producing one delivery.
  Reusing a send ID for different content is rejected.
- Decline cooldown, persistent block across opt-out/on and counter updates.
- Set types, weights, repetitions, target effort, rest and tempo preserved;
  repeated routine import reuses the existing routine. Editing a Sent copy leaves
  the active workout and original snapshots unchanged. Include weights off
  removes weights from the actual outgoing payload.
- Both public production and QA HTTPS rewrites return the valid read-only plan.
  Android verified the QA domain on both devices. Chrome rendered the preview;
  its Open in Lastrep action opened the native preview.
- A received emulator-only SMS opened the correct workout from a cold standalone
  app start. A signed-out cold start allowed read-only preview; signing in resumed
  that same workout without importing automatically.
- A distinct incoming plan's Keep action preserved the current workout. Replace
  applied it with one confirmation, and the new draft survived reopening.
- Native Messages and Gmail drafts contain the correct title and HTTPS link; no
  real message/email was sent. The synthetic Gmail drafts were discarded and
  the synthetic Samsung Messages draft content was cleared.
- With the dev package disabled, Chrome still displayed the plan and Open in
  Lastrep reached Google Play's sign-in screen. The package was then re-enabled;
  its saved data was retained. A signed-in store listing was not checked.
- Native revocation rejects the old link in the app and production HTTPS, while
  the recipient's imported routine remains. A separately created link, aged only
  after verifying its disposable owner, is rejected as expired by the production
  service and shows unavailable guidance in Chrome.

After explicit user approval, all three disposable live accounts were deleted
through the normal account-deletion callable. Deleting the sender removed hosted
links and incoming sharing references and reset recipient counters, while the
recipient's imported routine remained intact until that recipient account was
also deleted. Normal dev APKs and the original local-demo sessions were restored;
temporary auth configuration was removed from source.

Final Play-installed checks remain: production certificate/domain verification,
received-email link tapping, the signed-in store listing/install-and-return path,
and a short real-sharing smoke test in the released package. QA domain verification
is not verification of the Play-signed production APK. Publish the sharing changes
from `doc/privacy.md` before public use, and enable the public HTTPS URL in the
intended production build environment. A fresh Expo Doctor is required before
any separately requested AAB build.


## Short production address (October 27)

The available Firebase site ID `lastrep` was claimed in the existing project.
New production links use `https://lastrep.web.app/w/<opaque-token>`. The Hosting
`sharing` target selects this site explicitly; the previous project-default
host stays online. Production Android filters accept both hostnames, and the
Play signing association is served directly from the new host. QA keeps its
separate domain and the current review account/link; no review data is removed.

EAS production configuration now includes the new public URL. Local production
builds must set the same environment value explicitly. No AAB is started by this
configuration change; the installed production app gains the updated filters
only after its next build/update.


## Approved follow-up release preparation (October 27)

The user approved the clearer Google Play button, normal paragraph wrapping and
numeric effort placeholders, and confirmed publication of the updated Notion
privacy policy with an October 27 effective date. Phone verification preserved
the review account and draft. Numeric RPE/RIR targets remain muted placeholders,
with target context retained for accessibility; recorded effort stays separate.

Fresh release checks passed TypeScript, lint and 790 ordinary tests (40
emulator-dependent cases skipped). Latest Expo Doctor passed all 20 checks with
the documented tracked-native exception. A separate final Doctor check is required
after merge before the authorized local production AAB starts. The current review
setup remains available until the release batch is complete.
## v43 Play review and UI follow-up (October 27)

The user confirmed real in-app delivery, production HTTPS links opening the
Play-installed app, applying a shared workout, matching Health Connect steps,
and reopening successfully in v43.

Follow-up UI changes on `fix/sharing-release-polish`:

- Settings gives sharing a larger trailing switch with themed on/off tracks,
  people and username icons, and the standard information button for its help.
- Existing-workout choices use vertical full-width notebook actions: outlined
  Keep, primary Add, and danger-outlined Replace. Import behavior is unchanged.
- The shared-link route uses the notebook header, typography, themed status bar
  and clear primary Open / secondary Home or Sign in actions, including an
  unavailable-link state.

Fresh TypeScript, lint, web export and 20 targeted checks passed; 8 automated
emulator-dependent checks were skipped. Android 16 emulator checks used only
local demo accounts and a synthetic plan: light/dark controls, help, preview
close/reopen, landing page, applying the plan and the existing-workout choices.
Keep preserved the test draft. Samsung Android 13 checks confirmed Settings
icons/switch/help and the link landing page at the phone's current text size.
The existing synthetic hosted review link was opened without importing it on
the phone. The user approved the shared-link page and the final smooth switch
behavior on the dev app.

The user approved the link landing page. A switch bounce was then reproduced
from its server-controlled value: the native thumb moved before the asynchronous
save updated the value. Settings now holds an account-scoped pending switch
position until the request settles. This is a visual preview; saved settings and
backend access rules remain authoritative. Android 16 emulator checks with an
intentional six-second local-only delay confirmed stable pending on/off positions,
repeat-tap prevention, successful completion and rollback with feedback after a
simulated failure. The emulator's delay routing and setting were restored afterward.

## Nickname word search follow-up (November 26, 2026)

The pending change adds bounded `namePrefixes` to sharingDirectory entries,
allowing Alex or QA Alex to find Program QA Alex. Existing username/full-name
prefix queries stay available during rollout; results are deduplicated and
bounded by the existing limits. Sharing-off still removes the directory entry.
Identity saves and the syncSharingNickname trigger both regenerate prefixes.

Before rollout, build the backend and deploy workoutSharing plus
syncSharingNickname. Refresh existing entries using operator credentials:

```powershell
node functions/scripts/refresh-sharing-name-index.js --project=lastrep-ebac5
# Review aggregate dry-run counts, then apply the same refresh:
node functions/scripts/refresh-sharing-name-index.js --project=lastrep-ebac5 --apply
```

The refresh only updates existing directory entries after transactionally checking
current sharing consent, live account state and username identity. It does not
create entries, enable sharing or alter workout/health records. It is repeatable
and emits counts rather than identities. Single-field array indexing is used;
no composite index is required. Existing privacy wording covers nickname search;
there is no new provider or additional user input.

Verification: three prefix-index unit tests and all 103 disposable Firebase
boundary tests passed, including legacy-index refresh, dry-run, duplicate
results, word/phrase prefixes and opt-out behavior. Backend build, application
TypeScript and lint passed. Production deployment/index refresh remain pending.

## Shared-plan readability and QA authorization (November 26, 2026)

- Native workout previews render Top and Back-off sets separately, numbering
  repeated roles. Identical ordinary sets retain their existing compact summary.
  Exercise headings, target summaries, rest/tempo, instructions and set rows
  use separate spaced groups, with additional space between exercises. Program day
  workout previews reuse the same component. Hosted previews are unchanged.
- The user authorized processing their incoming test-sharing requests on the
  task-created QA accounts: accepting the request and inspecting its snapshot
  and role/target data. This does not authorize processing unrelated requests or
  importing/modifying personal workouts, routines or health records. Keep test
  account credentials and delivery identifiers in ignored local fixtures.
- Accepted the older pending sender request on the QA recipient. A newer send
  attempt while a sender request is pending returns awaiting-acceptance without
  a new delivery; the user was asked to resend after acceptance. After the user resent it, the incoming snapshot was verified: one Top and
  two Back-off sets, exercise targets and a Back-off target override all
  arrived intact. No personal workout was imported or changed.

Connected-phone verification: the dev package rendered the received synthetic
Top/Back-off workout using the updated component. Both Back-off rows were
separate and readable after scrolling the preview; target/metadata/instruction
groups were spaced apart. No workout or routine was imported. Target-editor
labels have compile checks but no new phone editor review in this pass.

### Received-workout layout follow-up

The received workout uses its name once in the modal header, followed by the
sender. Back to Sharing is a header control; Close still dismisses sharing.
The footer keeps Use for a new workout and Save to My routines. Other sharing
steps retain their existing navigation. Exercise blocks use the modal surface
with fine separators, compact guidance and aligned read-only set labels and
prescriptions. Instructions follow the sets; long instructions expand using an
Instructions row. Enlarged text and narrow screens stack prescription fields.
A structured presentation helper retains grouping, units and target effort;
no snapshot, import or persistence contract changed.

Verification: 13 focused sharing tests, TypeScript, affected-file lint and diff
whitespace checks passed. On the connected Android 13 dev app, inspected the
received synthetic workout, scrolled to its instructions, returned to Inbox,
reopened it and opened/closed sender options. No workout/routine was imported
or changed. Dark mode, enlarged text and long-instruction expansion were not
newly checked on a device in this pass. These UI changes are not in v50.

### Read-only set tables (November 26, 2026)

Supersedes the compact grouped prescription rows above: every native preview set
now has its own row. Numbered exercise headings precede target summaries,
rest/tempo, instructions and the table. Resistance headers are Set / kg or lbs /
Reps; cardio headers are Set / Duration / Distance (km or mi). Markers match the
workout log: numbers, W, T, B, D and F. Each Set header opens the marker explanation when tapped; a dotted underline
indicates this action without a separate help icon. Units are not tappable.

The active account's user-document weightUnit and distanceUnit preferences drive
presentation conversion only. The subscription is scoped to the dialog UID,
cleared from view on account changes and unsubscribed on dismissal; a failed or
unsigned preference read falls back to the snapshot's units. Snapshot and imported
workout data are unchanged. A Target RPE/RIR column appears only for explicit set
targets differing from applicable Normal/Top/Back-off guidance; missing set effort
is not filled from that guidance. Long instructions remain expandable above the
sets. Horizontal scrolling preserves columns on narrow/enlarged-text layouts.

Validation: 17 focused sharing tests cover individual rows, markers, group target
comparison, missing effort/load, unit conversion without source mutation and
cardio duration/distance. TypeScript, affected-file lint and whitespace checks
passed. Android 13 phone review used the six-exercise synthetic received workout:
set help, numbered exercises, individual Normal/Top/Back-off/Drop rows and
instruction expansion/collapse. No workout/routine was imported or edited.
Alternate preferred units and enlarged text have model/code checks, not a new
phone settings review. Hosted browser previews are unchanged.

### Guidance chips and workout totals

Target summaries use quiet rectangular chips with the notebook subtle background;
rest and tempo form a separate wrapping row of chips. All table columns, including
Set, have equal widths, with headers and numbers centered. Tapping Set is supported
on every exercise. Instructions remain before the table.

A summary above the first exercise shows working resistance-set count and planned
load-times-reps volume in the recipient's preferred weight unit. Warm-ups and cardio
are excluded from both totals. Any absent working-set weight suppresses the whole
volume total and shows Weights not included; explicit zero loads remain zero.
No shared snapshot, import or record is mutated by these presentation changes.
Twenty focused tests passed, including totals, partial/missing weights, zero loads,
canonical-unit conversion and source preservation. TypeScript and lint passed.
Connected Android 13 dev-app review confirmed the six-exercise sample totals
(14 working sets, 3,992.5 kg planned volume), guidance chips and the Set-header
explanation opening/dismissing. No workout or routine was imported or modified.

### Workout-screen follow-up

Workout target summaries and sharing previews now reuse NotebookGuidanceChip.
Workout kg/lbs headers open an exercise-specific unit choice using the existing
canonical-weight display conversion and draft unit persistence. Effort headers
open an RPE/RIR choice labeled as applying across Lastrep. This writes only the
user effortScale field; existing profile subscriptions update the other screens.
Opening and canceling either choice changes no preference. Keyboard dismissal
precedes selection; duplicate effort saves are guarded and errors retain retry.
Both selections check the signed-in account again before applying. No record,
target or historical effort is rewritten; Sharing's read-only unit behavior stays
unchanged. Alternate Load/Effort actions remain available with enlarged text.

Verification: TypeScript and affected-file lint passed; 27 focused effort, target,
set-presentation and sharing-table tests passed. Connected Android 13 review
confirmed quiet target chips, column alignment and both weight/effort choices with cancellation.
Actual unit/effort selection was not tested against the user's saved draft/profile;
preferences and set values were left unchanged. Search deployment/index refresh
remain pending, so Alex word search is not yet available in the deployed backend.

The unit/effort header dialogs now use WorkoutDisplayChoiceSheet with the same
WorkoutChoiceChips component as the exercise three-dot menu. Selection is conveyed
by filled/background and contrasting text colors plus accessibility selected state;
labels no longer append (current). Choices apply on selection, with Done closing
the sheet. The effort sheet explains RPE 6-10 and RIR 0-4 and their endpoints.
It retains account checks, disables repeat selection/dismissal while saving, and
shows retryable errors inline. The modal is included in native set-edit suspension.
Native Android 13 review confirmed selected/unselected colors and no (current)
suffix in both new sheets, weight-sheet Done dismissal and the revised effort
explanation. Preferences were left unchanged; actual selection writes were not
exercised against the personal account. Twenty focused effort/target/set tests,
TypeScript, affected-file lint and whitespace checks passed.

### Cardio unit header, row numbers and optional rest

Cardio km/mi opens the same exercise-specific choice sheet as resistance kg/lbs.
All unit selectors are removed from the exercise three-dot menu. Shared-plan
editing retains its isolated local unit-selector path through the same card
headers; received previews remain read-only. Canonical distance values are
unchanged by presentation-unit switches. Cardio displays ordinary numbered rows,
including a single continuous bout as Set 1, without changing stored set types.

Newly built cardio uses an explicit existing plannedRestSec value: remembered
exercise rest or prior saved rest when available, otherwise zero. Existing drafts
and routine prescriptions are not migrated. Cardio's timer sheet includes Off;
zero rest shows Rest inline, disables Start and never requests/schedules an alert
on completion. Switching an active timer to Off cancels it. Configured durations
retain normal interval completion behavior. Resistance defaults remain unchanged.

Verification: TypeScript, affected-file lint, whitespace checks and 36 focused
workout/sharing tests passed, including disabled/stale rest-clock cases. The
existing emulator failed ADB authorization and was stopped without restarting the
phone's ADB server. Phone verification instead used a temporary isolated route
mounting the real Workout card, unit, options and rest-sheet components with
synthetic in-memory state and no Firebase/draft/notification writes. Verified
numbered rows, km-to-mi display conversion, no menu unit selectors, Rest Off,
configured Start, switching back Off and completion without starting rest, plus
adding a third numbered row. This verifies native components, not a real saved
workout's full persistence/background-alert flow. The route was removed after
returning to normal Workout; source/screenshots remain ignored in .dev-tools.
No personal workouts, health records, unit preferences or effort preferences were
edited. Enlarged-text distance switching has code review, not a new device check.

The Rest Off option is now shared by resistance and cardio. The timer sheet no
longer gates Off by exercise mode. Existing zero-duration guards, alert cancellation
and zero-clock tests apply to both; resistance default durations are unchanged.
The compact Rest label is used for stopped zero-duration clocks in both modes.
Nine timer tests, TypeScript, affected-file lint and whitespace checks passed.

### Final delivery review ? November 26, 2026

Final review removed the obsolete grouped-set formatter and moved its coverage to
sharingSetTable, the model used by the active preview. All 1,047 unit tests passed;
104 environment-gated tests were skipped in that run. The separate Firebase
boundary run passed 103 tests without skips. Functions build, TypeScript, full
lint, Android native verification and web export passed. One concurrent run timed
out in an unchanged SVG raster test; the full standalone rerun passed.

Architecture review confirmed canonical values and shared snapshots are preserved,
exercise units remain draft-scoped, effort preference remains account-scoped, and
nickname indexing respects existing sharing opt-in. Production rollout requires
both workoutSharing and syncSharingNickname plus refreshing existing directory
entries. The production dry run found seven existing entries requiring refresh;
no directory writes occurred during that check. Device coverage and remaining
persistence/background-alert limits are recorded above.
