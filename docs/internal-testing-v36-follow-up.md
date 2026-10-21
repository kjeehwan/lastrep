# Internal testing v36 follow-up

October 21, 2026. Production 1.0.1 (36), built from merged PR #44. The unrelated
obsolete Trello export was removed separately in PR #45 after the build started.

## User-reported Play checks

- Identity borders, Workout set visibility and input theme updates passed.
- Health Connect passed on the user's phone. On the wife's phone, Connected now
  appears and a newly recorded sleep entry imported successfully. Historical
  sleep/body records remain a separate investigation: their presence in Health
  Connect and age are not yet confirmed.
- Signed-in state and Workout/Nutrition records survived reopening.
- Photo Save took approximately six seconds. This is a perceived production
  duration, not a stage timing. It is not directly comparable to the earlier
  same-photo dev timing pair; production latency remains an investigation item.
- A monthly subscription on an account without a permanent grant restored with
  the correct active-Premium message. After cancellation and the reported expiry,
  Premium disappeared, but Restore repeatedly reported active/unconfirmed access.
  The active restoration path passed; the expired-subscription feedback did not.
- The disabled Saved button still appeared ambiguous to the user. The subsequent
  brief inline confirmation revision was approved in dev review.

## Local follow-up

- Profile has no save control/status when opened clean, and an actionable Save
  button when edited. Saving remains a distinct disabled action with visible
  progress. After confirmed success, Save disappears and an inline checkmark with
  Changes saved appears for four seconds. New edits or leaving clear it early.
  Failed saves retain the draft/Save action. Loading/failed loads do not claim saved.
- Explicit Restore invalidates SDK customer-info cache before the restore request.
  It excludes products whose recorded expiration is at or before the response
  time, even if the SDK active-subscription list still contains them. Product
  dates support base-plan identifiers; matching entitlement dates are a fallback.
  Missing/invalid dates are not treated as expired; backend confirmation is still
  required before reporting restored access.
- The response's request date supplies the reference clock where valid, avoiding
  the phone clock being ahead. Elapsed confirmation time is included, so a product
  that expires during backend confirmation is not reported as restored.
- Cancellation alone does not mean expiry: a subscription remains restorable
  through its paid period. The backend remains the authority for Premium access.
- Health help now briefly explains sharing from compatible health/scale apps
  (Samsung Health, InBody, OntoFit as conditional examples), the sleep window and
  latest-only body import. It does not promise every app exports every metric or
  older records. The main Profile instruction remains a single short sentence.
- The user approved keeping the current photo path after timed dev saves of
  2.89s, 1.90s just after reopening and 2.71s on immediate repeat. These do not
  explain the intermittent slower observations or establish production stages.

The stale-list case reproduces the misleading message in a unit fixture. The
actual production SDK payload was not captured, so its precise cause is not yet
proven. These changes require a Play-installed expired-subscription retest; a dev
build cannot validate production billing. The user subsequently authorized the
review, split commits/push, PR/merge with CI and fresh-Doctor AAB sequence. Backend
deployment and Play submission remain separate actions; no photo backend change
is planned.

References: [RevenueCat caching](https://www.revenuecat.com/docs/test-and-launch/debugging/caching),
[Customer information](https://www.revenuecat.com/docs/customers/customer-info).

## Verification

Health-history investigation: the current sleep reader requests the past 30 days
and pages through the results on initial import. Body sync reads only the latest
Weight/BodyFat/LeanBodyMass records, and direct Samsung Health also reads a latest
snapshot. Profile prefers the direct Samsung path when it is authorized; it does
not combine both providers in one Sync now. Health Connect body access currently
requires all three measurement read permissions. Do not infer a successful body
import from the Connected label or a successful sleep import. Source-app sharing,
record visibility/age, granted types and the selected body provider need checking
if a recent measurement fails to import. Full historical-body import and changes
to provider selection are outside this feedback/restore release.

Android documents a default restriction on reading other-app data older than
30 days before the first permission grant unless history access is requested:
[historical reads](https://developer.android.com/health-and-fitness/health-connect/read-data).

Fresh TypeScript, lint, web export and 657 unit tests passed; 22 emulator-dependent
tests were skipped. A standalone dev APK built and installed on the connected Android phone.
Before replacing it, Profile was confirmed clean without an enabled Save action.
The initial updated Profile displayed a checkmark/status without a Saved button, and
the runtime log showed no observed unhandled errors. No account, workout,
nutrition, photo or health-permission writes were performed during this check.
Production v36 remains installed unchanged. A Play-installed billing retest
remains pending. The user subsequently
replaced the persistent status design with the brief after-save confirmation
described above; the earlier native result does not verify that revision.

After that revision, TypeScript, lint and 19 focused Profile checks passed.
The final standalone dev APK was rebuilt and installed. Native inspection of
clean Profile confirmed neither Save/Saved nor a success message was present.
No real profile edits were saved for this check. The user subsequently approved
the brief confirmation. The earlier full
suite/web results precede this presentation-only revision.

Final release-preparation checks were rerun after the inline confirmation and
Health help revisions: TypeScript, lint, Android configuration verification, web
export and 657 tests passed; 22 emulator-dependent tests were skipped. A fresh
standalone dev APK built and installed without resetting app data. Native help
inspection confirmed conditional scale-app examples and the current sleep/body
import limits. No source-app permissions, health sync or account writes were
performed during this inspection. These checks do not establish historical-data
coverage or prove expired-store restoration on the next production build.
