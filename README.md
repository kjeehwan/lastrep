# Lastrep

Lastrep is a fitness logging and planning app for strength training, nutrition,
sleep and recovery. It combines routines and detailed workout records with
personal history, body-composition progress and optional training guidance.

The interface is being migrated to an approved **training notebook** design:
paper/ink surfaces, clear numeric entries, restrained coaching and consistent
light/dark layouts. Android is the current device-testing and Google Play release
focus. Browser prototypes are design studies, not production account screens.

## Start Here

- [Project overview and working agreement](docs/project-overview.md): purpose,
  features, architecture, safeguards and collaboration workflow.
- [Design specification](docs/training-notebook-design.md): shared tokens,
  interaction rules and approved screen directions.
- [Browser studies](prototypes/training-notebook/README.md): opening mockups and
  reviewing their example states.
- [Profile migration handoff](docs/profile-migration-handoff.md): instructions
  for resuming the migration review in a new development thread.
- [Profile migration notes](docs/profile-notebook-migration.md): implementation
  scope and recorded verification. Check dates and Git before assuming status.
- [Settings migration notes](docs/settings-notebook-migration.md): current native
  implementation and verification, merged in PR #39.
- [Authentication migration notes](docs/auth-notebook-migration.md): current
  Sign in / Sign up implementation and accepted phone checks, merged in PR #40.
- [Onboarding migration notes](docs/onboarding-notebook-migration.md): the four-step
  native flow, account-scoped progress and verification coverage, merged in PR #41.
- [Release verification](docs/notebook-release-verification.md): final cross-screen
  checks and the separate production-build/billing steps.
- [Internal testing v35 follow-up](docs/internal-testing-v35-follow-up.md):
  Play-installed findings, current fixes and remaining device/billing retests.
- [Internal testing v36 follow-up](docs/internal-testing-v36-follow-up.md):
  accepted Play checks, expired-restore feedback and clearer Profile saved status.
- [Android 13 photo crop crash](docs/android13-photo-crop-crash.md):
  v37 native crash evidence, crop-result compatibility fix and release checks.
- [Health Connect permissions and help](docs/health-connect-permissions-guidance.md):
  partial-access requests, settings fallback and concise source-app instructions.
- [Internal testing v40 follow-up](docs/internal-testing-v40-follow-up.md):
  accepted Play checks and repeated body-sync feedback/timestamp correction.
- [Food catalog maintenance](docs/food-catalog-maintenance.md): reviewed metadata,
  sourced additions and the repeatable coverage audit.
- [Exercise search review](docs/exercise-search-quality-review.md): shared Add /
  Replace ranking, catalog coverage and native splash follow-up.
- [Workout and food-search usability](docs/workout-search-usability.md): note
  keyboard visibility, relevant feedback, replacement peers, search timings,
  timer auto-start and native meal-time wheels.

## Stack and Layout

Expo / React Native / TypeScript with Expo Router, Firebase account/data services,
optional Android health integration, and RevenueCat / Google Play billing.
`package.json` and the lockfile define exact dependencies.

| Path | Purpose |
| --- | --- |
| `app/` | Routes and screen integration |
| `src/` | Domain logic, services, shared UI and tests |
| `src/ui/notebook/` | Native notebook design primitives and tokens |
| `functions/` | Backend functions and decision services |
| `android/` | Tracked native Android project |
| `plugins/`, `scripts/` | Native configuration and development/build tooling |
| `prototypes/training-notebook/` | Approved interactive browser studies |
| `docs/` | Engineering, design and migration documentation |
| `doc/privacy.md` | Maintained privacy-policy source |

`docs/index.md` contains older privacy text; it is not the project index or the
current policy source.

## Local Development

The usual workspace is Windows PowerShell. Start by checking the working tree:

```powershell
git status --short
git branch --show-current
```

Preserve existing changes. For a fresh checkout, install locked dependencies with
`npm.cmd ci`. Obtain required local Firebase/Google configuration and environment
values through an authorized channel; never commit credentials or assume example
configuration connects to a real account. Inspect app configuration and existing
setup scripts before attempting a native build.

The app uses native integrations. Use the Lastrep dev client, not Expo Go, for
device acceptance testing. With a compatible dev app installed:

```powershell
npm.cmd run start:dev-client
```

Check whether Metro already owns port 8081 before starting another instance.
Stop Metro before switching through revisions that add or remove files, and
restart it after the final revision is in place. An app connected during that
transition can receive a temporary missing-module error from the incomplete tree.
For USB testing, connect/unlock the phone and confirm authorization with
`adb devices -l`. Reconnection may require restoring port forwarding and reloading
the app. Confirm the latest UI is visible before interpreting a test result.

`npm.cmd run start:dev-client:fast` uses the project's alternative fast mode.
Record which mode was used when comparing performance. JS-only changes normally
load through Metro; native dependency/configuration changes can require a new
dev build. Check `eas.json` and tracked Android configuration rather than guessing
flavor/task names.

## Verification

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd test
npm.cmd run check:web-export
git diff --check
```

Additional scripts include `verify:android-native` and `test:firestore-rules`;
the latter requires emulator tooling. Backend changes need their own build/tests.
Check `.github/workflows/web-export-check.yml` for CI coverage.

Report actual skipped tests and unverified cases. Green unit tests or web export
do not establish native keyboard/permission behavior, persisted saves, visual
approval or real production billing. Read
[keyboard/modal guardrails](docs/keyboard-modal-guardrails.md) before changing
input layouts.

## Review and Releases

Before every new production AAB build, run a fresh
`npx.cmd --yes expo-doctor@latest` against the intended source/dependency state.
Resolve unexpected failures, including Expo patch-version alignment, and rerun
affected verification before starting the build. The intentional native-config
exception is documented in [Expo Doctor exceptions](docs/expo-doctor-exceptions.md).

For local Android release signing, explicit version handling and readiness checks,
see [Local production builds](docs/local-production-builds.md).

Work in focused branches, preserve existing behavior, run relevant checks and
obtain user review. Commit/push, PR/merge, branch deletion, deployments and AAB
builds are separate actions requiring explicit requests in this collaboration.

Dev and production are separate app packages. Production billing must be tested
in the Play-installed production app, not inferred from dev Premium access.
See [billing isolation](docs/revenuecat-build-isolation.md) and
[restore outcomes](docs/restore-purchase-outcomes.md).

Google Play release/policy actions remain user-controlled unless explicitly
delegated. Never publish raw device/account artifacts, environment files or
credentials. Sanitize local checkpoints before making them commit candidates.
