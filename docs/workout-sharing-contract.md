# Workout sharing contract and release checks

Last checked: October 27, 2026. Merged in PR #61 and deployed. See the live
verification record below for current coverage and remaining Play-build checks.
The [approved study](workout-sharing-study.md) records the UI decisions.

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
