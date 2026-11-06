# Sleep scoped mutations: implementation and verification

November 6, 2026. Branch `feat/sleep-scoped-mutations`, base `334e363` (PR #86).
Status: implemented, checked and approved for delivery. The checks below precede
commit/deployment; their delivery outcomes are recorded in the PR. No AAB was built.
Related: [approved design](sleep-history-read-design.md) and
[first increment](sleep-history-scoped-read-verification.md).

## Data and responsibility boundaries

- `sleepJournal.ts` retains transaction ownership, authorization before reads
  and before commit, four revision retries, expected-record checks, the 450-change
  limit and atomic record/summary updates. Commands read the root from the server;
  the transaction rechecks both revision and the profile signature used to plan
  the write. The generic full-ledger mutation remains an oracle/compatibility path.
- `sleepJournalQueries.ts` shares complete paginated reads and the 500-record
  budget between display and mutations. `sleepJournalRecords.ts` owns existing
  validation, legacy conversion and profile signatures, avoiding a dependency
  cycle between query code and the transaction repository.
- `sleepMutationScope.ts` resolves old/new identities and allocated dates,
  interval overlaps, full date groups, correction references, undated rows,
  provider deletion IDs and completed provider windows. It reuses the same pure
  command and sleep derivation functions as the full-ledger path.
- Provider identities are loaded before computing allocation-timezone-dependent
  new dates. Deletion-ID queries are independent of date, so an old deletion is
  not lost outside the normal provider read window. Matching device/full-window
  deletion semantics remain owned by `reconcileHealthSleep`.
- Provider reconciliation still considers legacy totals globally: the pure
  reconciler can exclude an already superseded legacy total even outside the new
  import's dates. Those totals and their dependency groups must be loaded too.
- Only command-owned changes within the complete loaded component are diffed.
  An absent row outside it is not a deletion. No new schema, stored diagnostics,
  retention rule, health permission or provider transfer is introduced.
- `sleepJournalSummary.ts` merges complete recalculated date groups into the
  existing latest **30 recorded days**. Deleting/moving listed days can trigger
  backward paging; each page-boundary date is completed before deriving it.
  Paging stops only when the top 30 are proven or older history is exhausted.
- Legacy/unusable summaries, changed provider preference, missing indexes,
  excessive scope/refill work or unprovable intervals use the full-ledger
  fallback. Network/permission failures remain errors. Existing root-summary
  authority and the writer revision contract remain assumptions; out-of-band
  ledger writes that omit revision/summary maintenance are not supported.
- Commands return transient read diagnostics for verification. They do not return
  a partial ledger under an account-wide contract. Normal caller behavior and
  provider cursor persistence after successful commit remain unchanged.

## Draft recovery fixes found during verification

- Offline server reads surfaced Firebase's technical cache instructions. Command
  network errors now say, "Could not save sleep. Reconnect and try again." Domain
  conflicts and stale-entry messages retain their existing meaning.
- A duration draft previously read its date from the live parent selection.
  Newer history arriving while the editor was open could move that selection.
  The editor now snapshots its opening date alongside its expected entry, so a
  refresh/retry cannot silently move the draft to another day. Explicit bedtime/
  wake-date editing continues to work as before.

## Automated evidence

- **140 files / 1,022 tests passed, zero skipped**, with disposable local
  Firestore/Storage emulators enabled.
- Firebase boundary gate: **10 files / 97 tests, zero skipped**. The new
  integration suite is automatically discovered by the existing CI runner.
- Application TypeScript, lint and Expo web export passed.
- Canonical records, full derived totals/flags and compatibility profiles are
  compared against the full-ledger oracle for edits across dates, cross-date
  overlap chains, staged corrections/replay, provider deletions outside the read
  window, missing provider records, allocation timezones and legacy supersession.
- Tests cover deletion of the latest/30th recorded day, moving a listed day
  earlier, sparse weekly histories, multi-day provider deletion/refill, a refill
  boundary containing over 100 excluded records and a replacement over 100 rows.
- Deterministic revision changes and concurrent older full-ledger writers retain
  both additions. Revoked authorization, conflicts and offline reads do not
  commit a partial command. Missing indexes use full fallback; permission and
  unavailable errors are not disguised as complete scopes.
- Large synthetic fixtures bypass rules only during seeding. Measured reads and
  command transactions use the authenticated account; separate rules tests run
  in the same boundary gate.

One final emulator sample (setup excluded; latency includes command commit):

| Operation | Recorded dates | Session docs returned | Ledger queries | Final derivation entries | ms |
| --- | --- | --- | --- | --- | --- |
| Initial display | 30 | 14 | 4 | 14 | 179 |
| Initial display | 365 | 14 | 4 | 14 | 211 |
| Initial display | 1,825 | 14 | 4 | 14 | 362 |
| Edit one duration | 30 | 2 | 4 | 1 | 51 |
| Edit one duration | 365 | 2 | 4 | 1 | 79 |
| Edit one duration | 1,825 | 2 | 4 | 1 | 110 |
| Provider delta update | 30 | 4 | 7 | 1 | 102 |
| Provider delta update | 365 | 4 | 7 | 1 | 94 |
| Provider delta update | 1,825 | 4 | 7 | 1 | 196 |
| Preference-change fallback | 30 | 30 | 1 | 30 | 54 |
| Preference-change fallback | 365 | 365 | 4 | 365 | 159 |
| Preference-change fallback | 1,825 | 1,825 | 19 | 1,825 | 1,228 |

Document counts include repeated query returns, not just distinct records. They
exclude root reads; a successful command normally has its initial root read and
transaction root read, with additional reads on retries. Empty queries have
minimum billing. These are not production cost/latency claims or index-scan
measurements. Large imports, sparse refill across exclusions, legacy totals and
widely separated interval envelopes can still legitimately require full reads.

## Android verification

Android 16 emulator `emulator-5554`, `com.kjeehwan.lastrep.dev`, Metro 8082.
Confirmed runtime project `demo-lastrep-sharing`; used one task-created local
account with synthetic records. No personal records or permissions changed.

- Opened the latest historical record (January 1, 2020).
- Adding another duration opened overlap confirmation without changing the
  original. Back-to-edit and Cancel preserved the original seven-hour entry.
- Opened its duration editor, then simulated a newer-day update. The parent
  selection changed to November 6, but the draft still displayed January 1.
- Edited to six hours, disabled only that local Firestore session's networking
  and attempted save. The editor retained six hours and showed retry guidance.
- Re-enabled networking and retried. The editor closed, selection returned to
  January 1 and it showed six hours. Server verification found the newer one-hour
  record unchanged, both summary dates retained and exactly one committed revision
  after the failed attempt.
- Original local account, Home route and networking restored; disposable records,
  account and credential/cache artifacts removed after checks.

No physical-phone review or real provider sensor/permission change was performed.
Provider reconciliation/cursor/permission behavior was checked with synthetic
integration records and the existing provider adapter tests.

## Release requirements

The existing `endMs, startMs` interval index from PR #86 remains unchanged.
A new `startMs, endMs` index is declared for contained provider-window queries;
starting the index with the window's lower bound avoids intentionally leading
that query with all historical end times. At the implementation checkpoint it
was not deployed. Deployment follows PR merge; its outcome is recorded in the
PR delivery notes. Missing-index fallback remains safe. Verify production index
scans separately before making performance/cost claims.

User review is complete and delivery is approved; a future app release is needed.
`doc/privacy.md` needs no change: this modifies I/O scope, not collected data,
sharing, retention or provider use.
