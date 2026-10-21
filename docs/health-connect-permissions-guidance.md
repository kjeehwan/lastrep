# Health Connect permissions and connection help

October 21, 2026. Follow-up to Play internal 1.0.1 (38).

The user passed repeated crop/cancel/save, sign-in/reopen, record persistence,
barcode and restore checks in v38. Photo saves still vary (approximately 7-8
seconds, later 2.50 seconds); no latency fix is claimed here.

## Changes

- Profile's explicit Health Connect permissions action requests only missing
  supported read permissions, including when some access is already granted.
- Cancellation/denial leaves the user in Lastrep. A separately tapped settings
  fallback handles reviewing access or a permission prompt suppressed by Android.
- Existing grants use Android 14+ app-specific management; Android 13 retains
  supported provider settings. No unsupported direct management action is invented.
- Sync now continues to report missing access without opening permission screens.
- A visible Connect another health app link explains source-app sharing, write
  permissions, Lastrep read permissions and Sync now, using Samsung Health and
  InBody where supported. It does not promise universal compatibility/backfill.
- General help keeps per-phone permissions and sleep/body import limits. Samsung
  access errors use consumer guidance, without developer-mode or certificate steps
  or raw SDK errors in the UI.

No provider reads, import windows, grant types, storage, account consent or
provider selection rules change. Body access still requires the same three
measurement read types; this does not add independent per-metric syncing.

## Verification

Fresh TypeScript, lint, web export and 671 tests passed; 22 emulator-dependent
tests skipped. Eight new behavioral tests cover partial grants, write-only or
unrelated grants, cancellation/denial, rechecking actual grants, settings and
request failure. The standalone optimized dev APK built and installed.
Native checks passed for the new connection help, the general help and absence
of developer/certificate instructions. With existing permissions granted on the
Android 13 phone, the button opened supported Health Connect settings; Back
returned to Profile. No permission grants/revocations or artificial health records
were used. Partial-access and cancellation branches are verified by automated
tests, not a native permission-reset test.
An earlier shell-only routing probe ran on an Android 16/API 36 Google Play
phone emulator using the installed dev APK. This did not validate app-caller
launch permissions and is superseded by the v39 follow-up below. After initial Health
Connect setup, the exact management intent with the running dev package extra
opened Lastrep Dev's permissions directly, showing Body fat, Lean body mass,
Sleep and Weight reads. No account sign-in, permission grant or health-record
write was performed. This checks the native system route; the full Profile button
was not exercised on the emulator. Its branching is covered by automated tests,
and the Android 13 button was checked on the physical phone. The read-only emulator
session does not reproduce Samsung One UI or direct Samsung Health integration.
The user subsequently authorized split commits, push, PR review, merge, fresh
Expo Doctor and production AAB v39. No backend deployment is needed.

## Popup wording refinement

The user approved plain navigation guidance without Android-version terminology:
Tap Health Connect permissions to review or allow access. If Health Connect
opens its main screen, choose App permissions > Lastrep. General help retains
per-phone permissions and sleep/body import limits, and no longer appends a
Samsung provider warning. Source-app help now says "In apps such as Samsung
Health or InBody" so the examples are not presented as an exhaustive list.
The permission flow and action-specific error handling are unchanged.

After this wording refinement, fresh TypeScript, lint and 34 focused checks
passed. The dev APK rebuilt and installed. Native inspection confirmed the
updated example wording and plain navigation, with the arrow displayed correctly
and no Android-version paragraph, missing-app tip or appended provider warning.
The Health sync help popup was left open for user review.

The user approved the final popup wording. Release-preparation TypeScript and
lint passed, and the full suite passed with 671 tests and 22 emulator-dependent
skips on a fresh run with two workers. An initial image-rendering check timed
out during concurrent emulator startup; its assertions passed on the rerun.
The native emulator routing evidence is stored only in ignored local artifacts.

## v39 follow-up: blocked permissions navigation

The user reported working sync on the second Samsung phone, but neither
permissions nor the extra settings fallback button opened a screen. Connected
and read access did not establish that the navigation action was permitted.

A native probe running with Lastrep Dev's target-app context on Android 16/API 36
reproduced a SecurityException when launching MANAGE_HEALTH_PERMISSIONS: the
provider activity required the system-only GRANT_RUNTIME_PERMISSIONS permission.
Both direct and home actions resolved, so package visibility was not the observed
cause on this emulator. No extra permissions or visibility declarations were
added. The same app context could launch HEALTH_HOME_SETTINGS successfully.
The earlier ADB-shell test bypassed the app-caller restriction and was insufficient.

The app-specific helper now tries ordinary Health Connect settings if direct
management is rejected. The explicit settings fallback has its own general
settings helper instead of calling the rejected app-specific route again.
Missing-read requests, cancellation, grants, consent, provider choice, sync and
saved records remain unchanged. Do not add privileged permissions to bypass the
system restriction or assume an ADB launch verifies an app launch.

