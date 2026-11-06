# Sleep history: scoped reads and safe edits

Status: approved; first increment merged in PR #86; second implemented, checked and approved for delivery.
Date: November 6, 2026. Source reviewed: `b5ddf8a`.
Related: [audit measurements](architecture-cleanup-measurements-2026-11-06.md)
and [cleanup backlog](architecture-cleanup-backlog.md).
Implementation evidence: [first-increment verification](sleep-history-scoped-read-verification.md).
Second increment: [scoped mutation verification](sleep-scoped-mutation-verification.md).

## Recommended direction

Keep the existing sleep records, calculations and screen layout. Load the dates
being viewed, and make a normal edit read the affected records instead of the
whole account history. Preserve a full-ledger fallback when a safe smaller scope
cannot be established. Do this in two separately reviewed increments:

1. Windowed history loading and explicit mutation commands. Keep the existing
   full-ledger mutation calculation initially, establishing equivalent behavior.
2. Scoped mutation reads, incremental compatibility summaries and measured
   fallbacks, after equivalence tests prove the dependency scope is complete.

The first increment reduces routine screen-loading work. The second addresses
the full-history read on each edit. Neither deletes or expires older history.
There is no new setting, navigation flow, sleep algorithm or backend service.

## Baseline before the first increment

- `sleepJournal.ts` loads every `sleepSessions` document. Each mutation fetches
  them from the server again and can repeat that read on revision conflicts.
- `useSleepJournal.ts` reloads that collection when the root journal revision
  changes. `SleepScreen.tsx` derives every day even though the chart displays
  only 14 calendar dates and the selected week uses seven dates.
- Manual edits and deletions operate through generic callbacks accepting the
  entire ledger. Imported corrections/exclusions depend on stable entry identity.
- `sleep.ts` normally reads a 30-day provider window, but change-feed deletion
  IDs can identify an older saved entry. Provider pagination/change tokens must
  remain complete before a sync can be committed.
- The root profile stores the latest **30 recorded days**, not necessarily the
  latest 30 calendar dates. Today's Plan and Home consume these summaries.

The prior local benchmark showed median edits of 48 / 105 / 452 ms for
30 / 365 / 1,825 records. These are emulator measurements, not phone latency or
production cost predictions.

## Behavior that must remain the same

- Overlapping minutes count once, including sessions assigned different dates.
  Manual data wins, then the preferred provider, then the existing stable order.
- Complete stage data can distinguish asleep time from awake time; incomplete
  stages retain the current session-duration behavior.
- Unknown-time totals, legacy totals and timed sessions retain their current
  review/supersession rules. Missing data remains different from a recorded zero.
- Manual corrections and imported exclusions survive later imports. Provider
  deletions and user exclusions remain separate flags, without a new expiry.
- Date allocation, stored offsets/time zone, DST behavior and undated legacy
  records retain their meanings. Travel must not move old records to new dates.
- Edits still reject changed records/conflicts, permission revocation and stale
  accounts; failed saves retain user input. A partial read cannot authorize a
  replacement or silently delete unseen records.

## 1. Windowed display reads

Use one account profile snapshot for the root summary, target, origin and journal
revision. Choose the initial date from the saved latest recorded date, as the
screen does now, or today when there is no dated record. An account with only
older records must still open on its latest recorded day.

Load the union of:

- the chart's visible 14 dates;
- the selected seven-day comparison;
- the selected entry date, if outside either range;
- any additional dependencies required to derive those dates correctly.

The current calendar has no record markers. Merely opening it need not load a
whole month; selecting a different date requests that date/chart/week window.
Keep the existing navigation and touch scrolling. Older records stay accessible.

Query dated rows by `dateKey`, with deterministic document-ID cursor ordering
and an initial internal page size of 100. Read **all pages within the requested
scope** before publishing final totals; 100 is a transport batch, not a history
cap. Resolve undated legacy rows separately, without inventing a date for them.

