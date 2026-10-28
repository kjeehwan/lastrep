# Android workout rest alerts

Rest timers use a native Android AlarmManager alarm and notification, so their
deadline does not depend on JavaScript running while another app is open or the
screen is locked. The notification uses the bundled gong, follows notification
volume and Do Not Disturb, and opens Workout when tapped. Lock-screen public
content says only that rest finished; exercise names remain private.

The first timer offers notification and Alarms & reminders setup. Declining
keeps the foreground timer usable. Enable background alerts remains available
in the rest popup when access is missing. This uses SCHEDULE_EXACT_ALARM, not
USE_EXACT_ALARM. Permission changes are refreshed when the app becomes active.

Pause, reset/skip, exercise deletion and workout completion/discard cancel their
alarms. Resume schedules the remaining duration. Account changes cancel all
alarms from the previous account. Native deadlines are persisted and consumed
once so native delivery and foreground completion cannot ring twice. Canceled
deadlines cannot be rearmed by a stale synchronization. Permission checks use
the latest timer state rather than a pre-start snapshot.

Force-stopping the app or rebooting can remove Android alarms. Reopening
reconciles future timers; already missed timers do not replay a late gong.
No continuous background service, background network work or full-screen
notification is introduced.

## Verification — October 28, 2026

- Android 16 emulator: alert delivered while Android Settings was foreground,
  and in a separate run while the screen was locked. Native notification state
  confirmed delivery at the deadline with the bundled gong channel. Returning
  to Workout retained the same notification creation/update time (no repost).
- Galaxy Android 13: alert delivered while Android Settings was foreground;
  returning to Workout did not repost it. Pause canceled the pending alarm,
  resume created a new deadline, and skip canceled it. The temporary exercise
  was removed and its original 90-second rest preference restored. No workout
  was saved, completed, or discarded during these tests.
- Emulator also verified running-timer Reset cancellation. Its 120-second rest
  preference was restored afterward.
- Notification state verifies configured sound and delivery, not a listener's
  subjective audibility. Device volume, silent mode and DND still apply.
- The user then confirmed a real set-completion timer alerted while listening
  to a Spotify podcast: vibration in vibration mode, and audible gong plus
  vibration in Sound mode. Notification volume was sufficient.
- The dev APK compiled and installed on both devices. Pure tests cover deadline
  stability, paused/deleted/reset timers, resumed deadlines and suppression of
  late/background foreground fallback sounds. Native verification checks
  registration, template parity, receiver privacy, permissions and gong asset.
- Final TypeScript, full lint, web export and native verification passed;
  the test suite passed 841 tests with 40 intentionally skipped.

The older phone test draft appeared empty after the APK restarts; the cause was
not established. The user confirmed it was a disposable test draft. This is not
claimed as diagnosed or fixed by the rest-alert change.
