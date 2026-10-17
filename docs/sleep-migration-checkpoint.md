# Sleep Migration Checkpoint

Updated October 17, 2026. Branch: `feature/sleep-notebook-ui`.

## Final Handoff

This checkpoint records the earlier implementation pauses. It is superseded by
the user's final approval: manual delete/reopen, overlap, and live sleep-target
sync in both directions passed. User requested commit, push, PR and merge.
Do not treat historical pending-review instructions below as current blockers.
See `sleep-notebook-migration.md` for final acceptance and remaining coverage limits.

## Current State

- Nutrition migration was merged in PR #36 and its feature branch deleted.
- Sleep migration is implemented and approved for commit and PR merge.
- Full implementation and validation notes: `docs/sleep-notebook-migration.md`.
- Expected worktree includes Sleep screen/components, session ledger/import/model,
  tests, Firestore rules, notebook navigation geometry and design documentation.
  Preserve all existing changes. Publish the approved Sleep batch separately.
- Owner-only sleep-session Firestore rules have already been deployed to
  `lastrep-ebac5`. No native dependency or permission changes require rebuilding.

## Latest Approved Change

User approved independent graph selection after repeated visible scroll jumps.
Implemented in `src/sleep/SleepScreen.tsx`:

- `selectedDate` controls top summary, session list and date/calendar editing.
- `chartDate` controls the graph; `chartSelected = chartDate ?? selected`.
- Bar taps use `setChartDate`, updating graph duration/date and weekly statistics
  only. Date/calendar changes reset chart selection.
- Removed failed JS scroll compensation, native anchoring, stable-group wrappers
  and height-floor experiments. Deleted temporary sleepScrollAnchor source/tests.
- Added `src/sleep/sleepChartSelection.test.ts` to guard separation.
- Latest results: TypeScript exit 0, lint exit 0, 407 tests passed, 22 skipped.
  The separate Firestore emulator rerun also passed all 22 tests after this change.
- Phone verification completed on resume: repeated Oct 14/16/17 bar selections
  update graph date, duration and weekly statistics; Oct 16 bar bounds remain
  [734,484][881,959]. Main date/session remained Oct 16. Calendar selection of
  Oct 14 updated the full day and graph; restored Oct 16 afterward. No sleep
  records saved/deleted. User subsequently approved the graph: Jump LGTM.

## Sleep Duration Question

Verified Oct 16 phone data: imported session 00:41-07:01 is about 6 h 20 min
elapsed. Legacy code rounded elapsed duration to 6.3 hours (6 h 18 min).
Complete stages now yield 5 h 31 min actually asleep, excluding about 49 minutes
awake/out-of-bed. These are not competing Samsung Health/Health Connect totals.

User approved hiding obsolete totals and labeling duration limitations. Implemented:
superseded health legacy totals are absent from active totals and UI, including
View excluded entries. Internal rows remain for compatibility and re-import safety.
Unmatched historical totals are preserved. Replacement requires matching combined
session-window duration within one-decimal rounding tolerance, not merely a session
on the same date. Daily/graph totals show Time asleep or May include awake time.
Phone verified Oct 16 shows only 5 h 31 min asleep, with no obsolete 6 h 18 min row;
Oct 13 retains 7 h 50 min session duration with May include awake time. Restored
Oct 16. No user records manually saved/deleted. Await final user approval.

User subsequently requested removal of View excluded entries. Implemented permanent
manual document deletion with atomic summary updates; imported removal keeps hidden
exclusion markers. Stale deletes are rejected. Deleting a manual correction does
not revive its provider original. Removed excluded-entry list/restore UI and empty
sections. Phone shows no excluded-list action; permanent-delete confirmation was
checked and cancelled without modifying user data. User can now repeat deletion
on their own test entry and reopen to verify the intended behavior.

User confirmed manual deletion persists with no excluded button and overlap LGTM.
Profile target stayed stale after Sleep saves because it only read it on initial
load. Added sleepTargetDraft reconciliation to its existing Firestore user listener,
updating the field and baseline while preserving local unsaved target edits. Five
tests cover clean/dirty drafts, invalid values and listener wiring. Phone displays
saved 8 hours. Final check: save another target in Sleep, verify Profile without
reload; save in Profile and verify Sleep. Profile route is intentionally modified
as part of this migration, not unrelated work to revert.

## Resume Steps

1. Read this checkpoint, migration notes and current git diff.
2. Verify phone/Metro availability. Phone R5CN506HB8D was connected on resume.
   Metro restarted on 8081, exec session 52073; do not start duplicates.
3. On Sleep, browse recorded/missing bars repeatedly. Confirm graph date, duration
   and weekly statistics change, while top date/session list and vertical scroll
   stay unchanged. Calendar selection should update the full day and reset graph.
4. If needed, cold-reload the dev app to avoid a stale Fast Refresh module graph.
   Do not save/delete actual user sleep records for demonstration.
5. Report results honestly and obtain user visual approval before commit/push.

## Phone Helpers

ADB: `$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe`.
Ignored `.dev-tools/notebook-phone-tools.ps1` contains Read-PhoneUi,
Tap-PhoneNode and Capture-Phone. Inspect fresh UI bounds before tapping; offscreen
nodes can have invalid bounds. Use tools.view_image for saved screenshots.

Cold reload, if Metro is available and ADB reverse is configured:

```powershell
adb -s R5CN506HB8D shell am force-stop com.kjeehwan.lastrep.dev
adb -s R5CN506HB8D shell am start -a android.intent.action.VIEW -d 'lastrep-dev://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' com.kjeehwan.lastrep.dev
```

Last display state restored to dark, font_scale 1.1, portrait rotation 0.
Ordinary test logs are in ignored `.dev-tools/sleep-chart-{types,lint,tests}.log`.
