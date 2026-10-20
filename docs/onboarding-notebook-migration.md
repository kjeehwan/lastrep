# Onboarding Notebook Native Migration

October 20, 2026. Merged in [PR #41](https://github.com/kjeehwan/lastrep/pull/41)
as `fc6a00c`, following Auth PR #40 (`502934d`). Overall native appearance received
user approval on October 20. The feature branch was deleted after the authorized
merge. Main's [post-merge Quality Checks](https://github.com/kjeehwan/lastrep/actions/runs/39279615605)
completed successfully, including backend build, lint, tracked Android
configuration verification, unit tests and Expo web export. Earlier queued status
has cleared; no cancellation, rerun or support escalation is needed.

Cross-screen release verification is next. Production billing remains unverified
in a Play-installed production build. Deployments and AAB builds still require
an explicit request. Historical verification sections below retain their original
scope and do not establish coverage for later changes.

## Scope and approved flow

Experience, Availability, optional Nickname, then Optional health sync. The
flavor-aware logo sits upper left, with Back and Skip below on one row. The
header and content share one scroll surface with safe-area padding, notebook
light/dark typography, restrained rules and accessible targets.

Availability uses a discrete 1-7 slider, default four, visible count and ticks;
no plus/minus controls. Back retains selections. Nickname Continue stays enabled
when empty. Health sync explains permitted records, account storage, optional
connection in Profile, revocation and the separate AI disclosure. Setup does not
request permissions or connect health services. Go to Home and final Skip both
complete setup. No goal question, sample program or artificial save-error step.

Legacy goal redirects to Experience; preview and splash-after-preview redirect
to Health. These aliases preserve old links without retaining the old product
screens. No training/diet phase or start date is assigned. Existing goal/phase
history remains; phase-start correction is still postponed.

## Persistence and routing

- New account creation uses an awaited transaction to initialize explicit
  `onboarding: { version: 1, completed: false, step: "experience" }` progress.
  It does not assign the previous default goal. Retrying registration preserves
  an existing profile and checkpoint instead of overwriting them.
- Each Continue/Skip transaction merges the current answer (unless skipped) and
  next checkpoint. Failures propagate to inline feedback and retain the draft.
  A synchronous lock prevents overlapping submissions. Transactions do not queue
  offline writes as successful onboarding progress.
- Empty nickname does not overwrite an existing nickname. Availability preserves
  both the numeric availabilityDays and legacy string availability fields.
  Other profile fields are not included in step writes.
- Drafts and completion caches use `lastrep.onboarding.account.<uid>`; writes are
  serialized and guarded across account changes. Valid local checkpoints resume
  without a network read. The old installation-wide completion flag is ignored.
- Cloud completion wins when a server checkpoint is read; step transactions also
  detect completion from another session and return Home without reopening it.
  A device with an older pending cache may show that step until its next server
  save/check. Native multi-device completion has not been tested.
- Existing accounts without explicit onboarding progress retain Home access;
  optional missing legacy answers do not force setup again. This also preserves
  legacy access when an initial cloud read is unavailable and no checkpoint is
  cached. New accounts normally have both the explicit server marker and local
  cache. Completion no longer depends on a nonempty nickname.
- Auth routes resolve pending checkpoints after sign-in. The startup gate runs
  only while focused, preventing its hidden auth listener from racing new-account
  initialization. The old splash route delegates to the same startup gate.
- Auth token/session behavior remains; this migration changes onboarding routing
  and new-account initialization. The generic saveUserData helper was not changed
  globally; onboarding avoids its swallowed-write-error behavior.

## Verification

Fresh final-source TypeScript, lint, web export and diff checks pass. App suite:
477 passed, 22 emulator-dependent tests skipped; 86 passing files, two skipped.
New tests cover skipped/optional fields, legacy access, account keys, corrupt
cache parsing, pending resume/completion, failed transactions, account changes,
registration retries and new-account progress. Notebook dialog tests cover the
four routes without bottom-tab clearance.

Phone and Metro were checked live. User created a disposable account for native
review. Agent checks passed for:

- New sign-up entering Experience with the latest notebook marker.
- Experience save, slider default four and changing value, Back preserving both
  experience and availability, and empty nickname Continue being enabled.
- Nickname text surviving rotation, with the focused field visually above the
  landscape keyboard. Synthetic nickname text was cleared before advancing.
- Both light/dark nickname layouts and reachable actions; 200% nickname and
  Health actions reached by scrolling. Device display/orientation settings were
  restored. No account-identifying captures are tracked.
- Empty nickname advancing to Health without a permission screen.
- Force-stop/reopen resuming Health with setup incomplete and no error overlay.

After the agent left setup incomplete for review, the user confirmed that Go to
Home and reopening reach Home without repeating onboarding. This verifies native
completion/reopen with optional nickname left available; it does not establish
visual approval of every screen or the final Skip path. Remaining acceptance:
visual review was subsequently approved by the user. User also verified an offline attempt shows inline
feedback, reconnecting permits Continue to Health, and final Skip reaches Home.
Agent force-stop/reopen after that Skip reached Home with no error overlay.
Mid-save loss/retry and native TalkBack-enabled functional checks were subsequently
verified below. Account-switch isolation, native iOS and other-device coverage
remain unverified.
Unit mocks establish failure logic, not native connectivity behavior. No existing
account was edited by the agent; only the supplied disposable account was used.

No commit, push, PR, merge, cloud configuration change, deployment or native build
was performed for this migration. Local screenshots/XML/helpers remain ignored.


## Reconnect feedback follow-up

User reported the inline offline warning remained after Wi-Fi reconnection while
the general banner disappeared. A retry and final Skip both worked. The provider
now derives the visible offline warning from current connectivity once the
network hook is ready. Reconnection hides only that preflight warning; actual
save/load/device-storage errors stay visible, and no save is implied or retried
automatically. Draft and completion behavior is unchanged.

Fresh TypeScript and lint passed after this UI adjustment. The nine onboarding
tests passed during the follow-up; they do not render the provider and therefore
do not verify warning disappearance. A fresh full verification after the subsequent native checks passed on the
final source, including this warning adjustment; see below. User subsequently confirmed that the inline offline warning disappears upon
reconnection, verifying this specific UI fix natively. The previously completed
test account was not reset by the agent. The dev client was reopened through the live
Metro connection and native Home was confirmed without repeating onboarding.


## Interrupted save and native accessibility verification

October 20: user supplied another disposable account, left incomplete, and
explicitly authorized connection-loss and native screen-reader checks.

The initial interruption attempt completed its save before connectivity dropped;
it is not evidence of failure recovery. A deterministic repeat used temporary
dev-only, stage-name-only logging and an eight-second pause after a transaction
read acknowledgement and before its commit. This establishes a loss during an
active save between read and commit, not a lost commit acknowledgement test.
No identifiers, tokens, account fields or photos were included in that logging.

Connectivity was disabled after the read acknowledgement. The pending action was
disabled; the SDK retried reads, then inline failure feedback appeared while still
offline. The same Nickname step and its synthetic draft remained, and Continue
became available. No commit acknowledgement was observed for the interrupted
attempt. After restoring connectivity the draft was still present. Synthetic
nickname text was cleared before retrying; retry reached Health. Setup remains
incomplete, and neither the completed earlier account nor any existing profile
was reset. Original network settings were restored and verified.

A local shell accessibility probe exercised native AccessibilityNodeInfo actions
with Samsung TalkBack enabled and without suppressing its service. The slider
exposed its Training days per week label, current day count and numeric 1-7 range.
Accessibility focus succeeded; forward/backward actions changed one day at a
time, respected both endpoints and returned to four. Back and Skip accepted
accessibility focus. Once the form was ready, the optional nickname field and
Continue also accepted accessibility focus. Earlier probes during TalkBack's
first-run overlay/app loading did not establish these results. One conflicting
diagnostic probe was discarded and the final focus checks were rerun alone.
These are native service-enabled label/focus/action checks, not an independent
listening assessment of speech, gesture-navigation audit or full accessibility
certification.

TalkBack's first-run phone permission was declined, not granted. Its original
denied permission/flags and original accessibility service settings were restored
and checked. The temporary helper did not install or rebuild the Lastrep app.
The device-side helper was removed after testing; host artifacts remain ignored.

The service source was restored byte-for-byte from a hash-checked original;
all temporary logging and the pause were removed. No product-code fix was needed
for either check. Fresh final-source TypeScript, lint, web export and diff checks
pass. Full suite: 477 passed, 22 emulator-dependent skipped; 86 passing files,
two skipped. At the end of native verification, nothing had been committed,
pushed, deployed or built as an app release. Subsequent release preparation is
limited to the explicitly authorized commits, push and PR review.
