# Sleep Notebook Native Migration

Branch: `feature/sleep-notebook-ui`.
Based on main after Nutrition PR #36, merge `a08d1a3`.
Design authority: `training-notebook-design.md` v1.17, Sleep section and approved
`prototypes/training-notebook/sleep.html` states. Browser fixtures are not used
as application records or passed to account services.

## Scope and Mapping

| Approved element | Native implementation | Preservation contract |
| --- | --- | --- |
| Sticky centered toolbar | NotebookHeader | Back returns Home; notebook system/tab colors |
| Selected date | SleepCalendar, previous/next | Monday-first; direct day selection; future dates disabled |
| Daily total | SleepScreen | Wake-date total, target delta, source and actual record/save timestamp; missing is not zero |
| Personal target | SleepTargetEditor | Shared sleepSettings.targetHours with Profile, validation and visible save errors |
| Multiple entries | sleepSessionModel / sleepJournal | Split nights, naps, stable manual/provider IDs and derived daily totals |
| Time entry | SleepEntryEditor / SleepDial | Empty examples, 24-hour five-minute dial, exact typed minutes, explicit dates |
| Duration only | Same editor | Prefill existing amount; no invented times; Cancel leaves records unchanged |
| Session details | SleepScreen | Manual edit/permanent delete; imported correction/exclusion; no excluded-entry list |
| Daily chart | SleepHistoryChart | 14 actual calendar dates, gaps, full-cell selection, target rule, latest view |
| Weekly summary | weeklySleepSummary | Seven dates ending on selection, average excludes missing days, explicit coverage |
| Record browsing | Chart and calendar | Native review removes the duplicate View records list; graph selection shows the actual date/duration |
| Health sync | Existing consent and permission flow | Current-device access independent of saved account data |
| Setup guidance | Sleep setup sheet | Android 14+ built-in settings vs older provider install/update; unsupported fallback |
| Popups | SleepSheet / NotebookModal / AdaptiveModalCard | Notebook fonts/colors, contrasting buttons, outside/Back dismissal, tab clearance |

No native dependency, Health Connect write permission or new runtime permission
was added. Existing installed dev client can load this JS migration through Metro.

## Storage and Compatibility

- Each session is an owner-only document in `users/{uid}/sleepSessions`.
- Manual records retain actual timestamps, entered timezone and offsets where
  times are known. Duration-only records have no fabricated interval.
- Provider records retain origin + ID, raw start/end instants, last-modified and
  client version metadata and available stages. Native adapter offsets are
  retained when supplied; the installed adapter currently omits them.
- Existing recent daily totals become explicit legacy entries on the first
  journal write. Old undated totals remain visible and can be assigned a date.
  Simply viewing the screen does not manually rewrite records; eligible automatic
  health sync can perform the journal migration as part of its existing behavior.
- A root journal revision serializes mutations and summary writes. Conflicting
  concurrent saves reload/retry; a failed transaction commits neither sessions
  nor a partial summary. Large changes above 450 documents are rejected explicitly.
- Existing nightly-summary consumers retain their contract. A separate
  `journalSummary` snapshot prevents older installed clients from overwriting the
  new client's ledger-derived readings through legacy summary-field writes.
- Manual saves never change `lastSyncedAt`. Sync cursors, installation identity
  and successful check times are local and account-scoped where appropriate.
- Account deletion already uses recursive user-document deletion, so it includes
  the new collection. Current privacy text covers sleep sessions/duration and
  account health-data storage; AI requests still use summaries, not raw stages.

## Aggregation and Import Rules

- New timed manual entries validate more than 0 and no more than 24 elapsed hours,
  actual local dates/times, DST transitions and nonfuture wake instants.
- A complete known stage sequence can yield asleep time excluding awake/out-of-bed
  stages. Partial or missing stages yield session duration, explicitly labeled.
