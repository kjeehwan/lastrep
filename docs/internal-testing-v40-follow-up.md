# Internal testing v40 follow-up

The user accepted signed-in reopening, Health Connect permissions navigation,
and Profile save on the Play-installed v40. The affected newer Samsung phone's
permissions check is postponed.

## Repeated body sync feedback

The user reported no new sleep/body data, yet body sync reported success and
advanced its last-sync time while sleep did not. The body services reread the
latest available measurement and unconditionally saved it as a successful
import. This did not establish that new measurements existed.

On branch `fix/body-sync-change-detection`, both Health Connect and Samsung Health
compare normalized import fingerprints before writing imported snapshots/history
or advancing `lastSyncedAt`. Health Connect fingerprints include per-metric
timestamps so changes below another metric's latest timestamp are not missed.
Newer same-valued measurements and corrections still count as changes. Missing
provider timestamps do not cause repeated artificial imports. Existing profiles
can seed comparison metadata without changing their saved timestamp/history.

Successful check times are stored locally per account/provider, separately from
imports, to retain automatic-sync throttling after unchanged/empty reads. An
explicit Sync now can still retry immediately. Failed imports do not receive a
successful-check marker. Provider permissions, read windows and selected provider
are unchanged. Profile now says "No new body composition data found" for an
empty or unchanged result.

The user also requested removing the redundant Supported data row from Profile's
Health sync section. Individual Sleep and Body composition states remain.

Verification: 14 focused behavioral tests exercise real service entry points with
mocked provider/storage boundaries. The full suite passed 699 tests with 22
emulator-dependent skips; TypeScript, lint and web export passed. After removing
the presentation row, TypeScript/lint and the combined optimized dev APK passed.
On the connected Android 13 Samsung, two completed Sync now actions both reported
no new sleep/body data, while both displayed sync timestamps remained unchanged.
Native inspection confirmed Supported data is absent and individual sync details
remain. No measurement values are included in these notes; raw artifacts remain
ignored locally. Play Protect requested a scan during the dev installation; the
user handled that system prompt. Current/earlier dev APK signing certificates
and requested permissions matched.

The user approved both the simplified section and repeated-sync behavior, then
authorized split commits, push, PR review, merge, fresh Expo Doctor and the next
production AAB. The installed production v40 does not yet contain this change.
The affected newer Samsung phone's verification remains postponed.
