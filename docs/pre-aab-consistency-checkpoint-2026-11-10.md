# Pre-AAB consistency review - November 10, 2026

Branch: `fix/pre-release-workout-consistency`, based on main `4b72216`.
The user authorized commit/push, PR review/merge/branch deletion and the next
production AAB on November 10. Play Console submission remains the user's step.

## Final behavior

- Continue program describes today's calendar day even after completion, with a
  Completed subtitle. The next unfinished day remains a separate progress cursor.
  Overdue workouts remain pending. The schedule strip shows dates and checkmarks;
  rust marks Today, neutral ink marks selection. Tap any day directly; no Next
  label or View pending day shortcut. Include the next-cycle pending day when needed.
- Rest-day details say Rest day and omit a successfully loaded empty workout list.
  Existing records appear under Additional workouts. Loading and retryable errors
  remain distinct from empty results. Schedule help uses short icon/description rows.
- Phase dates use a calendar and calculate weeks after explicit date selection.
  Legacy manual weeks are preserved until that selection. Phase history includes
  Current and derived date ranges. Past dates/removals stage until Save, with Undo,
  chronology validation and stale-edit protection. Adjacent same-type phases remain
  separate; end dates derive from the next start. Dated phases have no confirm prompt.
- Cardio recognition repairs legacy resistance defaults; distance follows Profile's
  km/mi preference unless overridden per exercise. Cardio/resistance swipe-delete
  share growing reveals, trash icons, full-swipe dismissal and Undo.
- Last copies load/reps while preserving current recorded RPE/RIR. Duplicate clears
  actual effort/completion. Explicit copy revisions refresh focused native rows
  without animation or temporary success banners moving the keyboard/field.
- Optional default-off rest sound can use alarm audio in Vibrate/Silent mode. It
  respects alarm volume/DND, changes no system volume or sound mode, and uses a
  separate notification channel plus short native playback. Device/account-owned
  setting resets on account change; older APKs hide the unsupported option.
- Confirmed remote completion stops local draft clocks and excludes finished
  program copies from Resume. Local contents stay privately preserved; no recovery
  dialog or automatic separate workout. The save transaction rejects a second
  workout for the same occurrence while retaining same-ID retry idempotence.

## Architecture and data boundaries

Pure helpers own date/phase/occurrence selection and set-copy semantics. Existing
phase-save transactions retain ownership of account changes. Completion listeners
and async draft checks guard account identity, lifecycle and superseded requests;
parked checks do not delay offline hydration. No completion is inferred from elapsed
time or cursor alone. No cloud workout is overwritten during local reconciliation.
Android sources and native-override templates stay synchronized; WAKE_LOCK supports
short alarm playback. No Firebase functions/rules deployment is needed for this batch.
Privacy review found no new collection, provider transfer or retention-policy change.

## Verification

- Fresh Expo Doctor: 20/20 passed; documented tracked-Android config exception retained.
- Full application suite: 135 passed / 10 skipped files; 973 passed / 100 skipped
  tests. Skips are emulator-dependent suites exercised separately by CI.
- Affected disposable Firestore program integration: 7/7 passed, including the
  duplicate-save guard. Application TypeScript, lint, native verifier, backend build,
  web export and whitespace checks passed. Export required normal-user access to
  Expo's existing log file; the first sandbox run could not open it.
- Dev APK compiled for phone/emulator architectures and installed preserving data.
  Synthetic emulator checks covered phase date/history Save/Cancel/Undo/removal,
  Last copying with actual IME focus and unchanged field bounds, cardio swipe/Undo,
  remote program completion, stopped timers and preserved local notes.
- User accepted background gong audibility in Vibrate/Silent mode, program dates,
  copy behavior, icons and schedule flow. Fresh read-only phone screenshots and
  taps verified phase intervals/Current, both phase editors, completed Day 6 as
  Continue's default, Day 7 access, Today highlight and empty rest-day presentation.
  No automated personal record, permission, volume or schedule edits were made.
- Nonempty Additional workouts/error presentation and next-cycle strip overflow
  were inspected in code; no personal records were created to test those states.

## Environment and handoff

Disposable emulator accounts/documents/caches/credential files were removed and
all temporary device settings restored. Task Metro8083 stopped; normal8082 retained.
A stalled ADB server previously caused a blank screen and Unable to load script.
Restarting only that server and restoring8082 forwarding recovered normal operation.
The underlying server-stall cause is unknown. Future phone handoffs must verify a
fresh rendered screenshot and target-screen navigation, not just launch success.

Live EAS preflight showed production 1.0.1 (46) as latest and remote counter46.
Next build uses the production profile with auto-increment; record the actual
allocated version, source commit, build ID/link and remaining artifact checks when
EAS accepts it. Submit with --no-wait; the user will report completion.

## Draft Play release notes

- Clearer program days, rest days and scheduling.
- Edit phase start dates and history with automatic week counts.
- Improved cardio units and set deletion.
- Smoother Last-set copying that preserves recorded effort.
- Optional rest sounds in Vibrate/Silent mode.
- Fixed finished workouts reappearing as resumable program drafts.
