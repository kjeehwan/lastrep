# Focused Last copying and rest-sound copy — November 11, 2026

Branch: `fix/focused-last-copy`, based on merged main `722a526`.
Changes are not committed or released. Preserve the existing project-overview
edit recording the user's preference for future local production builds.

## Changes and architecture

- Reproduced the v47 bug on an isolated emulator: with Reps focused, Last changed
  70 kg to 80 kg but left the visible reps at 5 instead of 6.
- The adapter already recognized explicit copy revisions, but the row binder
  still suppressed all focused-field text updates. Pass that explicit-copy fact
  through to the binder. Replace copied text with watchers detached, retain focus
  and clamp the existing selection to the new text. Ordinary typing echoes keep
  their existing protection. Native template and tracked Kotlin match after
  package substitution. No JS state ownership or draft schema changes.
- Rest-sound helpers now read “Follows your phone’s sound mode.” when off and
  “Uses alarm volume, even in Silent mode.” when on. An established info button
  explains alarm/notification volume, possible speaker playback with headphones,
  and Android DND. Sound routing, permissions and timer behavior are unchanged.
- Design rules now require same-row Weight, Reps and effort focus checks and
  short sound helpers with the full explanation in help.
- No collection, provider, retention or privacy-policy changes.

## Verification

- TypeScript, scoped ESLint, native verifier, template parity and whitespace pass.
- Copy-prescription and rest-alert-plan suites: 8/8 tests pass.
- Dual-architecture dev APK compiled successfully with `APP_VARIANT=dev` and
  `:app:assembleDevDebug`; installed preserving emulator and phone data.
- Synthetic Auth/Firestore emulators used demo-lastrep-sharing. Native keyboard
  tests separately focused Weight, Reps and RPE, copied 80 × 6 from history,
  preserved recorded RPE 7, field focus and exact bounds. Subsequent typing passed.
  Cold reopening preserved 80 × 6 and RPE 7. Screenshots visually inspected.
- Off/on rest-sound text and help opened/rendered correctly on the emulator.
  No timer started and no device volume, DND or notification permissions changed.
- One first-launch x86_64 Fabric MountingCoordinator SIGSEGV occurred after APK
  replacement/navigation. A clean force-stop/relaunch recovered; subsequent
  keyboard tests and cold-reopen checks passed. Cause remains unproven; no
  evidence connects it to the Kotlin binder (the crash occurred before a row
  copy). Do not describe this as a verified platform fix.
- Phone: correct dev package updated with `install -r`; normal Metro8082 opened
  it. A fresh Home screenshot confirmed rendered content. No personal workout
  edits were automated. User's focused-copy and sound-copy phone review pending.

## Environment

Disposable local account, documents and account cache were removed; test login
credentials removed. Emulator hardware-keyboard setting restored to its original
0. Task-only Firebase and isolated Metro8083 stopped; normal phone Metro8082 kept.
No production deployment, AAB build or Git delivery performed.

## Follow-up: Notifications placement and Bluetooth verification

- User accepted focused Last copying on the phone.
- Moved sound preference, help and Android notification-settings link to
  Settings > Notifications using existing Settings rows/icons/switch styling.
  Timer retains only the missing-permission shortcut, now Enable rest timer alerts.
- Settings reads native status and writes the same account-owned local preference;
  it never syncs an empty list of clocks. Permission/preference changes notify
  mounted workout hooks to resync their own clocks. Key the Settings component by
  UID; suppress stale results and keep an optimistic switch preview during save.
- TypeScript, scoped lint, whitespace and 12 focused tests pass. Fresh light-mode
  phone screenshot verified the new section and the existing enabled preference.
  No preference toggles or workout edits were automated for this follow-up.
- With the user's Bluetooth headphones connected, triggered short synthetic
  native timer alerts in the dev package using the existing enabled sound override.
  User confirmed the gong plays through BOTH headphones and phone speaker.
  Android dumpsys audio listed speaker and bt_a2dp for alarm routing, and the active
  player used USAGE_ALARM. Test notification cancelled; no sound/volume/DND changes.
