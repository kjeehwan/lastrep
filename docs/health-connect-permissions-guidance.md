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
Android 14+ routing was subsequently verified on an Android 16/API 36 Google Play
phone emulator using the currently installed dev APK. After initial Health
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