The first increment needs the date/overlap scope reader described in section 3
for display derivation too, with the same completeness tests and full-read
fallback. It must not simply slice a date query and assume external intervals
cannot affect it. The second increment extends that reader to old/new mutation
dependencies and provider reconciliation.

Each window is explicitly loading, complete or failed. Do not show "No saved
record" or a zero for an unloaded/failed date. Retain already loaded values with
their existing error state while refreshing. A later page must not alter a total
that was prematurely presented as complete.

Cache by UID, window, journal revision and preferred origin. Root revision/origin
changes invalidate the visible window; they do not trigger an all-history reload.
Drop account-owned cache references and ignore stale requests on account change.
Bracket multi-query loading with a revision check; retry a window if a writer
changed it during loading. Preserve the user's selected date/scroll position.

## 2. Explicit mutation commands

Replace the production generic `(allEntries) => nextEntries` interface with
commands that declare their inputs and expected records:

| Command | Required inputs |
| --- | --- |
| Add/edit manual entry | Candidate; expected original entry when editing; explicitly reviewed replacement entries/signatures |
| Delete/exclude entry | Expected entry and signature; existing manual-delete/import-exclude semantics |
| Reconcile provider changes | Complete upserts, deletion IDs, import device, optional completed full-read window, origin and authorization callback |

The repository chooses reads. Callers must not assume that an array containing
only a date window is the whole ledger. Keep the current pure domain functions
as the calculation oracle while changing their surrounding I/O.

Return a result describing the committed revision, affected dates and root
summary. Do not return a partial array under the old promise of a complete
ledger. In particular, `sleep.ts` currently derives its latest sync result from
the returned array; it must use the committed summary instead.

## 3. Find a complete dependency scope

A fixed "selected day plus yesterday" scope is insufficient. The current model
deduplicates absolute time across dates, and chains of overlapping sessions can
extend beyond one neighboring day.

Start with the candidate's old/new dates, original/replacement IDs and incoming
provider IDs. Expand until no new dependencies appear:

1. Load all rows for every affected `dateKey`, including unknown-time totals,
   legacy rows and exclusion/deletion markers needed by reconciliation.
2. For every affected timed interval, find saved intervals overlapping it in
   absolute time, regardless of their allocated `dateKey`. Add both old and new
   intervals when a record's times change.
3. Add the full date groups of newly found overlapping rows and repeat the
   interval search. This closes same-date unknown-total/legacy dependencies too.
4. Resolve correction references/originals and explicitly reviewed replacements
   by ID, including references outside the visible date window.

Example: A overlaps B and B overlaps C, but A does not overlap C. Removing A can
change B's counted time and, depending on priority, C's. Fetching only A and B
is not a sufficient general derivation scope. Different date labels do not make
these intervals independent.

Use indexed absolute interval predicates, not a presumed 24-hour look-back over
all saved data. Current entry creation validates session length, but the existing
saved-record reader/rules do not establish that invariant for every historic row.

