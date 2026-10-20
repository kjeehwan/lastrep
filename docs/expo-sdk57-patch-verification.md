# Expo SDK 57 patch verification

October 20, 2026. Branch `fix/expo-sdk57-patches`, based on merged main
`dc5992e`. Production EAS build 34 finished successfully but reported six
dependency-alignment failures in Expo Doctor. The user authorized updating those
packages, fresh verification and a replacement production AAB. Commit/push/PR
and Play submission are separate actions. Commit/push/PR/merge and the next AAB
were subsequently authorized with the internal-testing follow-up; Play submission
still requires its own instruction.

## Dependency changes

| Package | Before | After |
| --- | --- | --- |
| expo | 57.0.28 | 57.0.30 |
| expo-asset | 57.0.19 | 57.0.20 |
| expo-auth-session | 57.0.15 | 57.0.16 |
| expo-constants | 57.0.21 | 57.0.22 |
| expo-linking | 57.0.12 | 57.0.13 |
| expo-router | 57.0.26 | 57.0.28 |

The lockfile also updates required Expo runtime, module/tooling and Babel
dependencies. Unrelated direct dependencies and existing security overrides are
unchanged. This stays on SDK 57. No clean prebuild or native-project regeneration
was performed. The fresh Doctor requirement is recorded in README, the working
agreement and Android release instructions.

## Fresh verification

- Latest Expo Doctor: 20/20 checks passed, retaining only the documented native
  configuration synchronization exception. No new exclusions were added.
- Expo dependency check: dependencies up to date.
- Full suite: 634 passed, 22 emulator-dependent skipped; 91 files passed, two skipped.
- TypeScript, lint, backend build and tracked Android configuration checks passed.
- Web export and production Android/Hermes export passed.
- Dependency audit reports 26 high and nine moderate findings in the app tree,
  zero critical; Functions reports zero findings. These are not repaired by this
  alignment batch. See the existing dependency-security review for scope and
  previously identified advisory roots.
- The phone initially was unavailable, then reconnected. A fresh arm64 standalone
  dev APK compiled successfully with shrinking disabled by command-line flags;
  tracked release settings remained unchanged. Its signing certificate matched
  the existing dev app, installation retained data, and the installed APK hash
  matched the fresh build. Repeated cold starts reached signed-in Home with the
  visible saved workout draft summary retained. Workout, Nutrition, Sleep,
  Profile and Settings rendered their expected headings/content without an error
  overlay. No profile/settings changes, workout writes or account operations
  were performed. The updated standalone dev app was left on Home.
  Restart Metro when restoring the development client: the existing server
  predates this dependency update and was not used for the standalone smoke test.
- Fresh sign-in/onboarding, permission changes, and optimized production runtime
  or billing checks on a Play-installed build remain unverified. This dev smoke
  test does not replace those checks.

## Replacement build

Use the production EAS profile, remote auto-incremented version code and existing
remote signing credentials. Build 34 remains available in EAS. The replacement
uses the updated working-tree/lockfile snapshot; Git commit metadata alone still
identifies the base commit until this patch batch is committed. Preserve the
resulting AAB and its embedded mapping/R8 metadata. Do not submit or publish it
without a separate instruction.

The replacement was accepted as production **1.0.1 (35)**, EAS build
`c424f5b3-6372-4e9d-b941-fc85dfec82aa`. The verified lockfile SHA-256 at upload is
`d49a3d7f10332d58226d537b052d40a4aa81fdd0ed47d8781800c9f7b7371919`.
EAS's own Expo Doctor also passed 20/20 against the uploaded snapshot. The updated
native smoke verification above passed after the phone reconnected.

At the end of local verification, build 35 was still in progress on EAS, with
Gradle/R8 and native compilation underway. Artifact validation follows the user's
build-completion notification, as with build 34. No background local monitor was
left running and no Play submission was requested.

## Completed artifact validation

After the user's completion notification, EAS reported build 35 **FINISHED**.
The signed production AAB was downloaded and preserved with its mapping and R8
metadata in ignored local release storage.

- Official Google bundletool 1.18.3 (published SHA-256 verified) validated the
  bundle successfully. ZIP CRC integrity checks passed.
- Manifest: `com.kjeehwan.lastrep`, version name `1.0.1`, version code `35`,
  min SDK 29, target SDK 36, non-debuggable.
- Jarsigner verified signature integrity. Its trust-store warning for the
  private signing certificate does not establish Play upload-key registration;
  the build used the existing frozen remote EAS signing credentials. Play
  acceptance remains a separate upload check.
- Embedded R8 8.12.14 metadata confirms obfuscation, optimization and code
  shrinking enabled, with debug mode disabled. Scores derived from that exact
  artifact: obfuscation 60.76%, optimization 60.52%, shrinking 60.91%.
- The exact nonempty embedded mapping (184,366,326 bytes) was preserved alongside
  the AAB, R8 metadata and validation report.
- AAB size: 108,281,583 bytes. SHA-256:
  `d7229538c8729fab93a6d962ef0c7771a9b2c18ec5b2c6e518b3a62892e48b52`.
- At build 35 validation, the lockfile matched the upload fingerprint above.
  The subsequent native photo-preparation module changes that fingerprint; this
  document's artifact metadata describes build 35, not the next release.

The user uploaded v35 to Play internal testing and reported successful version,
email/Google sign-in, signed-in reopening, workout/nutrition persistence, health
sync, barcode scanning and photo-upload checks. Follow-up layout, health-access
and billing findings are tracked in [internal testing follow-up](internal-testing-v35-follow-up.md).
These checks do not constitute production rollout approval or a complete paid
restore test. The follow-up source/dependency changes are being reviewed and
committed separately from that artifact.