- Recommended next decision: headphones only when in use (media volume), otherwise
  speaker (alarm volume when override enabled). No routing changes implemented yet;
  wired headphones remain unverified. Android documents that alarm playback may
  route to multiple outputs and a preferred device is not an exclusive guarantee:
  https://developer.android.com/reference/android/media/MediaPlayer#getRoutedDevice()
- Normal Metro8082 remains available for phone review. No new native build needed
  for this placement-only change. Git delivery remains pending authorization.

## Approved media-volume policy (supersedes the alarm-volume proposal above)

- User approved media volume for BOTH headphones and speaker, removing the
  Vibrate/Silent override. Native gong now uses USAGE_MEDIA. Android's selected
  media output handles wired/Bluetooth headphones and speaker fallback; no device
  is forced and no global volume, ringer, DND or Bluetooth settings are changed.
- A v3 notification channel has no sound; the existing once-only native receiver
  plays the media gong independently of notification/ringer volume. On first
  creation it carries forward the active legacy channel's importance (including
  blocked), vibration/pattern, badge and lock-screen visibility. This migration
  was inspected; blocked-channel migration was not exercised on a personal phone.
  Account guards, timer deadlines, cancellation and late-replay protection remain.
- Removed the obsolete sound preference bridge/type/UI. Legacy stored preference
  is consulted only to select the old channel during migration. Settings now has
  a short Rest timer sound explanation and Android notification-settings link.
  Updated permission prompt and design rules. No privacy/data-transfer changes.
- Dual-architecture dev build passed and was installed preserving app data.
  TypeScript, scoped lint, native verifier, template parity, whitespace and all
  12 focused tests passed. Fresh phone screenshot verifies Notifications without
  the old switch.
- Phone Bluetooth test: dumpsys captured the active gong with USAGE_MEDIA,
  STREAM_MUSIC and output BLUETOOTH_A2DP only (no speaker output). User listening
  confirmation requested and pending. Phone volume/settings unchanged.
- Empty isolated emulator, no cloud account: synthetic native timer fired while
  app was backgrounded, posted a notification and played via media/speaker.
  Media channel sound was null. A zero-volume attempt was inconclusive: shell
  commands left actual media volume at 5. Do NOT claim a successful mute test.
  Wired hardware and real-phone no-headphone/muted playback remain unverified.
- Temporary emulator notifications grant revoked, exact-alarm app-op restored to
  default, media volume verified/restored to original 5, synthetic native owner
  cleared. Phone test notification cancelled. Task-only Metro8083 stopped;
  normal phone Metro8082 retained. No commit, deployment or AAB build performed.

## Rest timer sound switch

- User confirmed Bluetooth-only gong plus vibration/notification on the phone.
- Added default-on Rest timer sound under Settings > Notifications. This mutes
  only Lastrep's media gong, preserving channel permissions/vibration and other
  media. No sound-type selector or separate volume control added.
- Native account-owner-checked `gongEnabled` preference is synchronously committed
  and read at completion. Turning it off stops an in-flight native gong. It remains
  saved for the same native owner across reopen/restart; account change/sign-out
  clears it, restoring the default on, consistently with the previous local alert
  preference. No cross-account mute leakage or cloud/schema changes.
- Foreground fallback checks the native sound preference and does not play on a
  failed status read, so missing native timer records cannot bypass a mute.
  UI uses the existing large switch and optimistic saving/failure rollback;
  results are ignored after account changes/unmount. Native template matches.
- Dual-architecture dev build, TypeScript, scoped lint, native verifier and
  12 existing focused tests passed. Synthetic emulator checks confirmed default
  on, saved mute for the same owner, rejected wrong-owner writes, default on for
  another owner, muted notification delivery without an active MediaPlayer, and
  re-enabled USAGE_MEDIA playback. Foreground fallback failure handling and
  mid-gong stop are code-inspected, not separately exercised at runtime.
