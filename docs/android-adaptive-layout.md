# Android orientation and resizability

## Changes

- Expo orientation is `default`, not `portrait`, so a future prebuild does not
  reintroduce the lock. This shared Expo setting also permits iOS rotation;
  iOS runtime validation is separate from these Android checks.
- MainActivity no longer sets `screenOrientation` and explicitly permits
  resizing. Existing orientation/screen-size config handling remains enabled.
- Main pages and meal/routine screens respect lateral safe-area insets.
  Home uses safe-area padding instead of a hard-coded top offset.
- Health consent has height-bounded, scrollable text with actions outside the
  scrolling body. Workout dialogs and app dialogs support short windows without
  making their content unreachable.

The change does not add a compatibility opt-out or fixed aspect ratio. The
merged manifest still contains Google's invisible barcode-scanner delegate
activity with its library-owned orientation setting; MainActivity is unrestricted.

## Validation

- Resolved dev Expo config: orientation `default`, dev package unchanged.
- Merged dev release manifest: MainActivity resizable with no orientation lock.
- Automated checks: 175 tests passed, 14 emulator-dependent tests skipped;
  lint, TypeScript and diff whitespace checks passed.
- Optimized standalone dev release APK built successfully. The final incremental
  rebuild completed in 1 minute 38 seconds and was installed on both emulators.
- Android 16/API 36 Medium Phone and Android 15/API 35 7-inch Tablet:
  Home, Workout, Nutrition, Sleep and Profile checked in landscape. Headers,
  bottom navigation and scrollable content remained accessible.
- Health consent text and both actions fit above system navigation on both
  landscape displays. Consent was dismissed without enabling sync.
- Phone landscape keyboard used Android's extract-editing mode; the profile
  input and Done action remained accessible. No text was changed.
- My routines dialog was checked on both displays. A nested-list height issue
  was corrected so Close remains visible in phone landscape. The open dialog
  survived rotation back to portrait on both emulators.
- Final app-process AndroidRuntime and ReactNativeJS error logs were empty.
  Both emulators were returned to portrait with automatic rotation enabled.
  No account records were changed and the physical phone was not modified.

These are representative checks, not exhaustive coverage of every dialog.
Freeform/multiwindow layouts, other cutout shapes, reverse landscape and iOS
runtime behavior remain unverified. Production billing is a separate check.

Check rotation in both directions, page headers and bottom tabs, scrollable
content, keyboard input and consent/dialog controls. Keep local screenshots
under `.dev-tools/`, not Git, because they may include account information.
Do not save or discard an existing account workout while testing layout.

Google Play must evaluate the next production AAB; a local manifest check does
not prove the Play notification has disappeared.

## Phone smoke-test follow-up

- Centered primary-page content and headers with a 760-dp maximum width;
  sheets/dialogs cap at 560 dp while preserving smaller existing dialog caps.
  These layout constraints use native styles rather than JS resize callbacks.
- Workout tablet row styling uses the shorter window dimension, so a phone
  does not switch row styling just because it rotates to landscape.
  Native rows also skip rebinding when column labels have not changed.
- Native resistance inputs disable Android extract/fullscreen IME editing;
  React Native workout inputs also set `disableFullscreenUI`.
- The user verified the initial rotation implementation on the phone. These
  follow-up keyboard changes require another native rebuild. Rotation latency
  has not been measured; the stable row styling is not proof it is resolved.

## Reference

- https://developer.android.com/about/versions/16/behavior-changes-16#adaptive-layouts
