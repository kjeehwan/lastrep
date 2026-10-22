# Saved workout date and duration corrections

October 23, 2026. The HTML mockup and native editor were approved. Workout Day
totals use the selected weight unit alone, without an appended "volume" suffix.
No production build or deployment is part of this task.

## Behavior

Home Calendar → recorded day → **Edit details** on the selected workout opens a
date calendar and hours/minutes editor. The duration uses the approved borderless
Set Cardio Time treatment and direct numeric entry. Hours do not wrap. Save is
disabled while unchanged. Missing historical durations remain blank rather than
becoming zero; date-only corrections preserve the original duration precision.

Cancel, outside tap and Android Back discard editor changes. Cancelling the date
picker retains the duration draft. Saving prevents repeat submission/dismissal;
failure preserves the draft. Offline feedback disappears after reconnecting.

A Firestore transaction updates only changed `date`/`durationMin` fields and
`updatedAt` on the existing document. It preserves exercises, notes, feedback,
creation time and any concurrent changes to unrelated fields. Deleted records,
changed metadata and account switches cannot silently recreate or overwrite a
record. Conflicts offer **Refresh workout** instead of retrying a stale edit.

Confirmed saves update Home's selected date/month, workout ordering, calendar
markers and computed summaries. The destination can contain multiple workouts.
An older in-flight fetch cannot overwrite the corrected local metadata. The
active workout draft and timers are separate from this editor.

The editor opts into Android keyboard padding instead of the shared frame's
default height behavior, avoiding a cached portrait height after rotation.
Short windows reduce card padding and viewport margin; other editors retain
their existing defaults. Native inputs remain mounted and focused.

## Verification

Android 16 emulator with local Auth/Firestore services and disposable records:

- Unchanged Save disabled; duration save, date-only change across a month boundary,
  cleared old calendar marker and two workouts retained on the destination day.
- Cancelled edits, blank missing duration, outside dismissal and Android Back.
- Offline Save retained edits; reconnect cleared the warning and retry succeeded.
- A concurrent metadata change was rejected; Refresh loaded the current record.
- Reopening retained the corrected records. Stored-record comparisons confirmed
  exercise data, notes, feedback, creation time and the second record were preserved.
- Light/Dark, keyboard input, rotation with focus, retained entered minutes,
  landscape scrolling and enlarged-text action reachability. A rotation frame
  issue found during these checks was corrected and retested visually.

The connected Samsung Android 13 phone was checked for entry, initial disabled
Save, numeric keyboard, cancelled typing and unchanged original field values.
No real workout was saved or altered. Its existing nine-exercise draft fingerprint
was unchanged. Physical-device saving against a disposable account and Play-build
verification remain separate from these checks.

Fresh TypeScript and lint checks passed; the full unit suite passed with 732 tests
and 22 ordinary emulator-dependent skips. Local native dev APK compilation and
web export passed. Screenshots, emulator
credentials, logs and detailed test scripts remain in ignored `.dev-tools`;
never add them to a PR.
