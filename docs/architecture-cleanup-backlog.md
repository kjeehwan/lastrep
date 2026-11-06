# Architecture cleanup backlog

Created November 6, 2026 from the
[architecture audit](architecture-audit-2026-11-06.md), baseline `71ef49f`.
Implementation and release status are tracked separately below. Remaining items
are proposals; they are not authorization for a production deployment or broad rewrite.

## Status — November 6, 2026

- Working rules, PR template and audit merged in [PR #78](https://github.com/kjeehwan/lastrep/pull/78).
- A1 merged in [PR #79](https://github.com/kjeehwan/lastrep/pull/79): transactional
  additions/imports, including atomic fingerprint checks and legacy baselines.
  Manual saves require a connection; existing failure UI keeps input for retry.
- A2 merged in [PR #81](https://github.com/kjeehwan/lastrep/pull/81): billing cannot
  provision a deleted/missing profile. Deleted/deleting accounts are acknowledged
  without writes; live Auth accounts awaiting profile creation and transient Auth
  errors receive retryable HTTP failures. Deployed November 6 to
  `revenuecatWebhook` only; the function is ACTIVE and live authentication/method
  guards returned the expected 401/405 responses.
- A3 merged in [PR #82](https://github.com/kjeehwan/lastrep/pull/82): each UID owns
  a fresh entitlement store and disposed callbacks are ignored. Android 16 native
  premium-to-free account switching and sign-out passed with local demo accounts.
  Real Play purchase/restore flows were not exercised; this change does not alter them.
- A4 merged in [PR #80](https://github.com/kjeehwan/lastrep/pull/80): application
  typecheck and a separate disposable Firebase boundary job. The job discovers
  new integration suites and rejects skipped/unexecuted files.
- Combined source verification: **135 test files, 967 tests passed, zero skipped**
  with local Firestore/Storage emulators. Individual PR quality/boundary gates passed.
  No production records, purchases or permissions changed. A1/A3 need a future
  app build to reach installed users; no AAB was built for this work.

See [measurements and next-stage decisions](architecture-cleanup-measurements-2026-11-06.md)
for A6–A8. A5 remains incremental work when a relevant screen responsibility changes.

A7 first step now reuses one root profile snapshot within each Today's Plan
context load (three application-level profile reads reduced to one). Existing
nutrition/sleep loaders share the same parsers. Four regression tests cover the
single read, summary precedence, defaults, account isolation and missing profiles.
Combined emulator-enabled suite: **136 files, 971 tests passed, zero skipped**.
Broader document splitting and history-retention changes remain deferred.

[Native and deployment verification](architecture-cleanup-native-verification.md)
also covers manual body-entry persistence, failed-connection retry without losing
input, and native Today's Plan context/review. No new AAB has been built.

## First changes

| Order | Task | Scope and completion evidence |
| --- | --- | --- |
| 1 | A1: Atomic body-history additions/imports | Share a transaction-safe merge path across manual and provider additions. Keep provider calls outside transaction callbacks. Verify concurrent additions, addition vs edit/delete, duplicate import and partial metrics against a disposable Firestore emulator. Existing normalization/UI stays unchanged. |
| 2 | A2: Account lifecycle gate for billing | Define handling for missing/deleting owners and legitimate first events. Test late events after deletion, deletion in progress, duplicate/stale events and permanent grants. Do not use personal subscriptions or delete real accounts for testing. |
| 3 | A3: UID-owned entitlement state | Reset/key results and suppress old callbacks. Test account switch before new snapshot, sign-out, error and loading presentation. Preserve server authority and restore behavior. |
| Alongside 1–3 | A4: CI boundary coverage | Add root typecheck and disposable emulator job for rules plus program/sharing/sleep and new regression suites. Assert expected integration suites actually execute. No production project credentials or record mutations. |

Keep these as focused changes with independent review. A2 requires backend
deployment after validation; A3 requires native/account-switch review. A1 does
not require a schema migration by default. Do not bundle a large screen rewrite
into any of them.

## Measured and incremental maintenance

A6's [approved design](sleep-history-read-design.md) first increment merged in
[PR #86](https://github.com/kjeehwan/lastrep/pull/86); its interval index was deployed
and verified READY. [Second-increment verification](sleep-scoped-mutation-verification.md)
now covers scoped commands, incremental 30-recorded-day summaries and safe full
fallback: 1,022 passing tests and Android 16 local-account checks. This second
increment is approved for delivery; the additional contained-window index deploys
after merge. Delivery/deployment outcomes are recorded in the PR. Installed users
need a future app release.

| Task | Starting point | Completion evidence / decision |
| --- | --- | --- |
| A5: Extract workout orchestration | Choose one responsibility such as program/draft transitions. Define input, output and command ownership before moving code. | Behavior unchanged; cancel, switching and hydration cases covered. Shared editor receives meaningful capabilities rather than new dummy callbacks. No arbitrary line-count target. |
| A6: Bound sleep work | Benchmark synthetic 30-, 365- and multi-year ledgers including excluded imports. | Document read/latency growth; design affected-window writes and paged history while retaining revision protection and overlap rules. Implement only after reviewing the design. |
| A7: Reduce root-document coupling | Reuse one snapshot within a context load; inventory reads/writes and the body-history retention cap. | Equivalent guidance/context and account isolation; measured operations before/after. Decide retention with the user before changing it. Split documents only with evidence and a compatibility plan. |
| A8: Resolve legacy AI lifecycle | Read-only inventory of live endpoint configuration and traffic, then check older-client dependence. | Written retain/disable/retire decision, current product/privacy documentation aligned, and explicit rollout/backward-compatibility checks. Source presence alone is not proof of usage. |

## Continuing practice

- Apply the review level in `AGENTS.md` to each PR; avoid making every cosmetic
  change a full audit.
- Add small behavioral tests at the boundary being changed. Source-string tests
  can supplement but should not replace the relevant runtime test.
- Preserve user drafts, units, imported provenance, completed sets and independent
  recipient copies during any refactor or migration.
- Keep architecture/source-map documentation current when ownership changes;
  leave historical checkpoints dated rather than treating them as current specs.
- A release still needs its normal native/Play checks. Documentation-only work
  does not require another AAB.
