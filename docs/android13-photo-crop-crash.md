# Android 13 photo crop return crash

October 21, 2026. Follow-up to Play internal 1.0.1 (37).

## Confirmed evidence

The connected Android 13/API 33 phone retained two production fatal crashes with
the same signature: NullPointerException in Class.isAssignableFrom, reached via
Parcel.readParcelableCreatorInternal and Intent.getParcelableExtra.

The exact v37 mapping ID matches the crash's embedded R8 ID. It resolves the
relevant obfuscated class to expo.modules.imagepicker.contracts.CropImageContract;
the installed expo-image-picker 57.0.20 source reads CropImage.ActivityResult with
the typed Android API beginning at API 33. This occurs when the crop activity
returns, before the JavaScript picker call completes or photo upload begins.
This does not establish the cause of the separately reported slow saves.

AndroidX explicitly avoids that platform API on API 33 because of b/232589966.
Use its compatibility implementation rather than disabling R8 or broad keep
rules. [AndroidX IntentCompat source](https://android.googlesource.com/platform/frameworks/support/+/androidx-main/core/core/src/main/java/androidx/core/content/IntentCompat.java).

## Fix

`scripts/patch-image-picker.js` patches only the crop contract's Parcelable read
to IntentCompat.getParcelableExtra. AndroidX uses the legacy reader on Android 13
and the typed API on Android 14+. Crop cancellation, the selected image, URI/EXIF
handling and the cloud upload path remain unchanged. The patch is idempotent and
fails explicitly if an upstream SDK change no longer matches its expected source.

The existing postinstall command was a top-level package field, outside scripts,
so npm did not run it as a lifecycle hook. Move that existing chain into
scripts.postinstall and append this fix so fresh EAS installs apply it. CI's
intentional ignore-scripts install is followed by the explicit compatibility
patch command. Existing tslib/Health Connect patch implementations are unchanged.

## Build inclusion correction

The first local R8 dev APK still crashed twice during the user's four-attempt
review, including repeated selection of the same photo. Both crashes have the
original Parcelable failure and match that APK's R8 ID. Selecting the same photo
is a supported operation; it must not crash.

Inspection of the build log confirmed Expo selected its prebuilt image-picker
artifact, bypassing the patched source. The initial successful build therefore
did not verify the workaround. Configure only expo-image-picker in
expo.autolinking.android.buildFromSource, as described in
[Expo's prebuilt-module guidance](https://docs.expo.dev/guides/prebuilt-expo-modules/).
The corrected build ran expo-image-picker:compileReleaseKotlin, and javap
confirmed the compiled CropImageContract invokes IntentCompat.getParcelableExtra.
The installed AndroidX 1.17.0 bytecode switches to the typed reader only at API 34,
confirming API 33 uses the legacy reader. The corrected optimized APK built
successfully. Inspection of its packaged DEX confirms the crop-result branch
uses the legacy one-argument Parcelable reader below API 34. This APK is installed.
The user completed four consecutive crop returns using the same photo without a top-level Save; all four returned successfully without
a crash. A fresh crash-buffer check found only the two failed first-build
retest crashes, with no crash from the corrected APK. The dev process remained
running. This verifies repeated crop return on the connected Android 13 phone,
not an end-to-end upload or a Play-installed production release.

## Verification

Six focused tests passed for compatibility routing, preserving cancellation and
URI handling, repeat application, Windows line endings, upstream mismatch and
the install lifecycle location and source-build selection. Following the build
inclusion correction, fresh TypeScript, lint, Android configuration verification
and 663 tests passed, with 22 emulator-dependent tests skipped. Web export passed
before that Android-only configuration correction. The lockfile update only
records the active install hook; dependency versions did not change. The local dev
release APK built successfully with R8 minification and resource shrinking enabled and was installed
on the connected Android 13 phone. Repeated native crop-return verification
passed as described above. The user also verified picker/crop cancellation
preserves the existing photo and completed a full photo save without an error,
measured at 2.39 seconds. A fresh crash-buffer check after these checks found no
corrected-build crash and only the two previously captured failed first-build
retest crashes. The user still reports occasional longer saves; this single
timing does not establish that intermittent latency is resolved. Play-installed
production verification remains pending. An unminified dev build is not
sufficient for this production-native failure.

Retire this targeted patch after an SDK update supplies the compatible result
reader upstream, with another optimized Android 13 crop-return check. Do not
silently skip a failed patch application to unblock a build.

Raw native logs and the exact mapping remain in ignored local storage. No photo
content, account values or device identifiers belong in this document. The user
authorized split commits, push and PR review after the dev checks passed. No
backend deployment is needed. Merge and a new production AAB remain separate
release steps; Play-installed verification remains outstanding.
