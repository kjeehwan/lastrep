# Workout programs / unified Today's Plan — native savepoint

**Superseded after resuming November 2:** see
[`workout-programs-native-review.md`](./workout-programs-native-review.md) for
the latest fixes, verification and phone-review status. The concerns and counts
below describe the earlier savepoint, not the current remaining work.

November 2, 2026. Paused at the user's usage-limit checkpoint request.

Branch: `feat/workout-programs-todays-plan`, based on approved browser checkpoint
`8812920` on `design/unified-todays-plan`. This is **unfinished native work**.
Do not merge, deploy production rules, build an AAB, or claim native acceptance.
No real-account workout/routine data was used for these tests.

## Implemented so far

- Native Workout choices, blank 1–14-day program setup, stable-ID routine
  assignment, explicit activation, saved programs, resume/restart, schedule
  controls, program strip and prior-run browsing.
- Explicit program/run/occurrence identity. Workout save and day completion use
  a transaction and a stable retry ID. Standalone saves cannot advance a program.
- Account-scoped parked workout drafts and Resume selection; program routine
  creation uses the existing editor and saves its assignment before restoring
  the prior workout. Old program route redirects into the new manager.
- Shared, dated cloud recovery check-in for Home and Workout, staged Save/Cancel,
  missing-input gating and input-revision invalidation of old advice.
- Performance-led progression from optional targets, custom rep steps,
  preferred/maximum increases and Available weights. No readiness-only increase;
  recent load reductions prevent using older heavy lifts to leapfrog a rebuild.
- Selective exercise Apply; completed, effort-recorded and special sets are
  protected. Review context separates recovery, performance and phase weeks.
- Explicit seven-day deload proposal, period and per-exercise applied marker;
  normal routines are preserved. Returning restores untouched prescriptions and
  retains edited/recorded sets. This last UI path still needs emulator checks.
- Owner-only program/run/occurrence rules added locally, not production-deployed.

## Verification at checkpoint

- Latest TypeScript check passed.
- Latest targeted ESLint check passed with no findings (log:
  `.dev-tools/program-savepoint-lint.json`).
- Latest focused suite: **51 passed**, covering decision logic, progression,
  program dates/identity, parked drafts and deload rules/restoration.
- Earlier full run: **865 passed, 45 skipped** across 125 files, before the final
  deload/integration changes. Repeat the full suite after finishing those changes.
- Local Firestore transaction + owner-rule suite: **20 passed**, including
  atomic/idempotent completion, standalone isolation, restart archives and
  deletion preserving routines/workouts. Repeat after repository changes.
- Android 16 emulator: blank entry choices; create a three-day `CycleQA` program;
  assign Chest + Triceps, Back + Biceps, Rest; explicit Start confirmation;
  Continue loads Bench Press 3 × 6 × 80 kg, targets and program strip. Missing
  recovery form opens; Cancel writes nothing. Final modifications happened after
  these screen checks, so this is not final native acceptance.

## Resume in this order

1. Review current diff and finish integration safeguards below. Keep tests local.
2. Cold-reopen the emulator after edits; run end-to-end checks for recovery
   Save/Cancel and Home synchronization; selective Apply/Undo/stale advice;
   progression settings; deload confirm/decline, expiry/return and protected sets.
3. Check both draft paths and reopening; routine-builder Save/Cancel/Back and
   assignment restoration; duplicate routine names; activation/resume/restart
   cancel/confirm; previous completed history; deletion; linked vs standalone
   successful saves and failure/retry. Verify persisted records, not just labels.
4. Check light/dark, larger text, keyboard/landscape and first/middle/last dividers.
   Run TypeScript, lint, full tests, relevant local rule/transaction tests and
   native bundle validation. Only then arrange phone review. No AAB requested.

## Integration concerns to inspect

- `saveProgram` currently merges the supplied `runId`; reject stale manager
  snapshots if activation on another client changed it.
- Partial program deletion sets `deleting`, but `useWorkoutPrograms` currently
  filters those records out. Keep a retry path if cleanup fails.
- Routine-builder Cancel restores the original draft and requests the assignment
  popup. Header/Android Back currently returns choices and preserves the builder;
  finish the approved cancel/restore navigation and test it. Empty builder Save
  placement/disabled state also needs review.
- Confirm parked drafts remain accessible after program restart/deletion, and
  corrupted storage cannot be overwritten by autosave. Inspect account-change
  boundaries and async callbacks.
- Verify repeated deload reviews do not compound reductions. Check backup and
  per-exercise markers survive hydration, selective Apply and Undo. In particular,
  review all context branches that return before the deload branch.
- Review routine preview before loading an empty program workout against the
  approved mockup; Continue currently loads the routine explicitly, then reviews.
- Finish regression tests for actual-effort protection and context revision.
- Update implementation documentation only with verified behavior. Canonical
  design: `docs/training-notebook-design.md` v1.48 and
  `docs/unified-todays-plan-mockup.md`.

## Local QA environment

- Emulator: `emulator-5554`, Android 16, AVD `Medium_Phone`, headless. It initially
  froze/offlined after long uptime; restarting that emulator without wiping data
  restored it. ADB is `%LOCALAPPDATA%/Android/Sdk/platform-tools/adb.exe`.
- Existing Metro: port **8082**, local `demo-lastrep-sharing` Firebase configuration.
  Port 8081 was closed. Existing Firebase emulator hub 14400, auth 19100,
  Firestore 18081, functions 15001. Reuse; do not start conflicting services.
- Local test UID: `0RcmAM9DKokr7bsxGNzhqoKrpHfI`, nickname `Program review`.
  Three synthetic routines and the CycleQA program. It is local only; do not
  replace real production/dev account credentials. Backend rules were loaded
  into this emulator project only.
- Restore ADB reverse ports 8082, 19100, 18081, 15001 after emulator restart.
  App package `com.kjeehwan.lastrep.dev`; launch URI:
  `lastrep-dev://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082`.
- Helpers/artifacts (ignored): `.dev-tools/health-popup-ui.py`,
  `program-eval.cjs`, `program-runtime-info.js`, `program-local-rules.cjs`,
  `program-seed-runtime.js`, `program-full-tests.log`, and
  `health-popup-emulator-5554-program-*.xml/png`.
- Metro `/json/list` exposes the disposable runtime. Check `firebaseConfig.projectId`
  starts with `demo-` before any fixture writes. RN's Promise polyfill means CDP
  `awaitPromise` may return a promise-shaped object before completion; verify
  eventual results separately.
- Allow UI/keyboard transitions to settle and verify native focus before typing.
  Unfocused `adb input text` containing `r` can trigger the dev reload shortcut.
  Cold-start after hook/modal hot reloads; do not mistake stale modal state for
  a successful interaction. No crash was established in the keyboard investigation.
- Local test command (PowerShell): set `FIRESTORE_EMULATOR_HOST=127.0.0.1:18081`,
  then `npx.cmd vitest run src/workouts/programStore.emulator.test.ts src/firestore.rules.test.ts`.
  Plain `npx` is blocked by PowerShell script policy; use `npx.cmd`.

No native changes have been pushed, merged, deployed or included in an AAB.