- Installed preserving phone data. Fresh phone screenshot visually verified the
  on switch and helper in Notifications. Phone preference was not toggled by
  automation. User on/off phone review remains available; prior Bluetooth-only
  routing is unchanged. Wired and hardware media-zero checks remain unverified.
- Synthetic owner/timers cleared; temporary emulator notification and exact-alarm
  permissions restored; task Metro8083 stopped, normal phone8082 retained.
  No Git delivery, deployment or AAB performed.

## Rest timer layout and sound help

- User accepted both on/off sound behavior on the phone.
- Moved all sound help into the standard info button beside Rest timer sound in
  Settings. The switch and its persistence/error handling stay unchanged.
- Extracted presentation-only RestTimerSheet, reusing ProfileSheet, ProfileChoices,
  ProfileAction, notebook input and colors/fonts. The workout still owns all clock,
  duration, custom-input and notification-permission state. No native/schema change.
  Removed unused old rest-input styles; other modal styles are unchanged.
- Clear Rest timer header and x close; exercise and large tabular countdown;
  grouped presets/custom seconds; equal Reset and Start/Pause footer actions.
  Footer uses AdaptiveModalCard's existing 12 dp top clearance with 12 dp below its
  divider. Enlarged text stacks fields/actions and grows the numeric input.
- TypeScript, scoped lint and whitespace pass; eight existing focused tests pass.
  Disposable local Auth/Firestore account and synthetic workout used on emulator:
  75-second custom duration applied, presets changed duration, Start closed the
  sheet, reopening/Pause/Reset worked, and x dismissed without resetting clocks.
  Screenshots inspected in dark/light, with numeric keyboard (footer accessible),
  and at font scale 1.5. Live timer text can prevent UI Automator from reaching idle;
  the Start/Pause check used coordinates measured from the prior stable layout.
  Help content opened and closed. Landscape and phone layout review remain pending.
- No automated personal phone edits; phone was in another app during this pass.
  Normal Metro8082 serves the changes for the user's dev review. No APK rebuild
  needed for these TSX-only edits. Disposable account/documents/caches/login files
  removed; original emulator font scale1.0, night mode yes and hardware-keyboard
  setting0 restored. Task-only Firebase and Metro8083 stopped. Git delivery pending.

## Phone refresh correction

- User reported missing Settings sound help. Fresh phone UI confirmed the old
  inline explanation was still displayed despite the newer source/emulator view.
- Restarted only verified phone Metro8082 with --clear and reopened the dev app.
  The cleared bundle compiled, auth restored, and read-only navigation to Settings
  confirmed the help icon beside Rest timer sound with no inline paragraph.
  Opened help, verified its content, dismissed it and left Notifications visible.
  The stale phone bundle was the observed mismatch; watcher/cache cause unproven.
- No source fix, native build, account/preference mutation or extra test run needed.
  New phone server log: .dev-tools/sound-help-phone-metro.log (ignored). Future
  handoffs must verify the changed control on the phone, not just Home rendering
  or successful emulator checks. Timer redesign phone acceptance remains pending.

## Master rest timer alerts control

- Added default-on Rest timer alerts with concise help above Rest timer sound.
  Off disables the sound control without changing its saved value. Android
  permission entry is separately named Allow rest timer alerts, and is hidden
  while the master control is off. No permission prompts when starting muted timers.
- Native owner-checked local preference persists across restart, as does sound.
  Disabling cancels scheduled/delivered alerts and stops the gong, retaining future
  deadlines. Disabled sync stores future deadlines without scheduling them. Native
  completion consumes the deadline silently. Re-enabling first consumes expired
  records, then reschedules future records. The workout's countdown state is not
  reset. Account changes/sign-out restore both defaults, keeping account isolation.
- Foreground fallback checks both flags; settings changes stop any Expo fallback
  gong as well as the native player. Settings requests notify mounted workout
  controllers, which sync their own clocks. No privacy/provider/schema changes.
