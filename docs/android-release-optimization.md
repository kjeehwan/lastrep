# Android release optimization

## Configuration

Release variants enable R8 code shrinking/obfuscation and Android resource
shrinking through the tracked `android/gradle.properties`. The release build uses
`proguard-android-optimize.txt`, not the default file that disables optimization.
Debug variants remain unminified. Expo build-properties mirrors the release flags
in `app.base.json`; this project uses a tracked native project, so EAS builds use
the checked-in Gradle configuration. Do not run clean prebuild for this change.

The Gradle heap is 4 GB with a 1 GB metaspace limit. The initial optimized
verification attempt exhausted the previous 2 GB heap; its log dispatcher also
failed, leaving the console looking stuck. Use `--max-workers=4` for local release
verification when running several memory-heavy native compilers concurrently.

React Native, Reanimated, Worklets and Samsung Health already provide consumer
keep rules. Only redundant application-level rules were removed. Do not remove
library JNI/reflection rules or introduce global `-dontoptimize`, `-dontshrink`,
`-dontobfuscate` or `-ignorewarnings` directives to make a build pass.

Lastrep uses Google Play billing. The unused RevenueCat Amazon-store module is
excluded from app dependency configurations because its consumer rules include
a global `-dontoptimize`. Google Play billing and RevenueCat's core consumer rules
remain included. This configuration does not support Amazon distribution; revisit
the exclusion if that becomes a requirement.

## Release Verification

Build the production variant from `android/` with `APP_VARIANT=prod` and
`NODE_ENV=production`: `./gradlew :app:bundleProdRelease` (`gradlew.bat` on Windows).
This compiles a bundle; it does not install over the Play-distributed production app.

Inspect the following build outputs:

- `android/app/build/outputs/bundle/prodRelease/app-prod-release.aab`
- `android/app/build/outputs/mapping/prodRelease/mapping.txt`
- `android/app/build/outputs/mapping/prodRelease/configuration.txt`
- `android/app/build/outputs/mapping/prodRelease/usage.txt`

The bundle should include `BUNDLE-METADATA/com.android.tools/r8.json` and the
obfuscation mapping under `BUNDLE-METADATA/com.android.tools.build.obfuscation/`.
Preserve the exact mapping for each published version. Do not substitute mapping
from a different build. Inspect the R8 metadata for actual optimization percentages;
merely enabling R8 is not proof that the Play threshold is met.

A local build uses the project's local signing configuration, not necessarily
the Play upload key. Build through the production EAS profile for distribution.
Do not upload the locally signed verification bundle to replace the EAS artifact.

Test an optimized release build before rollout: cold launch, authentication,
navigation/animations, native workout inputs, health sync, barcode camera,
cloud profile photos and purchases/subscription restoration. A Metro debug-app
smoke test cannot validate release obfuscation. Check the uploaded EAS bundle's
scores and mapping availability in Play Console before publishing it.

### Local verification on October 12, 2026

`:app:bundleProdRelease --no-daemon --max-workers=4` succeeded in 6m 7s
after excluding the Amazon store. The resulting bundle's R8 8.12.14 metadata
reports optimization, obfuscation and shrinking enabled, with these scores
(100 minus each `no*Percentage` value):

- Obfuscation: 60.72%.
- Optimization: 60.49%.
- Shrinking: 60.87%.

All exceed the current 25% threshold. The bundle includes a non-empty ProGuard
mapping. Its merged configuration contains no global disabling directives and
no Amazon-store consumer rules. Recheck the actual EAS artifact before publishing;
these measurements apply to the local verification bundle, not an earlier AAB.

Lint, TypeScript, native registration checks and 165 tests passed; 14
emulator-dependent tests were skipped. Optimized-release device smoke testing
has not yet been performed.

## Scope

This batch does not change edge-to-edge APIs, portrait restrictions, native SDK
versions or the postponed dependency-risk follow-ups.

References:

- https://developer.android.com/topic/performance/app-optimization/enable-app-optimization
- https://developer.android.com/google/play/vitals/code-optimization
- https://github.com/RevenueCat/purchases-android/issues/3496
