# Home daily movement study

October 23, 2026. Browser and native steps design approved; integration verification complete.
Branch: feature/home-activity-study. Calories remain deferred.

## Approved scope

- In Home Progress, show Daily movement before Body composition. Keep Add/edit
  attached to body measurements; imported movement is not manually editable.
- Steps are the first metric. Show the local date, Health Connect source, and
  successful-read time. A cached disconnected value keeps its original date.
- Missing records and missing permission are distinct. Neither becomes zero.
  Existing sleep/body permission does not imply permission to read steps.
- Initial scope: steps only, based on the phone check below. Activity calories
  are deferred; the separate calorie fixture remains a hypothetical future example.
  Show Recorded activity only and explain that gym workouts/resting energy may
  be missing. Never label partial records total daily expenditure.
- Do not estimate calories from steps or lifting sets, add resting energy, or
  adjust nutrition targets as part of this feature.
- Do not relabel exercise-scoped TotalCaloriesBurned records as active calories.
  If only those are available, reconsider the metric rather than silently mixing
  them with ActiveCaloriesBurned.

## Native implementation boundary after approval

Use Health Connect's aggregate Steps count for each local calendar day; do not
sum raw phone/watch records or add app-specific totals together. Aggregate reads
respect Health Connect's user-selected source priority for Activity data. Keep
null/missing distinct from an explicit zero, and use local-day boundaries with
DST-aware conversion, rather than fixed 24-hour offsets.

Read permission must be independently optional, preserving existing sleep/body
sync when denied. Start with foreground refresh and existing Sync now behavior;
no background permission or sensor tracking is needed for the study. Any stored
summaries must be scoped per account and day, replaced on refresh rather than
incremented, with disconnect/revocation/account-switch and deletion behavior
specified before implementation. Nutrition targets remain unchanged.

Before native release, extend the relevant consent/privacy text and Health
Connect/Play declarations for the data actually read. This proposal does not
change those declarations or request access on a user's behalf.

## Evidence and verification

At the initial availability check, the Android manifest requested reads only for
sleep and body measurements. The native implementation below adds READ_STEPS;
no calorie permission is added.
Read-only Health Connect UI inspection on the connected Samsung Android 13 phone:

- Steps: today's entries were present, with Samsung Health as their source.
- Activity listed Steps and Total calories burned, but no Active calories entry.
- Total calories burned had no entries today or yesterday. Entries from Samsung
  Health were present two days ago. This establishes intermittent availability,
  not full daily expenditure coverage or the meaning of every older record.
- Initial date selectors were checked against the phone's current local date.
  Only availability/source findings were retained in this document, not values.
- No permissions or records were edited. Existing Lastrep permissions were left
  unchanged; this UI check is not a successful API read by Lastrep.

Recommendation: implement steps first after design approval. Defer calorie import
until its record semantics and coverage justify a clearly named, separate metric.
Do not use the optional calorie fixture as evidence of data available on this phone.

Browser candidate states: steps, optional calories, no records, permission needed,
and saved data while disconnected. Initial browser checks passed 80 combinations
across Light/Dark, normal/200% text, compact/standard/landscape/tablet sizes, with
no page errors or horizontal overflow. Help and connection-preview cancellation
were checked. Final prototype model suite passed 93 tests; final browser checks also passed
80 layout combinations. Results are recorded in the ignored local checkpoint.
These are browser checks, not native sync verification.

## References