The optimized dev APK built and was installed in the emulator. The target-app
context probe replayed direct rejection followed by a successful home-settings
launch against that installed package. The Health Connect UI showed App
permissions. This verifies the native action sequence, not the full signed-in
Profile button on the emulator. No account sign-in, grants or health records
were changed. TypeScript, lint, web export and 41 focused checks passed. The full
suite passed with 678 tests and 22 emulator-dependent skips. The affected physical phone still needs a fixed-build
retest. Production v39 remains unchanged; no commit, push or new AAB is authorized
for this follow-up yet.

### Single permissions action

The user chose to remove the separate Open Health Connect settings button.
Health Connect permissions is now the only permission-navigation control. Its
internal app-specific-to-home fallback remains. After a canceled/incomplete
request or a request error, inline guidance explains that tapping the same
button again reviews access in settings. This subsequent explicit tap avoids
redirecting automatically after cancellation and avoids repeatedly requesting
permissions Android has stopped prompting for. No separate settings handler or
visible fallback-button state remains. The general-settings helper is retained
inside the automatic fallback.
At this checkpoint, the last native APK verification predated this button
consolidation. The October 22 verification below supersedes that limitation.

### Guidance before leaving Lastrep

The user approved a popup before the general-settings fallback, because inline
instructions in Profile cannot be seen while navigating Health Connect. It says:
"On the next screen, choose App permissions → Lastrep, then allow the data you
want to sync." Actions are Cancel and Open Health Connect. The fallback launches
only after confirmation. Cancel, outside tap and Android Back keep the user in
Lastrep without an unavailable-settings error or another fallback launch.
Successful direct app-permissions navigation and missing-read requests skip
this popup. The shared notebook dialog now supports an optional dismissal
callback so these exits can resolve the pending confirmation.

Before this popup revision, the actual signed-in Profile button was exercised
in an isolated Android 16 emulator build with local Firebase test services:
with all reads granted it opened Health Connect's main settings successfully.
The initial Connect flow also displayed Lastrep's native Allow request. After
externally revoking one test permission, the app encountered an input-focus
ANR during return/restart; partial-access return/retry verification remains
incomplete. These results do not reproduce Samsung One UI. Raw artifacts and
fictional local test account data remain ignored in .dev-tools.

For the popup revision, 48 focused tests, TypeScript and lint passed, including waiting
for confirmation, cancellation without navigation, direct-route bypass and
dialog confirmation/dismissal outcomes. The full suite passed with 685 tests and
22 emulator-dependent skips; diff whitespace checks passed. Native popup layout/interaction and
the interrupted emulator journey still need verification. No production build
or release is changed by these local edits.

### October 22: full native popup and recovery verification

Fresh optimized standalone dev APKs built successfully for the connected
Android 13 Samsung phone and Android 16/API 36 Google Play emulator. The emulator
used a separate checkout with fictional local Auth/Firestore data; its five
permission-flow/UI source files matched the normal phone build. Packaged bundles
were checked to keep the demo backend confined to the emulator APK. Neither
production app data nor the physical phone's health grants were reset.

On both devices, the actual Profile permissions button showed the notebook
guidance before opening general Health Connect settings. Cancel, Android Back
and outside tap dismissed it without navigation or a false error; the button
remained usable. Open Health Connect opened a screen containing App permissions,
and Back returned to Profile. Screenshots confirmed readable, unclipped guidance.

On the emulator, with Body fat read missing, the actual button opened Lastrep's
native Allow request for that read alone, without guidance. Cancel returned to
Profile with incomplete-access feedback; the next explicit tap offered the
settings guidance. Granting the missing read returned to Connected. With all
reads granted, the actual button used the guidance/settings path and App
permissions > Lastrep Dev displayed all four enabled reads. Revoking Body fat
there caused Android to restart the app; returning showed Partially connected.
The button requested the missing read again, and granting it restored Connected.
Sync now then stayed in Profile and reported no new sleep/body data in this
empty local fixture. No artificial health records were inserted.

The earlier ANR was investigated using activity/window/event logs. The repeated
dialog belonged to the original no-focused-window incident, rather than new
ANRs on each restart. After dismissing that retained dialog, the permission
revoke/return sequence and three normal signed-in cold starts reached usable
screens without a new ANR; the system's last-ANR record remained the original
incident. Its initial cause is not conclusively established, so this does not
claim a startup bug was fixed. No startup source change was made.

Ignored local artifacts retain the native XML/screenshots, build/source hashes
and diagnostic logs. The prior automated checks apply to the unchanged product
source tested here; this pass adds native evidence rather than relabeling old
tests as new runs. Samsung One UI on the affected newer phone still needs a
fixed-build retest. That native verification pass did not commit, push, merge or
build an AAB.

### PR preparation

The user subsequently authorized proceeding with split commits, push and PR
review. Shared dismissible confirmation support is separated from the Health
Connect navigation fix and these sanitized design/verification notes. Fresh
pre-PR TypeScript, lint and the full 685-test suite passed; 22 emulator-dependent
tests skipped. Fresh web export and tracked Android configuration verification
also passed. Raw device/test-backend artifacts remain ignored. Merge and the
next production AAB are separate follow-up actions.
