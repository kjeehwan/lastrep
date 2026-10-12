# Android edge-to-edge

## App-owned changes

- Keep React Native's `edgeToEdgeEnabled=true` with target SDK 36.
- Remove the obsolete `expo.edgeToEdgeEnabled` Gradle property.
- Replace the deprecated theme status-bar color with the app window background.
  System-bar icon styling remains controlled by Expo StatusBar; page and tab
  layouts already use react-native-safe-area-context insets.
- Select stable Material Components 1.14.0, which includes Android 15 bottom-sheet
  handling improvements. Do not adopt expressive themes or change the app design.

## Remaining library warnings

React Native 0.86.3's compiled `react-android` library still contains the following
Play-reported paths: StatusBarModule color getters/setters and WindowUtil's
edge-to-edge and status-bar hide/show compatibility code. Material also retains
legacy system-bar compatibility handling. These symbols can remain in DEX even
when Lastrep does not request those operations from JavaScript.

This batch is not proof that Play Console's deprecated-API notice disappears.
Removing every reference would require compatible upstream library fixes or a
maintained native fork; do not patch node_modules Kotlin files and assume they
replace the precompiled React Native Maven artifact. Do not use R8 assumptions
to delete system-bar calls merely to hide Play warnings.

## Verification

Rebuild before testing: theme and Material changes are native. Check cold launch
and splash, every tab header, keyboard input, dialogs, health consent and photo
selection. Verify on Android 15/16 with gesture and three-button navigation;
Android 13 alone cannot validate Android 15's enforcement. Check that headers,
bottom controls and keyboard fields remain visible. Inspect the next Play upload
for residual warnings and their exact origins.

Orientation and tablet restrictions remain a separate task.

### Local checks on October 12, 2026

Production `:app:bundleProdRelease` succeeded in 6m 43s with Material 1.14.0.
R8 remains enabled: obfuscation 60.76%, optimization 60.52%, shrinking 60.91%,
with the mapping embedded in the AAB. Tests: 168 passed, 14 emulator-dependent
tests skipped. Lint and TypeScript passed.

An optimized, standalone `:app:assembleDevRelease` build for x86_64 succeeded in
9m 36s and was installed on these emulators:

- Android 16 / API 36: Medium Phone, 1080 x 2400.
- Android 15 / API 35: 7-inch Tablet, 1200 x 1920.

After manual sign-in, visual checks passed for Home, Workout, Nutrition, Sleep
and Profile headers and bottom tabs with gesture and three-button navigation.
Scrolling kept headers visible and bottom actions reachable. Profile text inputs
remained visible with the full keyboard open. Health-consent text and buttons
stayed above the system navigation area in both navigation modes, including the
tablet taskbar. The Android 16 profile-photo action popup also fit correctly.
No system-bar overlap or Lastrep native crash was observed in these checks.

Evidence is stored locally under `.dev-tools/edge-qa/`, which is Git-ignored
because screenshots may contain account information. No account records were
edited or saved, health consent was not accepted, and the physical phone was
not modified. Both emulators were returned to gesture navigation.

Limitations: these are portrait layout checks, not exhaustive app regression
tests. Live health sync, native photo-library selection, purchases and landscape
layouts were not validated. The locally installed dev release logged a
RevenueCat offerings/product-configuration error; Play billing must be checked
with a Play-distributed build. The next Play upload is still needed to determine
which deprecated-API notices remain.

## Sources

- https://developer.android.com/about/versions/15/behavior-changes-15
- https://github.com/material-components/material-components-android/releases/tag/1.14.0
