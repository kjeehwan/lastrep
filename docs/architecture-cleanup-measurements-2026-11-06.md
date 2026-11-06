# Architecture cleanup: measurements and next-stage decisions

November 6, 2026. Follow-up to the
[audit](architecture-audit-2026-11-06.md) and
[cleanup backlog](architecture-cleanup-backlog.md).
Measurements below did not change application behavior or live user data.

## A6 — Sleep journal growth

Used the actual `getSleepJournal` and `mutateSleepJournal` against a disposable
local Firestore emulator. Seeded 30, 365 and 1,825 dated duration entries, including
excluded health imports at every seventh entry. Per size, loaded the ledger once
and made three edits to one manual entry, retaining revision/summary behavior.

| Ledger entries | Entries loaded | Initial read (ms) | Three edits (ms) | Median edit (ms) |
| ---: | ---: | ---: | --- | ---: |
| 30 | 30 | 58 | 62, 48, 44 | 48 |
| 365 | 365 | 117 | 120, 103, 105 | 105 |
| 1,825 | 1,825 | 472 | 461, 436, 452 | 452 |

These are single-machine emulator observations, not production/mobile latency or
billing predictions. Network, cache, hardware, history shape and concurrency
change the timings. The decisive structural fact remains that every mutation
queries the entire ledger, including excluded rows; a local edit does not have a
bounded record-read footprint. Revision conflicts can repeat this work.

Proposed next design, requiring review before implementation:

1. Page historical display separately from recent summaries.
2. Scope mutation reads to affected dates and overlapping sessions. Cross-midnight
   sessions and source reconciliation require neighboring dates, not just the
   edited row. Preserve exclusions and import identity.
3. Keep revision-based consistency and compatibility summaries. Do not merely add
   a query limit, which would silently omit older data from derivation.
4. Validate summary equivalence, legacy undated entries, overlap, exclusions,
   imports, deletion and concurrency before migration/release.

This supports planned maintenance; the measured data does not establish an urgent
production performance incident.

## A7 — Root profile read inventory

`loadWorkoutPlanContext` starts three root-document reads at the application-call
level: its direct `getDoc`, `getNutritionProfile`, and `getSleepProfile`. Each reads
`users/{uid}`. It additionally queries today's meals and up to 120 workouts, then
loads nutrition trends. The repeated root reads can also yield different profile
revisions during a concurrent update.

A safe first optimization is to expose pure nutrition/sleep profile parsers,
load the root once per context request and derive all three views from that
snapshot. Keep public loaders for other callers. Verify equivalent defaults,
journal-summary precedence, units/targets and account isolation. This reduces
application calls from three to one; actual billed-read savings are unmeasured
because SDK caching/multiplexing can affect requests.

No root-document split, history migration or 400-entry retention change was made.
Those require separate evidence and product decisions.

## A8 — Legacy AI endpoint inventory

Read-only Firebase inventory confirms `getDailyDecision` remains deployed in
`lastrep-ebac5`, region `asia-northeast3`, Node.js 22. The CLI listing did not
establish its effective OpenAI enable configuration.

A bounded query requesting the latest 50 log lines returned five entries dated
November 3, 2026, including one execution start and one execution end. Payloads
and account identifiers were not copied into this report. This is not a complete
traffic or cost measurement and does not establish that an OpenAI request occurred.

Current decision: retain the endpoint for compatibility while clarifying its
consumers. The current Today's Plan action uses the deterministic local engine.
There is insufficient evidence to retire a deployed callable safely merely
because the latest client no longer calls it.

Before disabling/removing it, establish a defined observation window, inspect
request outcomes/provider-call metrics and relevant installed-client versions,
then choose a supported fallback and rollout policy. Do not infer zero cost or
zero use from the limited log sample.

## Release boundary

The first-stage fixes are merged, not all released. Billing needs a scoped backend
deployment; client fixes need native release verification and a future app build.
No deployment, release or personal-account test mutation occurred in this stage.
