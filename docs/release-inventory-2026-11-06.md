# Release inventory and resume checkpoint

Prepared November 6, 2026. The user initially chose to wait for the usage reset.
Release verification subsequently resumed; see the
[preflight results](release-preflight-2026-11-06.md) for required Expo patch updates,
fresh checks and remaining build steps. The baseline inventory below is historical.

## Source and baseline

- Reviewed source: `bb707a2af16f4fa526c95051bc45f179116e238e`, merged PR #88.
- Baseline: archived production AAB **1.0.1 (44)**, built by EAS from
  `800d2d5535ff6fabcbd3911221b4c465e5a09fbe`. The local archive's validation
  report confirms package `com.kjeehwan.lastrep`, source commit and version.
  The conversation records the user's production review of this release.
- This is the latest local release archive, not a fresh Play Console/EAS query.
  Recheck both before selecting the next version code. Do not assume 45 is free.
- No changes to dependency manifests/lockfile, `app.config.ts`, `eas.json`,
  tracked Android or plugins between that baseline and the reviewed source.
- Documentation branch: `docs/release-inventory-2026-11-06`. This checkpoint is
  initially uncommitted; the application source still matches the reviewed main.

## App changes awaiting distribution

| Change | Source / PR | Existing evidence and release focus |
| --- | --- | --- |
| Program-title pencil matches workout-title pencil | PR #76, `8e1b575` | User approved the dev-app appearance. Brief check of active program header, long title and edit tap target. |
| Atomic body-history additions/imports | PR #79, `ebe6fc2` | Disposable integration tests cover concurrency and import identity; native saving and failed-connection retry were checked. Preserve partial metrics and old records; retry must retain the input. |
| Entitlement state belongs to the current account | PR #82, `d34eac9` | Android 16 synthetic premium/free switching and sign-out passed. Confirm no stale premium presentation while the next account loads. Real Play purchase/restore was not covered by that test. |
| One root profile snapshot per Today's Plan context load | PR #84, `afaaf30` | Regression tests cover parsing, summary precedence and account isolation; native context/review checked. Nutrition and sleep public loaders reuse the extracted parsers. Guidance behavior should remain equivalent. |
| Bounded sleep-history display and explicit commands | PR #86, `334e363` | Full-window completeness, revision checks, account-owned caches and safe full-ledger fallback tested. Check date selection, chart/history navigation, refresh/error presentation and unchanged sleep targets. |
| Scoped sleep mutations and summary refill | PR #87, `f146e6b` | 1,022 tests passed with emulators at that checkpoint. Android 16 covered old-date editing, cancellation, draft-date preservation and failed save/retry. Check add/edit/delete and summary behavior; imported exclusions and legacy fallback remain important integration cases. |

Primary verification records:

- [Native cleanup verification](architecture-cleanup-native-verification.md)
- [Sleep first increment](sleep-history-scoped-read-verification.md)
- [Sleep scoped mutations](sleep-scoped-mutation-verification.md)

Existing checks are dated evidence, not a claim that a new production artifact
has passed. No personal health values or account identifiers belong in this file.

## Backend, website and development changes

These changes do not require an AAB to take effect:

- Billing account-lifecycle protection, PR #81: `revenuecatWebhook` version 23
  deployed and ACTIVE; unauthenticated/method guards verified. Authenticated
  behavior covered with disposable emulator accounts, not real purchases.
- Both sleep query indexes were deployed and verified READY during PR #86/#87
  delivery. Check their current state before release if investigating index or
  query failures; avoid redeploying unrelated Firebase targets.
- Legacy AI lifecycle, PR #88: `getDailyDecision` version 65 ACTIVE with
  `ENABLE_OPENAI_DECISION=false`; older-client fallback and cache retained.
  Both unused AI debug endpoints removed. Deployed source matched reviewed source.
  See the [runbook](legacy-ai-lifecycle-runbook.md). No new provider transfer.
- Homepage, search visibility, hosted-page/store-listing assets and documentation,
  PR #77: separate from native app distribution. Play listing publication and
  Search Console state are user-managed and were not freshly queried here.
- Architecture rules, audit, PR template and CI, PR #78/#80/#83/#85: development
  safeguards, including app typecheck and a separate Firebase boundary job.

PR #88's post-merge run **42204644729** passed both `quality` and
`firebase-boundaries`. These jobs cover backend build, lint, application typecheck,
tracked Android verification, tests, web export and disposable Firebase boundaries.
They do not establish production signing, final AAB configuration or Play billing.

## Resume after usage reset

1. Inspect Git status, checkpoint and current main. Preserve any later changes.
   Confirm the release source and refresh this inventory if main has advanced.
2. Review the recorded native checks and run a focused release pass for body
   saving/retry, entitlement account ownership, Today's Plan context and sleep
   editing/history. Use disposable accounts and synthetic records. Confirm the
   runtime package and backend before mutations; a dev package is not isolation.
   A phone can supplement native review, but personal records/permissions must
   remain untouched without explicit authorization. Do not repeat every previous
   test just to increase check counts.
3. Run a **fresh** `npx.cmd --yes expo-doctor@latest` on the final intended source.
   Respect the [documented native-config exception](expo-doctor-exceptions.md).
   Resolve unexpected failures and run affected checks before building.
4. Recheck latest Play version, EAS remote counter and cloud-build availability.
   Choose EAS versus the [local production procedure](local-production-builds.md)
   using current evidence. No new counter value, credentials or build was queried
   or changed during this inventory.
5. On the resumed build authorization, build the intended production AAB with
   production Firebase/Google sign-in/RevenueCat configuration, canonical HTTPS
   sharing URL, existing upload key and no QA overrides.
6. Verify the final artifact: package, version, signature, non-debuggable manifest,
   SDKs, architectures, bundled configuration and required native patches. Archive
   checksums, mapping and source/build metadata. Then prepare concise release notes.
7. User handles Play upload/review/promotion. A Play-installed update must preserve
   existing data and cover basic launch/sign-in, workout, sleep and sharing paths.
   Real billing acceptance requires that installation path; emulator entitlement
   tests do not substitute for it.

No new data collection, permission, retention or provider transfer was introduced
by the listed client changes. Revisit policy/declaration requirements if release
scope changes; do not automatically edit the privacy policy's effective date.

## Deliberate follow-ups, outside this release

- A5: extract workout orchestration incrementally when changing those flows.
- Broader A7 restructuring: needs evidence and a compatibility/retention decision.
- A8: inspect usage after the November 6 disablement (approximately December 6),
  plus supported-client adoption, before deciding whether to remove the legacy
  endpoint. Removal is not automatic and does not prevent future OpenAI features.

No automated reminder was created. No native settings, services, accounts,
production records or deployment targets were changed by this inventory task.
