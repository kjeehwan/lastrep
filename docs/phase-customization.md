# Custom training and diet phases

Implemented October 28, 2026; awaiting user review. No AAB or native dependency
changes are needed for dev review.

Home and Profile use `PhaseEditor`: Edit current phase and Start new phase are
separate actions. The default popup is a compact summary: tappable name/pencil,
muted type/week metadata and a Current week navigation row. Inputs appear when
the name or week is tapped. Save changes / Done appears only after a change.
Start new phase sits below a divider and opens a compact name/pencil, Phase type
and Starting week layout. Type choices and name/week inputs appear on demand.
Current and starting week fields use a 72-dp base width, scaled with system text.
Back to current phase restores its unsaved input. Explanations
live behind the circled i beside the header title. Both offer a custom name and week; only a new phase offers a
different canonical type. Clearing a name restores the type's display label.
Home saves directly. Profile's Done stages changes for top-level Save; Cancel
leaves the prior draft intact. Home, Profile and Workout display custom names,
and known weeks. Recommendation and nutrition logic still uses canonical types.

The transaction validates type, name length and week. Current edits preserve the
real phase start/history. Week corrections use a separate timestamp/base, and
advance automatically. New phases can repeat the same type, start at another
week, and append a new history entry. Legacy accounts without a start retain an
unknown week unless the user supplies one. Missing legacy types use existing
Hypertrophy/Maintain defaults. A later start written by an older app invalidates
an earlier week correction. Stale phase-start edits fail rather than overwrite
a different phase; request IDs prevent a partially completed Profile save retry
from starting the same phase twice.

Verification:

- Android 16 local emulator: renamed Power to Winter power, changed its current
  week to 7, and observed the same value on Profile. Started Bulk at Week 3 via
  Profile, verified the staged summary, saved and observed the clean Profile and
  matching Home values after a cold reopen.
- At 200% system text, the sheet scrolls to its week/explanation and actions;
  restored font scale to 1.0 afterward.
- Galaxy Android 13: inspected the new phase popup and closed it without saving.
  Existing Strength / Week 1 appears in the active Workout header. No real
  phases, workout sets or profile fields were edited.
- TypeScript, lint and web export passed. 837 tests passed, 40 skipped. Tests
  cover name-only edits, independent week advancement, same-type new phases,
  legacy defaults, stale edits, validation, retry idempotency and Profile save
  routing. The existing source contract checks now reference the shared editor.

Subsequent changes in this working branch align the sharing editor title font
and header help placement. Background rest alerts are documented separately in
[workout-rest-alerts.md](workout-rest-alerts.md).

The simplified popup layout was inspected on Galaxy Android 13 in light mode
and Android 16 in dark mode. TypeScript, focused ESLint and 43 phase/Profile tests
passed after the layout refinement. Existing real-phone popup input was left
untouched; the visual check did not apply or discard it.

The subsequent compact-summary refinement was checked on both devices. On the
emulator, tapping Current week revealed its input; changing 7 to 8 revealed Save.
Tapping the name revealed its input and selected the existing text. A draft name
and week survived switching to New phase and back. Test edits were not applied.