- Manual corrections have priority. The saved account origin follows, then stable
  origin/ID ordering. Known intervals are unioned across sources and wake dates.
  A lower-priority provider cannot fill a preferred provider's awake minutes.
- Unknown-time entries cannot be safely interval-deduplicated. Same-day timed
  imports remain inspectable for review rather than added blindly. New manual
  conflicts require explicit review and replace only listed entries.
- Corrections preserve the original as excluded and reference its ID. Re-import
  retains exclusions. Manual Delete removes the document in the same transaction
  as derived summaries. Imported sessions cannot be hard-deleted through this
  mutation API. Deleting a manual correction keeps the original exclusion marker.
- The initial import reads every page of the existing 30-day access window,
  establishing a changes cursor before the read. Later checks consume all changes
  pages, including deletions. Expired cursors trigger another complete read.
- No missing row in an incremental/partial response is treated as deleted. A
  successful full-window refresh reconciles absences only for that installation's
  previously imported records entirely inside that window. Other devices' saved
  entries are not deleted because this device cannot see them.
- Consent and native Sleep permission are checked before reads and before commit.
  Concurrent calls share one in-flight account import. Cursors advance only after
  persistence. Empty successful checks update check time, not measurement time.
- Provider-offset absence is disclosed. Re-import preserves an existing diary
  allocation when offsets are missing. This adapter does not expose system-wide
  provider priority; the app does not claim its totals are Health Connect's own
  deduplicated aggregate.

