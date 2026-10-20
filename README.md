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
- [Food catalog maintenance](docs/food-catalog-maintenance.md): reviewed metadata,
  sourced additions and the repeatable coverage audit.

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