Firestore supports multi-field range filters, but index ordering affects scanned
entries. Prototype the overlap queries and indexes against synthetic histories;
fewer returned documents alone does not prove lower billed work. See the official
[multi-field range guidance](https://firebase.google.com/docs/firestore/query-data/multiple-range-fields)
and [index optimization guidance](https://firebase.google.com/docs/firestore/query-data/multiple-range-optimize-indexes).

An initial internal scope budget can be 500 fetched records or eight expansion
rounds. Reaching it triggers the existing full-ledger calculation, **not a
truncated calculation or lost-data error**. Measure and adjust these values.
Use the full path as well for an unprovable legacy/index case or a preferred-origin
change that would otherwise invalidate derivation outside the chosen scope.
Do not claim a strict maximum read count for arbitrary overlap chains.

## 4. Keep commits and summaries consistent

Retain the existing optimistic revision protocol:

1. Read root revision R and establish the complete dependency scope from server
   data. Perform provider I/O outside transaction callbacks.
2. Recheck expected entry/replacement signatures, apply the pure mutation and
   derive the complete affected date groups. Reject totals above 24 hours.
3. Build changes only for explicitly loaded/command-owned IDs. An absent row in
   this subset is never evidence that an unrelated saved row should be deleted.
4. In one transaction, reread the root and require revision R, then write the
   changed/deleted rows and root compatibility summary with revision R+1.
5. If the revision changed, discard the scope and repeat its reads/calculation.
   Keep the current finite retry/error behavior and authorization checks.

This relies on the existing application writer contract: every ledger mutation
increments the root revision. New clients must remain compatible with shipped
clients using that protocol. Do not introduce a derived index that older writers
can silently leave stale.

Merge recalculated affected days into the current `journalSummary`/30 recorded-day
list. If removing or moving a listed day exposes an older 31st day, page backward
through complete date groups to refill it. Do not substitute a 30-calendar-day
query, and do not lose an unaffected day merely because it was outside the edit
window. If completeness cannot be established, use the full-ledger fallback.

When the journal has not been bootstrapped, preserve all dated legacy root rows
and the undated fallback during the first mutation. Do not set the migrated
revision after copying only the currently visible legacy date. Keep
`journalSummary` separate from fields still writable by pre-ledger clients.

## 5. Provider reconciliation

- Fetch existing incoming identities directly so updates that move a record to
  a different time/date do not create a second identity or drop its exclusion.
- Resolve deletion IDs using the current import-device/provider-ID matching
  semantics, including records older than the normal provider read window.
- For a completed full-window read, fetch saved records needed to detect missing
  provider entries from that device. Mark only records fully inside that covered
  interval missing, as the current reconciliation does. Neighboring sessions are
  calculation dependencies, not proof of provider deletion.
- Preserve complete page/change-feed processing, deletion precedence, change-token
  recovery, device identity, time-zone allocation and replay idempotency.
- Persist the provider cursor only after the ledger transaction succeeds. A
  permission/identity change or failed page must not save a partial sync.

## Delivery and acceptance

| Increment | Scope | Acceptance evidence |
| --- | --- | --- |
| First | Complete date/overlap display reader and its indexes/fallback; account/revision-aware cache; explicit commands still using full mutation calculation | Display derivation equals full-ledger results, including cross-date dependencies; existing layout/navigation, latest-old-record selection, correct loading/empty/error states, complete page boundaries, account switch and legacy behavior; existing integration suites pass |
| Second | Scoped command queries, old/new/import dependency expansion, summary refill and any additional indexes | Scoped output equals full-ledger output for the cases below; normal edit reads are independent of unrelated lifetime history; retry/import behavior unchanged |

Tests must compare both resulting canonical records and complete derived totals,
source/review flags and compatibility summaries. Include:

- old/new-date edits, additions, deletions and concurrent writers;
- three-record overlap chains across allocated dates, manual/provider priority,
  complete/partial stages, unknown-time totals and legacy supersession;
- manual corrections, excluded imports replayed later, full-window missing rows,
  deletion IDs outside the read window, cursor expiry and permission revocation;
- DST/travel/date offsets, undated legacy data, deleting the latest/30th recorded
  day, sparse histories, zero totals and malformed fetched records;
- dates with more than one transport page and deliberately exceeded scope budgets;
- older-client writes during a scoped operation and stale-account callbacks.

Repeat the 30/365/1,825-entry benchmark, separating initial display, normal edit,
import and fallback. Record documents returned, query count, derivation work and
latency; review index scans separately before making production cost claims.
Growing unrelated history must not increase a normal scoped edit's fetched rows.

Validate required indexes in a controlled environment before rollout; the local
emulator alone does not prove deployed index availability/cost. Native review
must cover loading an older date, editing, overlap confirmation, cancellation,
failed-save retry and restoring selection. No user data migration, new retention
policy or background job is proposed.

## Original design review decision

Recommend approving the two-increment direction, with the first PR focused on
windowed display reads and explicit commands. Keep the verified full calculation
as the fallback/oracle until the second increment proves complete scoped behavior.
This is a gradual improvement, not a replacement sleep system. Application code,
indexes and deployments remain unchanged in this design task.