- [Android aggregate reads and source priorities](https://developer.android.com/health-and-fitness/health-connect/aggregate-data).
- [Health Connect record definitions](https://developer.android.com/reference/androidx/health/connect/client/records/Record).
- [Samsung Health export mapping and version caveat](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect).

## Profile permission candidate (October 23 feedback)

- Use the shared outlined information-circle icon, not a question mark, for help.
- Profile Health sync adds Daily activity. It means steps in this initial scope.
  Ready requires app consent, device availability and steps-read permission; it
  does not require a step record to exist. Not allowed, Not connected and
  Unavailable remain distinct. Steps access is independent of sleep/body access.
- Preserve existing sleep/body status and sync rows; include Last activity sync
  for the activity snapshot read. A steps-only connection remains Connected.
- Health sync help, connection consent, source-app help and simulated permission
  review identify steps explicitly. Existing permissions remain selected while
  adding steps; cancel applies nothing. No calorie permission is proposed.
- When all preview permissions are already granted, show guidance before the
  simulated external Health Connect screen. This retains the approved ordering:
  explain App permissions > Lastrep first, then Open Health Connect or Cancel.
- Browser states: profile.html#activity, #activity-permission, #activity-only and
  #activity-connect. Home's Connect steps preview links to the Profile candidate.
- Fresh checks: 64 Profile layout combinations passed, permission cancellation/
  application, steps-only sync, consent/help and guidance ordering passed. Home's
  80 layout combinations and all 94 prototype model tests passed. These simulated
  grants/syncs do not touch a phone, Android permissions or account records.

## Samsung Daily activity comparison (October 23)

At the user's request, compared Samsung Health Daily activity with Health Connect
for today and the preceding two days, using read-only native UI navigation.
Samsung Health displayed positive Activity calories and a Total burned calories
figure for all three dates. Health Connect had no Total calories burned entries
today or yesterday. Its Samsung Health entry two days ago differed from both
Samsung daily figures (allowing display rounding).

That Health Connect calorie entry matched a Samsung Health Walking exercise
entry in Health Connect by date, start/end time and source. No Active calories
category was listed in the Activity view. This is consistent with Samsung's
published exercise-calorie export mapping; it does not establish watch-wearing
as the cause of missing records or validate calorie estimates.

Conclusion: the Samsung Daily activity figures are not mirrored by the inspected
Health Connect calorie records. Steps-only remains the initial scope. Mirroring
Samsung's daily calorie summary would require separately evaluating a source/API
that actually supplies that summary, rather than relabeling exercise records.
No calorie values are included in these notes. No permissions or records were
edited; the phone was returned to Samsung Health Daily activity for today.

## Native steps implementation and verification (October 23)

- Home Progress now places Daily movement above Body composition, with a shared
  information button and dated Health Connect steps. Body composition retains
  its own Add/edit action. Connect steps opens Profile Health sync and the new
  consent when needed, including repeated visits after denial.
- New account/device-scoped steps consent is separate from existing health
  consent. Returning users do not silently acquire steps sync. Native read
  permission remains independently optional; steps-only access is Connected.
  Profile includes Daily activity readiness and Last activity sync. Consent,
  source-app help and Health sync help include steps.
- Foreground/focused refresh uses today's local midnight-to-now aggregate,
  including DST-aware day boundaries. A one-minute throttle limits automatic
  reads; Sync now can force refresh. No raw-record summation, sensors, background
  permission, calorie estimate, nutrition-target change or AI input was added.
- A missing aggregate is distinguished from an explicit zero, including the
  native library's absent-count-to-zero conversion. Dated snapshots replace
  earlier counts; they are not incremented. Account-scoped local cache and
  Firestore user data preserve the latest snapshot across reopening. Offline,
  disconnected and revoked states retain saved values with their date/status.
  An interrupted read is discarded on account change, disconnect, revocation,
  backgrounding or a changed local date/time zone before completion.
- Disconnect stops future reads and preserves saved data. Successful account
  deletion removes the local steps snapshot and consent; the existing server
  deletion removes the user document. Steps stay out of recommendation inputs.
- Last activity sync is the snapshot's successful-read time, including a read
  with no records. Existing sleep/body timestamps continue to describe imported
  changes and remain unchanged on duplicate imports.

Fresh automated checks passed: TypeScript, lint, web export, Android configuration
verification and the focused steps/consent/permission tests. The final full suite passed 765 tests, with 22 skipped across two
emulator-dependent suites. The standard command
skips emulator-dependent suites; it is not proof of native permission behavior.

Android 16 emulator: the actual consent/permission flow, steps-only readiness,
missing records, native aggregate of a synthetic record, downward correction,
Sync now without automatic permission navigation, chooser cancellation and
pre-navigation settings guidance passed. A dated cached value survived offline
reopening and was labeled saved/offline. Disconnect retained the dated saved
value while changing Profile to Not connected. Light and Dark with enlarged text were
visually checked. Synthetic records were written only by a separate ignored
emulator-only fixture; Lastrep requests no write permission. Overlapping-source
priority behavior relies on Health Connect's documented aggregate contract; a
multi-source fixture was not independently tested.

Samsung Android 13 phone: the user allowed Steps and confirmed Home values and
Daily activity Ready. Runtime checks confirmed separate consent, read permission,
a ready snapshot and local persistence without printing health/account values.
The dev app reopened with the existing workout draft fingerprint unchanged.
No workout or nutrition records were edited for these checks.

Before a production build/release, update the Health Connect/Play data declarations for Steps. The maintained policy source
is updated, and the user confirmed the public Notion policy was updated. The Steps declaration remains pending and no production AAB has been built for
this feature. Release work is separate from source review and merge.

## Accepted phone-review refinements

The Daily movement help is now one sentence: Steps shared by your connected apps
through Health Connect. Omit source-priority jargon and the nutrition-target
sentence from this popup. Use the same 28px bundled Source Sans semibold numerals as the Home
body-composition selected value, rather than regular notebook-body numerals.
The policy source at doc/privacy.md explicitly separates display-only steps from
sleep/body summaries used for recommendations and describes foreground access,
local/account storage and dated offline values. The user confirmed this source was published to the existing public Notion policy.


### Play Console update for Steps

In Lastrep's Play Console, open Monitor and improve > Policy and programs > App
content (the grouping may be shortened to Policy > App content), then manage the
existing Health apps declaration. Retain existing applicable health features and
data types; include Activity and fitness and Steps read access (READ_STEPS). Add
the following justification when asked how Steps is used:

> Lastrep reads the user's daily step count from Health Connect, with their
> consent, to display today's steps in Home > Progress > Daily movement alongside
> their fitness records. Steps access is optional and independent of sleep/body
> access. Sync runs while the app is in use, and users can disconnect at any time.
> A dated step-count summary is saved locally and with their Lastrep account.

Review Data safety for the additional fitness data stored with an account and
ensure the public privacy policy matches doc/privacy.md. Save and submit the
updated declaration through Play Console's review flow alongside preparation of
the release containing READ_STEPS. No declaration has been submitted by Codex.

Reference: https://developer.android.com/health-and-fitness/health-connect/publish

Refinement verification: TypeScript, lint and diff checks passed; the concise help
was checked on the Android 16 emulator after reopening the dev app. The numeric
style now matches the existing Body composition value (28, bundled NotebookSansSemibold with fontWeight 400 and lineHeight 37).


Home heading follow-up: Progress, Readiness and Weekly Trends now match Profile's
24px Source Serif section headings; native and browser study updated. Daily
movement and Body composition keep their smaller sans-serif hierarchy.

Play Console follow-up: the user reached Health data permissions and found only
body fat, lean body mass, weight and sleep, with explanation fields and no Steps
selector. Earlier instructions incorrectly implied Steps could be manually added
there immediately. No production AAB containing READ_STEPS has been uploaded.
The working explanation is manifest-based permission detection; upload the next
Steps-enabled AAB as part of the authorized release process, then revisit Health
data permissions and complete the newly detected Steps explanation. Leave the
existing explanations intact. Google documents permission evaluation after AAB
upload: https://support.google.com/googleplay/android-developer/answer/9214102
This is an inference from the observed form and the uploaded/local build
boundary; the Console's post-upload Steps row has not yet been verified.

Final source review also covers a cached timestamp ahead of the current device
clock: it must trigger a fresh read rather than suppress refresh indefinitely.