Primary reference: [Android sleep experience guidance](https://developer.android.com/health-and-fitness/health-connect/experiences/sleep).
Installed adapter behavior was checked in react-native-health-connect's typed
read/changes APIs and native ReactSleepSessionRecord implementation.

## Verification Checkpoint

- Nutrition: commit `85e1617`, PR #36 passed GitHub quality and Vercel checks,
  merged as `a08d1a3`; local and remote feature branches deleted.
- Sleep TypeScript and Expo lint pass with no warnings. The ordinary suite passes
  407 tests; 22 emulator/integration tests are skipped in that ordinary run.
  A subsequent layout regression test also passes, covering metadata rows and
  separators only between visible sleep entries; TypeScript remains clean.
- The separate Firestore emulator run passes 22 tests (owner rules plus journal
  integration). Expo web export passes. The final owner-only session rule,
  including undated legacy entries, is deployed to `lastrep-ebac5`.
- Firestore emulator tests exercise real owner rules plus atomic split-session
  persistence, concurrent additions, correction/re-import, authorization failure
  and unchanged sync timestamps after manual saves.
- Model tests cover split night + nap, touching endpoints, overlap review, legacy
  conflicts, cross-date/provider deduplication, complete/partial stages, actual
  elapsed DST hours, skipped/repeated times and coverage excluding missing dates.
- Mocked sync tests cover app/native consent denial, paging, changes/deletions,
  expired cursor, consent revoked during import, empty check and in-flight reuse.
- Phone: migrated page loaded existing account sleep after the new owner rule was
  deployed. Automatic consented sync imported actual provider sessions/stages.
- Phone draft-only check: entered 2300 and 0700; fields formatted 23:00 / 07:00,
  preview calculated eight hours. With the keyboard open, both inputs were at
  y=280-412, Save at y=976-1102 and Cancel at y=1123-1249, all above the keyboard.
  Android Back first dismissed the keyboard and then the sheet. No draft was saved.
- Phone: the B clock handle updates its matching time input; target editor loads
  the saved value; future calendar dates are disabled. All drafts were cancelled.
- Light paper, dark paper, 200% portrait text and 200% landscape rendering were
  inspected on the connected phone. System accessibility changes briefly recreate
  the activity; testing explicitly reopened Sleep after those changes. Original
  dark mode, 1.1 font scale and portrait rotation were restored afterward.
- Screenshots/logs are ignored local artifacts in `.dev-tools/sleep-*`.

## Native Review Refinements

- Equal explicit calendar column widths align weekday headings and single-/
  double-digit dates. Row heights accommodate enlarged fonts.
- Removed redundant Total for [date] text, left-aligned Add sleep session to
  the content edge and balanced excluded-entry spacing between section rules.
- Superseded imported daily totals are hidden from Sleep entries, including the
  excluded-entry list, and removed from active aggregation. Internal legacy rows
  remain for compatibility; user exclusion markers still prevent re-import.
  Replacement requires combined imported session-window duration to match the
  old total within its one-decimal rounding tolerance, or an explicit correction.
  Same-date presence alone is insufficient: a nap must not replace a whole night.
  Unmatched historical totals remain available; no historical database purge runs.
- Daily total and selected graph date show Time asleep for complete stage data,
  otherwise May include awake time. Mixed totals carry the warning if any counted
  contribution lacks complete stages. Zero-contribution duplicates do not downgrade
  the label. Entry details use asleep time as the headline when available.
- Removed View records and its duplicate list; chart/calendar handle date review.
- The initial JS scroll-back correction was rejected in review because it exposed
  a brief intermediate jump. It has been removed, including its animation-frame
  scheduling and programmatic scroll calls.
- Native anchoring and a retained-height floor also failed visual review despite
  matching final bounds. Both experiments have been removed.
- User approved independent graph selection: tapping a bar changes only the
  graph date, duration and weekly statistics. The summary/session date changes
  through the date/calendar control, which resets graph selection. This avoids
  changing above-chart content while browsing history.
- Typecheck, lint and 394 ordinary tests pass after this change. A source-contract
  test guards independent selection and absence of scroll compensation. Final
  on-phone checks confirm repeated Oct 14/16/17 bar selections update graph date,
  duration and weekly statistics while preserving bar bounds [734,484][881,959].
  The main date and session remained Oct 16. Calendar selection of Oct 14 changed
  both the main view and graph to Oct 14; restored Oct 16 afterward. No records
  were saved/deleted. The user subsequently confirmed Jump LGTM.
- Entry separators appear only between visible entries; no trailing rule duplicates
  the next section boundary. Source/session count and recorded timestamp are
  separate text rows. The shared specification generalizes this divider rule.
- Removed View excluded entries and restore controls. All excluded/provider-deleted
  records stay hidden; sections with no visible entries are omitted. Manual deletion
  confirmation states that it is permanent; imported exclusion explains re-import
  prevention. Phone confirmation was opened/cancelled without deleting user data.

- User confirmed manual-delete persistence and overlap review. Profile's initial
  target load did not handle cross-tab changes: its existing user snapshot listener
  now reconciles sleepSettings.targetHours into both field and saved baseline.
  Unsaved target edits are preserved, with Discard rebased to the latest saved
  value. User verified live target updates in both directions without reload.

## Acceptance and Coverage

- Native visual approval, light/dark, rotation and enlarged text.
- User approved manual test-entry deletion and persistence after reopening, no
  excluded-entry action, overlap review, and target sync in both directions.
- User approved independent chart selection with no visible jump, calendar and
  earlier native layout refinements. Read-only phone checks covered both duration
  labels and removal of superseded totals; emulator tests cover import exclusions,
  correction deletion, atomic summaries and prevention of re-import.
- Light/dark, rotation, enlarged text and keyboard handling were checked during
  migration; not every write flow was repeated under every display configuration.
- Do not modify real sleep records merely to demonstrate write behavior; use a
  test account/date or rely on the emulator checks until the user chooses to test.

## Boundaries

The provider adapter does not supply timezone offsets today; no native offset
patch is included. Unknown offsets are not invented. No new write access to Health
Connect, sleep-quality score, inferred stage or fabricated bedtime is added.
Session documents are retained with the account; the current journal loads that
account's session history. Long-running/high-volume histories may need paged
queries later. Source priority is explicit app policy, not a system aggregate API.
User approved publishing and merging this separate Sleep migration after final checks.
