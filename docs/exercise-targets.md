# Optional exercise targets

Exercise targets are optional prescriptions for normal resistance working sets.
The exercise menu opens Targets; a configured exercise also shows a tappable
summary above its set headers. Rep range and effort can be set independently.
Rep endpoints are whole numbers from 1 to 100; effort is RPE 6–10 or RIR 0–4,
following the user's Profile preference. Effort is stored canonically as RPE.

Done applies staged changes. Clear targets stages removal; closing the sheet
discards changes. Actual set reps and effort are never populated by these edits.
Explicit per-set effort prescriptions take precedence over the exercise default.
Warm-up, drop and failure sets do not inherit the exercise default.

Targets survive local drafts, saved routines, completed history, repeat workout,
and shared-plan imports/exports. Loading a routine may fill loads/reps from recent
performance, but retains its prescriptions and clears recorded effort. Legacy
records remain unset. Recommendations retain explicit targets from the latest
matching exercise and honor its rep range; no new progression-suggestion UI is
introduced here.

## Sharing rollout

`targets` is an optional field on the existing shared-plan exercise contract.
Plans without it retain their previous serialized shape. Client, Cloud Functions
contract/parser and hosted preview must ship together before real sharing of
targets is supported. Older clients use a strict parser and reject target-bearing plans. Recipients
need the updated app to open those plans; existing plans without targets still work.

## Verification

- Pure tests cover range/effort validation, RIR conversion, equivalent formatting,
  normal-set defaults, per-set precedence, routine alignment and sharing isolation.
- Firestore emulator tests cover imported routine prescriptions without recorded
  effort; hosted-preview tests cover the separate target summary.
- Android 16 emulator: invalid RPE 20 rejected; staged clear/cancel preserved the
  original; cold restart retained targets; native routine save/load retained targets
  and blank actual effort; completed history stored target RPE 8 separately from
  recorded RPE 9. At 200% text, range fields stack and Done remains accessible
  with the keyboard open. Font scale restored after the check.
- Galaxy Android 13: the user confirmed range/effort editing, summary, clear and
  cancellation. Final labels are Target reps and Target RPE/RIR, without an
  optional suffix. No production workout records were changed by automation.
