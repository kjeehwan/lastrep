# Working on Lastrep

## Start with current evidence

- Read `docs/project-overview.md` for the product, source map and working agreement.
  For UI work, read the relevant sections of `docs/training-notebook-design.md`.
- Read the relevant feature notes and latest checkpoint, then verify the active
  implementation. Historical mockups, unused functions and old checkpoints are
  not evidence of current behavior. Trace callers before attributing a feature
  to AI, a provider or a backend.
- Inspect Git status and the intended base before editing. Preserve unrelated
  user changes. Work on a focused branch; never discard changes for convenience.

## Review architecture proportionately

Use these levels during planning and final PR review:

| Change | Review scope |
| --- | --- |
| Copy, styling, spacing or icons | Reuse the established components/tokens and check unintended behavior changes. |
| Logic within one feature | Check state ownership, duplicate rules, storage boundaries, errors and relevant behavioral tests. |
| Cross-screen state, drafts, programs, sync, billing, native integration or backend contracts | Trace the affected data flow, account isolation, failures/retries, compatibility and recovery; document material tradeoffs. |

- Keep responsibilities understandable. Line counts identify review candidates,
  not mandatory file-size limits. Splitting files without reducing coupling is
  not an architectural improvement.
- Fix structural problems introduced by the current change. Record unrelated
  existing debt separately with evidence and practical impact; avoid expanding
  a small task into a broad refactor.
- Keep behavior-preserving refactors separate from feature/schema changes when
  practical. Preserve drafts, records, units, permissions and user edits.
- For meaningful changes, explain architecture impact and validation in the PR.
  A purely cosmetic change can use a short statement rather than a full analysis.

## Protect data and environments

- Use disposable accounts and synthetic records for automated testing. Personal
  workouts, routines, health records, purchases and permissions require the
  user's explicit authorization for any test mutation.
- Confirm account/device identity, dev versus production package, Firebase
  project and deployment target before operations. A dev package alone does not
  imply an isolated backend. Keep secrets and personal test artifacts untracked.
- Preserve account-scoped caches, sign-out cleanup and stale-request protection.
  Treat imported records, current permission state and previously saved account
  summaries as distinct facts.
- Restore temporary device, branding and development-setting overrides after
  checks. Do not stop unrelated processes or alter system settings unnecessarily.

## Verify and communicate accurately

- Select checks according to the affected behavior. Consult `package.json`,
  `functions/package.json` and `.github/workflows/web-export-check.yml` for the
  actual commands. On Windows, use `npm.cmd` / `npx.cmd` as needed.
- Check cancellation, failure/retry, persistence and account changes where the
  change touches them. Native gestures, keyboards, background timers, permissions
  and Play billing need the relevant native verification.
- Distinguish code inspection, unit tests, emulator checks, phone review,
  deployment and production verification. Report skipped/unverified work and
  remaining uncertainty. Passing CI or user LGTM covers only the reviewed scope.
- Changes to data collection, sharing, retention or provider transfers need a
  review of `doc/privacy.md`, hosted policies and relevant Play declarations.
- Before a new production AAB, follow the fresh Expo Doctor preflight and
  documented exceptions in the project overview. A prior green run is not enough.

## Scope, delivery and documentation

- Proceed with routine reversible steps necessary for an authorized task without
  repeated confirmation. Raise material missing decisions or unrelated scope
  expansion; do not infer authorization for production data mutations.
- Commit/push, open/merge PRs, delete branches and release/deploy only within the
  user's authorized scope. Prefer PRs into `main`; stage only intended files and
  verify branch/working-tree status after cleanup.
- Submit EAS cloud builds without waiting. Save the build ID and verification
  checkpoint, give the user the build link and ask them to report completion.
  Do not repeatedly poll or send queue updates unless explicitly asked to monitor.
- Keep this file short and durable. Detailed design rules, audit findings,
  backlogs and temporary checkpoints belong in `docs/`; link instead of duplicating.
  Do not add credentials, personal identifiers or transient process details here.
