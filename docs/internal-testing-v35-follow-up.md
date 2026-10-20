# Internal testing v35 follow-up

October 20, 2026. Source branch: `fix/expo-sdk57-patches`.
The user subsequently authorized split commits, push, PR review/merge, CI and a
new production AAB. Preserve the unrelated user file deletion outside the batch.
Play submission and backend deployment remain separate actions.

## User-reported Play-installed checks

The user uploaded 1.0.1 (35) to internal testing and approved version, email/Google
sign-in, signed-in reopening, persisted workout/nutrition entries, health sync,
barcode scanning and photo upload. The following findings apply to that artifact;
the subsequent fixes are not yet in a Play build.

## Changes and investigation

- Profile Identity: constrain field widths and draw the border on a containing
  View instead of Android's editable text surface, whose right border was clipped
  in native review. Preserve keyboard focus tracking and cancel semantics.
- Clean Profile action reads Saved; Save is available for staged edits and
  Saving... indicates an actual request. Stage feedback stays below the header
  rather than scrolling out of sight during Save and leave.
- Photo saves retain the deployed two-call stage/commit flow. Native uploads now
  prepare a bounded 512px JPEG locally. A fresh same-photo pair measured 3.23s
  before and 2.06s after; the user reported 2–3s after. The reported ten-second
  case was not reproduced in that pair. The deferred one-call backend remains
  undeployed. See [photo performance](profile-photo-save-performance.md) for
  stage timings, network/warmth limitations and failure/retry verification.
- Workout add feedback uses notebook subtle/ink/border rather than green fill
  with an unreadable foreground. Native row initial estimates include the 4dp
  bottom margin; native content measurement supplies the final list height.
  RecyclerView performs native layout after adapter updates and refreshes visible
  input/checkbox palettes immediately when appearance changes. Native templates
  and tracked Android copies stay identical.
- Macro fills use the muted dark-mode sage/sand/slate colors in both themes,
  with ink percentage and gram labels for readable paper-mode text. User visual
  review passed; color is not the sole P/C/F identifier.
- Selected bottom icons have heavier strokes. Shared popup layout wrappers pass
  empty-space taps to the dismiss target. Legacy program pickers and the fallback
  app dialog also support outside dismissal. Existing non-saving close handlers
  and in-flight write guards remain authoritative.
- Health Connect: on Android 14+, use the app-permission intent for the actual
  installed package, not a manage-data API whose package argument identifies the provider. Android
  14+ gets the protected permission-usage alias in the tracked manifest and a
  matching Expo plugin. When this phone has no grants, the explicit permissions
  button starts Android's read-permission request. Sync now does not request or
  navigate to permissions. Following user review, Profile shows one short
  instruction: tap Health Connect permissions, choose Lastrep, and allow the data
  to sync. A header help icon contains brief per-device/source-sharing details;
  the long How to grant access walkthrough and repetitive ready prose were removed.
  Android 13's separate provider exposes general settings rather than that
  app-specific permission action; open its supported settings action and explain
  how to choose App permissions > Lastrep. A native check caught and corrected
  an unsupported older-Android action before finalizing this batch.
- Manage subscription opens Google's existing-subscription management screen.
  It is not Lastrep's monthly/annual purchase selector. No plan switch, purchase
  or subscription configuration changes were performed during this investigation.
- Existing webhook logs for the tested account show a protected permanent grant.
  This is distinct from a paid entitlement; webhook updates intentionally do not
  overwrite it. Restore now has an explicit alreadyActive outcome only after an
  active store subscription and an independent server-confirmed grant are found.
  It does not claim a paid purchase was restored or change backend authority.
  Cached/pending grants are rejected. A read-only v35 retry subsequently returned
  notFound in 1.3 seconds; this does not verify the earlier unconfirmed outcome or
  a real paid restoration. Real billing verification requires a license tester
  without a permanent grant and an active test subscription.

## Verification and remaining review

- User approved Identity borders, Saved state, exercise feedback, selected tabs,
  outside dismissal, Workout sizing/theme updates and muted macro colors in the
  dev app. User subsequently requested a concise Health sync instruction with
  optional help; that copy/layout follow-up requires its own review. Later native
  photo preparation reduced the measured Save handler to 2.06s, with the user's
  perceived wait at 2–3s. Production latency still requires its own measurement.

- Initial fresh checks after the fixes: TypeScript passed; 641 tests passed,
  22 emulator-dependent tests skipped. Expo web export passed after granting the
  process access to its local cache/log path. Local standalone Android dev builds
  succeeded. Later checks and native findings are recorded below when complete.
- The connected Android 13 Samsung phone showed all three native set rows and
  the Add/Duplicate controls, and retained the existing workout draft. Dark then
  Light switched the native fields with the surrounding screen. Identity outside
  dismissal left the clean Saved state; no profile or workout values were changed.
- Native review found the first field-width adjustment insufficient. The current
  input-container border correction was then built, installed and visually
  checked: both Identity fields have complete right borders. The check did not
  type or save profile values.
- Final source checks: TypeScript, lint, native configuration verification and
  diff whitespace checks passed; 641 tests passed and 22 emulator-dependent tests
  were skipped. The standalone dev APK was rebuilt and installed after the
  Android 13 navigation correction. Its explicit permissions button opened the
  Health Connect provider with App permissions available; returning to Profile
  displayed the navigation instructions. No grants were changed. Appearance
  returned to its original Light preference after the Dark/Light check. Metro
  was not running; native review used the bundled standalone dev app.
- Newer Galaxy/Android-specific Health Connect discovery and permission grants,
  recommended-workout final-row clipping, production photo timings and paid
  restoration remain device/Play retests. The connected older phone cannot prove
  those newer-device paths. Do not count dev Premium as billing verification.

The concise Health sync follow-up passed fresh TypeScript, lint, 14 Profile
checks and diff checks. A rebuilt standalone dev APK was installed; native
inspection confirmed the single instruction, removed walkthrough button and
per-phone paragraph, and brief help opened from the heading icon. No grants or
saved records were changed. User visual approval of this follow-up is pending.
The later duplicate instruction after returning from Health Connect was removed;
the instruction above Sync now is the single persistent guide. Error and sync
result feedback remain separate. See [photo performance](profile-photo-save-performance.md)
for the subsequently requested timing and client optimization.

Official Android references:
[Health permissions action](https://developer.android.com/reference/android/health/connect/HealthConnectManager#ACTION_MANAGE_HEALTH_PERMISSIONS),
[Health Connect availability](https://developer.android.com/health-and-fitness/health-connect/availability).

## Pre-commit verification

The final clean-source batch passed TypeScript, lint, tracked Android configuration,
backend compilation, web export and all 649 unit tests; 22 emulator-dependent
tests were skipped. The manual review covered native/template parity, measured
Workout row sizing and palette updates, modal hit testing, Profile drafts and
photo cleanup/account guards, permission destinations and restore outcomes.
No blocking findings were identified. Added source/docs were checked for private
key/token patterns and temporary upload hooks; none were found. Raw artifacts
remain ignored, and the unrelated user deletion is excluded from these commits.

Native and user acceptance limits above still apply. In particular, the canceled
photo request passed draft/retry verification, while physical radio-loss recovery,
the newer Galaxy's Health Connect destination and actual paid restore require
further Play-installed testing. The next production build requires another fresh
Expo Doctor check after merge; this section does not claim that build has run.
