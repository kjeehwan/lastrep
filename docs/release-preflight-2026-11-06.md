# November 6 release preflight

Release source began at `bb707a2` (PR #88), following the
[release inventory](release-inventory-2026-11-06.md). This records preparation,
not a completed production AAB or Play release.

## Required Expo patch alignment

Fresh `expo-doctor@latest` initially passed 19/20 checks: nine packages were one
patch below Expo's current SDK 57 requirements. Updated only those direct
requirements and their resolved dependency tree; no SDK-major upgrade, clean
prebuild, permission or manually maintained native configuration change.

| Package | Before | After |
| --- | --- | --- |
| expo | 57.0.31 | 57.0.32 |
| expo-asset | 57.0.20 | 57.0.21 |
| expo-build-properties | 57.0.22 | 57.0.23 |
| expo-constants | 57.0.22 | 57.0.23 |
| expo-dev-client | 57.0.20 | 57.0.21 |
| expo-image-manipulator | 57.0.21 | 57.0.22 |
| expo-image-picker | 57.0.20 | 57.0.21 |
| expo-router | 57.0.29 | 57.0.30 |
| expo-splash-screen | 57.0.10 | 57.0.11 |

Reviewed official SDK-57 package changelogs. Expo's patch fixes `expo/fetch`
Content-Type handling; Router's patch covers external URL parentheses and web
navigation state. The remaining seven changelogs list no user-facing changes.
References: [Expo](https://github.com/expo/expo/blob/sdk-57/packages/expo/CHANGELOG.md),
[Router](https://github.com/expo/expo/blob/sdk-57/packages/expo-router/CHANGELOG.md),
[image picker](https://github.com/expo/expo/blob/sdk-57/packages/expo-image-picker/CHANGELOG.md).

Ran `npm.cmd run postinstall` explicitly after installation. The tslib and
Health Connect guards passed; the Android 13 image-picker `IntentCompat` patch
applied successfully to the new package. Preserved the documented
[native-config Doctor exception](expo-doctor-exceptions.md).

## Automated and build evidence

- Fresh Doctor after alignment: **20/20 passed**.
- Application TypeScript, lint, tracked Android configuration verification and
  web export passed. Initial sandbox denial opening Expo's export log was
  resolved by rerunning with access to the local log directory.
- Full suite against disposable Firestore/Storage emulators:
  **141 files, 1,035 tests passed, zero skips** with `vitest run --maxWorkers=2`.
- Initial full run during C++ compilation timed out in seven cases, with one
  subsequent mock-count failure after a timed-out handler continued. Reran the
  entire suite after native compilation with two workers; no assertions or test
  timeouts were relaxed and no application logic was changed to make tests pass.
- `:app:assembleDevDebug` succeeded with the updated native dependencies.
  Installed the resulting APK on the Android 13 phone and Android 16 emulator.
- Emulator replacement initially failed for insufficient storage. Temporary APK
  directories were already nearly empty and cache trimming did not free space.
  Removed the old dev package binary using package-manager `uninstall -k`, then
  reinstalled the same-signed APK successfully. Production package was untouched.

## Focused native verification

Both runtimes were confirmed on `demo-lastrep-sharing` with explicit local
Auth/Firestore emulator connections before test mutations. Used only two new
disposable local accounts and synthetic records. No real health permissions,
production records, subscriptions or purchases were changed.

Android 13 phone, `com.kjeehwan.lastrep.dev`:

- Saved a partial body measurement, then retained it across dev APK replacement.
- Interrupted only this device's Firestore reverse port during another save.
  The form showed connection/retry guidance and retained the entered value.
  Restored forwarding and retried; a server read confirmed both records retained.
- Profile showed Premium for the premium fixture. Switching directly to the
  free fixture emitted loading then inactive and displayed Free. Sign-out showed
  Sign in; signing back into the free fixture did not restore stale premium state.
- Opened seeded sleep history. Changed eight hours to 6.5 and cancelled: the
  server summary and visible total remained eight. Repeated and saved: the server
  summary became 6.5, while the sleep target remained eight hours.
- Native Today's Plan context used the saved 6.5-hour journal summary, nutrition
  target and recovery ratings. Resumed the synthetic bench draft through the
  actual picker; Today's Plan review opened with Train as planned and one unchanged
  exercise. Reviewed its native screenshot.

Android 16 emulator: rebuilt dev app launches and connects to the isolated backend.
Signed into the disposable fixture and opened its sleep history without a runtime
crash. The detailed edit/retry and context checks above were on the physical phone.

Existing overlap, import/exclusion, historical edit-date, concurrency and account
isolation coverage remains in the full emulator-enabled suite and the earlier
native verification documents. Real Play purchase/restore, real sensor imports
and production artifact acceptance were not performed during this preflight.

## Build selection and pending work

Read-only EAS queries confirm latest finished production build and remote Android
counter are **44**. The Free account reports one of 30 included builds used in
the November billing period, with available cloud-build capacity. No counter was
changed and no new EAS build has been submitted yet. On November 7 the user
confirmed **44** is the highest Play upload, including testing tracks, and
authorized commit/push/review/merge/cleanup followed by the production AAB build.

The patch batch is prepared on `fix/release-expo57-patches`. Build from the
reviewed source after that delivery and version confirmation, then verify the
resulting artifact's identity, signature, production environment, required native
patches and checksums before handing it to Play. Do not treat the dev APK as an
accepted production artifact.

No new collection or provider transfer is introduced; policy/Play declarations
remain unchanged. No backend deployment is required for these dependency patches.

## Cleanup / resume status

Both devices were signed out of the task accounts. Cleared task-account local
cache keys and restored the temporary billing console observer. Deleted only the
two task-created local Auth accounts and their synthetic Firestore records, then
removed their credential/generated login files. Restored the phone's original
empty reverse-forwarding list and returned it to the launcher. Production app,
records, health permissions and billing remain untouched. Both dev installations
remain on the rebuilt APK; existing QA Metro remains on 8082 with the demo backend.

Raw synthetic UI artifacts and build logs remain ignored under `.dev-tools/`,
never staged. Production environment values were pulled into an ignored private
file for later artifact comparison; none are included in this document. The
server-only Google services secret is unavailable through env pull and must stay
supplied by EAS's existing secret configuration. No build has been submitted.

Git delivery and build were authorized on November 7. Refresh source/version
checks, deliver the patch batch, build with the existing EAS production profile
and perform final artifact verification. The build outcome is separate from this
preflight record.
