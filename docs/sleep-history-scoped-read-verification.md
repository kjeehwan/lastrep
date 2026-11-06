# Sleep history: first-increment verification

November 6, 2026. Branch `feat/sleep-history-scoped-reads`, based on `b5ddf8a`.
Related: [approved design](sleep-history-read-design.md).

## Implemented boundary

- `sleepJournalWindow.ts` reads the selected date, 14-date chart and selected
  seven-date comparison together. Each query pages to completion in batches of
  100. Initial selection remains the latest recorded day, including old histories.
- `sleepWindowScope.ts` closes full date groups, absolute-time overlap chains and
  correction references in both directions. It retains exclusions, provider
  deletion markers and undated legacy rows. It does not assume historical
  intervals are limited to 24 hours.
- Reads are bracketed by root revision/origin/summary checks. An oversized or
  unprovable scope, legacy root-only profile or unavailable interval index uses
  the full-ledger fallback. Permission/network failures remain errors.
- The hook caches up to eight completed windows in memory per account and
  revision/origin. Account changes drop the cache and invalidate pending results.
  A failed new window cannot display an empty chart or zero/missing daily total.
  A completed window may remain visible while refreshing with an error notice.
  Cold-start offline reads cannot establish completeness; the UI requires retry.
- Sleep targets remain owned by the settings listener. Cached history cannot
  overwrite a more recently changed target.
- Production save, delete/exclude and provider-import callers now issue explicit
  commands. Expected entry/replacement signatures reject stale edits, including
  an original deleted elsewhere. Results expose revision, affected dates and
  committed summary rather than a ledger array.
- **Writes still read and derive the entire ledger.** Existing revision retries,
  authorization checks, transactional summaries, 30 recorded-day retention and
  provider cursor ordering remain in place. Scoped writes are increment 2.

No schema, retention, provider permission or privacy-policy change is needed.
The old generic mutation helper remains for compatibility/oracle tests; current
production callers use commands.

## Automated evidence

- Application TypeScript, lint and Expo web export passed.
- Full suite with disposable Firestore/Storage emulators: **138 files, 990 tests
  passed, zero skipped**.
- Firebase boundary gate: **9 files, 70 tests, zero skipped**. The subsequent
  full suite includes those same boundary tests and five additional reader tests.
- Coverage includes pagination beyond 100 records, cross-date overlap closure,
  unknown-time totals, source priority, correction links, exclusions, legacy
  migration, concurrent commands and stale edits. Forty varied synthetic ledgers
  compare scoped daily totals/flags against the existing full-ledger calculation.
- Reader tests force a missing index, a revision change between reads, repeated
  conflicts and permission failures. They verify complete fallback/retry or an
  error rather than a partial result.
- Synthetic fixture setup bypasses rules for the large read benchmark; measured
  queries use the authenticated owner. Transactional command tests and the
  separate rules suite retain authenticated writes.

One local Firestore emulator sample, excluding fixture setup:

| Recorded dates | Session documents returned | Ledger queries | Entries derived | Read latency |
| --- | --- | --- | --- | --- |
| 30 | 14 | 4 | 14 | 126 ms |
| 365 | 14 | 4 | 14 | 148 ms |
| 1,825 | 14 | 4 | 14 | 323 ms |

These counts exclude the two root-document reads. Empty queries still have
Firestore minimum billing. This is not a production cost/latency claim: emulator
queries do not prove deployed index availability or index entries scanned/billed.
Overlap-heavy or malformed histories can legitimately require the full ledger.
No write/import read reduction is claimed in this increment.

The large fixture originally exceeded the default five-second test timeout,
causing later fixture interference. Benchmark seeding now bypasses rules, and
this integration suite allows 30 seconds per test. The final combined run passed.

## Android verification

Android 16 emulator `emulator-5554`, package `com.kjeehwan.lastrep.dev`, Metro 8082.
Confirmed runtime project `demo-lastrep-sharing` before mutations. Used two
task-created local accounts and synthetic sleep only.

- A 50-date account opened on February 19, 2020, its latest record, showing seven
  hours and loading 14 entries rather than the full history.
- Selected January 1 while Firestore networking was disabled. The completed
  February window stayed retained; the new date showed history unavailable,
  unloaded chart/comparison states and Retry rather than missing sleep.
- Re-enabled networking and retried. The January window loaded its one saved
  entry and cleared the error.
- Started another history request, then switched to the empty account. It showed
  zero entries, today's initial date and no records from the first account.
- Used the native duration-only form to save 2.5 synthetic hours. The form closed,
  the command committed and the refreshed view contained the saved duration.
- Restored the original local account, Home route and networking. Removed the
  two task-created accounts, records, account caches and credential files.

No physical-phone review, production data mutation, Firebase deployment or new
AAB was performed. This change does not add native controls or permissions.

## Release requirements at implementation verification

User review is complete and delivery is approved. At the implementation-check
checkpoint above, the interval composite index was declared locally but had
not been deployed. Index deployment follows PR merge; its outcome is recorded
in the PR delivery notes. Until that index is available, installed code can
safely fall back to full reads. A future app release is also needed to benefit
installed users; verify production query/index metrics before making cost claims.