- Dual-architecture dev APK compiled and installed preserving phone data. TypeScript,
  scoped lint, native verifier, template parity, whitespace and eight existing
  focused tests passed. Native/emulator tests used one disposable local account:
  both defaults on; wrong-owner write rejected; both off survived a full app
  force-stop/relaunch; no notification/player while disabled; sound control disabled;
  UI re-enabling retained sound-off choice; expired muted timer did not replay;
  disabling cancelled an already scheduled alert; enabling rescheduled a future
  deadline into a delivered notification. Personal phone settings weren't toggled.
- Fresh phone screenshot confirmed both new controls and help in Notifications.
  Cleared/restarted only the normal dev server to avoid the earlier stale bundle.
  Normal phone8082 kept. Phone behavior acceptance remains pending; emulator was
  used for state mutations and restart tests. Landscape and wired/zero-media-volume
  hardware checks remain unverified from the earlier batch.
- Disposable native alerts/owner, Auth/Firestore account/documents, caches and
  login files removed. Temporary emulator notification grant revoked and exact
  alarm app-op restored to default; task Firebase and Metro8083 stopped. No volume
  or appearance changes in this pass. Changes remain uncommitted on the same branch.

## Notifications spacing and concise help

- Notifications uses equal 72 dp minimum row heights and centered content for
  both toggle rows and the Android settings link. Added an optional SettingsRow
  style override; other sections retain their default styling.
- Alerts help: "Off keeps the countdown running without sound, vibration or
  notifications." Sound help: "Off mutes only the gong. Uses media volume through
  headphones or the speaker."
- TypeScript, scoped lint and whitespace pass. On the phone, measured adjacent
  label-center gaps were both 231 px; opened both help buttons and verified the
  new messages, then dismissed them. Fresh screenshot inspected. No alert/sound
  preferences changed and no native rebuild required. Changes remain uncommitted.

## Consistent Settings rows across sections

- Moved the 72 dp minimum height into shared SettingsRow, retaining 12 dp vertical
  padding and the section's 16 dp row gap. Ordinary rows center icons, labels,
  values and trailing controls; rows with supporting content retain top alignment
  and can grow. Removed the Notifications-only override and unused style prop.
- Recorded the shared spacing rule in the Settings design specification. This is
  presentation only; no preference, account, billing or timer behavior changed.
- TypeScript, scoped lint and whitespace checks passed. Read-only phone review
  confirmed 231 px adjacent label-center gaps in Sharing, Notifications, Support
  and Development tools. Inspected top and lower-page screenshots; Account and
  Delete account supporting text remains aligned and readable. Production-only
  subscription variants were checked in code, not rendered on this dev package.
  No settings toggled, native rebuild or Git delivery performed.

## Settings divider clearance

- Increased section-container gap from 28 to 40 dp and clearance after the
  divider from 24 to 64 dp. This accounts for the last row's internal blank
  space: at normal text size the visible label-to-divider clearance now matches
  the roughly 62 dp visible gap between ordinary labels. Shared across sections;
  supporting text still grows naturally. Added the visible-clearance design rule.
- TypeScript and scoped lint passed. Fresh phone screenshot inspected across
  Notifications and Support: 231 px label-center steps and approximately matching
  visible label-to-label / label-to-divider clearances. Also inspected the lower
  page with multi-line subscription copy. Read-only navigation; no preferences
  changed. No native rebuild or Git delivery.

## Compact spacing correction (supersedes divider expansion above)

- Prior 72 dp rows plus 64 dp divider padding were too spacious. Reworked the
  shared rhythm together: 56 dp row minimum, 4 dp vertical padding, 8 dp row gap,
  24 dp between sections, 40 dp after dividers. Toggle touch areas remain 48 dp.
  Supporting content continues to expand naturally. Updated the design rule.
- TypeScript/scoped lint passed. Actual phone screenshots inspected at top and
  Notifications/Support/Legal. Notification label-center steps are now 168 px
  rather than 231 px; label-box gaps are 99 px and final-label-to-divider is
  approximately 103 px. The revised compact layout replaces the previous claimed
  fix. No preference mutations or native build; phone left on Notifications.
