# Workout and food-search usability

October 22, 2026. Implemented and emulator-checked one task at a time, in the
following order. Phone verification follows the four emulator checks. No release
build is part of this batch.

## Exercise note keyboard visibility

Notes explicitly reveal their own focused input using measured scroll/keyboard
bounds. Android set rows retain their native focus handler. Scrolling is minimal
and unanimated. Landscape typing compacts the header padding without shrinking
controls. Focus and text survive rotation.

Emulator checks: first and last notes in a six-exercise draft, portrait/landscape
with the software keyboard, retained typed text and return to a native Reps field.

## Relevant finish-workout questions

- Manual/repeated workouts do not ask recommendation questions.
- A generated workout asks whether it was followed and whether it was helpful.
- A successfully loaded Today's Plan review asks whether that review was helpful,
  even if no prescription changes were necessary or applied. Opening a failed
  review does not count as a completed review. A result arriving after the review
  was closed does not count as a viewed review either.
- When both features were used, their helpfulness answers remain separate.
- Account-scoped drafts persist feature use across reopening. Loading a different
  workout, replacing it with a routine/recommendation, discarding or completing
  the session clears prior use. Appending a routine keeps the current session's use.
- Legacy drafts do not infer feature use from titles or old decisions. Unused
  legacy feedback fields remain `unknown`; the new review answer is separate.

Emulator checks used local Firebase emulators and a disposable account: no
questions for manual/repeated workouts; review-only, recommendation-only and
combined questions; reopening; save without irrelevant required answers; distinct
answers verified in local saved records. Real account records were not used.
An explicitly delayed emulator request also verified closing before completion:
no feedback appeared after the hidden result arrived; a subsequent visible
completed review showed its question without requiring Apply.

## Replace exercise

Resolve normalized titles and unique genuine aliases before requesting peers.
An uncatalogued name such as Pendulum Squat can use a clearly recognized movement
family. This search-only descriptor supplies no invented muscles, cues or loads
and never renames saved records. Unclear custom names still require explicit
search. Additional loading is never implied by the browsing order.

Typed searches retain shared Add/Replace matching and explicit body-part filters.
Show more exercises exposes the next 24 results rather than permanently hiding
matches after the first page. Weighted variants are demoted unless already named
by the target, alongside the existing specialty-apparatus preference.

Emulator checks: Pendulum Squat alternatives, typed leg-press results, Cancel and
confirmed replacement on disposable data, additional pages, preacher curl,
supported row and machine shoulder press peers. The retained 907-entry catalog
snapshot audit found no self-replacements or activity-category crossings; this
does not claim universal catalog coverage or personal suitability.

## Food-search speed

Prepare inexpensive name/alias text with the search screen's existing prewarm,
sharing asset/preparation promises with an early search. A necessary substring
gate rejects clear non-matches before the full matcher. Unicode rows/queries
retain the full matching path. Existing matching, ranking, nutrition, servings,
IDs and query-result caching remain authoritative. Work yields between slices;
prewarming does not load all nutrition chunks or the obsolete index.

The search screen reports a failed request and permits retry with the same query;
an obsolete request cannot replace a newer result. Test instrumentation remains
only in the ignored emulator checkout.

Same Android 16 x86 emulator, development JS, warm assets but cleared query cache,
second sample per query (search function elapsed time, not screen-to-pixel time):

| Query | Before | After |
| --- | ---: | ---: |
| chicken breast | 1,252 ms | 157 ms |
| protein | 1,298 ms | 227 ms |
| rice | 1,531 ms | 455 ms |
| Cheerios | 1,220 ms | 127 ms |
| oatmea | 2,615 ms | 345 ms |
| no-match test | 2,464 ms | 252 ms |

All 12 before/after result-ID lists matched. New-query hydration still costs time:
the first measured optimized chicken/protein searches took 587/931 ms. These
emulator figures do not predict production phone latency.

Native screen checks covered search, serving preview, no-match/recovery and an
injected one-shot failure followed by retry. No meals were saved.

## Verification

Full suite: 720 passed, 22 skipped. Relevant TypeScript/lint checks passed.
Packaged-catalog matching checks include plural forms, synonyms, preparations,
percentages, prefixes and Unicode case-folding fallbacks. Historical test results
are not treated as verification of these changes.

Aggregate lint, TypeScript and web export passed. Both emulator and phone dev
APKs built locally; no AAB, cloud build or deployment was performed.

Samsung Android 13 phone checks followed all four emulator checks: focused note
visible in portrait and landscape; original rotation settings restored; ordinary
workout finish sheet without recommendation questions and safely canceled;
replacement query returned leg-press variants without selecting a replacement;
Cheerios search/1.5-cup preview canceled; no-match feedback displayed correctly.
The pre/post workout-content fingerprint matched. No workout, routine or meal
was saved. Generated/reviewed feedback save variants and uncatalogued-name
replacement confirmation were tested on disposable emulator data only.

Phone development-JS search timings, warm assets and cleared query cache, were
566 ms (chicken breast), 664 ms (protein), 1,296 ms (rice), 504 ms (Cheerios),
1,098 ms (oatmea) and 864 ms (no match), using each second sample. There is no
same-phone pre-change measurement, and these are not Play-installed timings.

The final standalone dev APK was installed and reopened with Metro stopped and
its ADB forwarding removed. Signed-in Home and the existing draft returned; the
ordinary Finish sheet had no irrelevant questions and was canceled without
saving. The phone was left on Workout for review. The temporary laptop keep-awake
request was released; no Windows power settings were changed. User visual
acceptance remains separate from the automated checks above.

User review accepted notes, finish questions and Pendulum Squat replacement.
Food search felt somewhat faster. Jumping Jacks currently has no close automatic
replacement; this remains a catalog/family-coverage limitation, not a claim that
all exercises have alternatives. Commit, push, PR review and merge were then
authorized before the next three-task batch.

The four fixes were split into focused commits plus shared documentation, pushed
in PR #54, manually reviewed and merged as `1ccdcc1`. PR and post-merge Quality
Checks passed. The review was performed by the implementation author.

## Timer, meal-time wheel and setup-action follow-up

Implemented sequentially, with each task phone-checked before starting the next.

- The first completed set starts a never-started workout timer. A persisted
  started flag distinguishes a pause from a new timer, even at zero elapsed
  seconds. Legacy completed-set drafts retain their paused state. New sessions,
  discard, successful completion and replacement routines reset this flag;
  duration adjustments retain it. Routine-builder set completion does not start
  the session timer.
- Meal-time wheels wrap hours/minutes in either direction and center tapped or
  scrolled selections. Android now uses native number pickers, as detailed below;
  other platforms retain the JavaScript fallback. Rows respect text scale,
  accessibility exposes adjustable values, and Save waits for both wheels to stop.
- Workout setup has three separated groups: My routines / Create routine,
  Repeat past workout / Recommend workout, and Discard. Fine horizontal rules
  separate groups; inset vertical rules separate paired actions. Labels can wrap.

Samsung Android 13 checks used a backed-up, temporary local workout draft, with
no workout/routine/meal saves or replacements. Completing the first set started
and persisted the timer; reopening retained a pause; completing another set
did not resume it. Meal-time taps crossed 23:59 to 00:00 and back, and native
swipes selected and centered values. Cancel/reopen retained the original meal
time. Light and dark presentations were inspected. Setup actions opened the
expected dialogs and were safely dismissed, including Keep editing on Discard.
Paired labels remained legible at 1.5 system text scale; landscape scrolling
reached Discard. Original appearance, text scale, rotation and local draft were
restored. User accepted the timer and setup-action grouping. The user found an
intermittent wheel rebound during normal swiping; the initial native checks did
not establish reliable scrolling.

Fresh aggregate checks: TypeScript, lint and web export passed; 723 tests passed,
22 skipped. The skip count remains the ordinary emulator-dependent exclusions.
The user accepted the timer and setup grouping, then accepted the native-wheel
replacement below. Split commits, push, PR review and merge were authorized.
The production AAB remains postponed; no AAB or deployment is part of this batch.

### Meal-time wheel rebound correction

Keep the native `contentOffset` prop fixed at its initial position. Re-rendering
to disable Save during a swipe must not send the old selection back to Android.
Selection changes no longer trigger a second positioning effect; explicit tap,
settling and text-scale changes own positioning. Settling reads the gesture's
final offset, and a late momentum-end event cannot commit during a newer drag.

Fresh TypeScript, lint and all 723 tests passed (22 skipped). This intermediate
approach was superseded by the native Android replacement after further user
feedback about opening and selection delays.

Phone regression: slow, fast and reverse swipes changed both hours and minutes
and retained the new values in a delayed second observation, across six gesture
cases. The test time was canceled; reopening retained the saved meal time.

### Native Android wheel responsiveness

The user still reported slow opening and delayed number capture after the rebound
fix. On the same Samsung Android 13 phone, temporary React profiling measured
the 420 JavaScript number rows at 1,178/1,186 ms to mount and 537/562 ms for the
initial update. The selected values being eventually correct did not establish
smooth interaction.

Android now uses two platform NumberPicker controls. Android owns scrolling,
flinging, wrapping and centering; JavaScript mirrors the settled values for Save.
Initial values are applied once, so later JavaScript renders cannot interrupt a
native gesture. Touches stay with the wheel rather than scrolling its enclosing
sheet. Native labels distinguish Hour and Minute, and tapping the center does
not open the keyboard. The sheet opens without a fade. No new library or private
Android API is used; the app's existing minimum Android API is 29.

Native templates, tracked Android sources, registration and prebuild generation
are maintained together. Native verification checks template/source agreement.
An isolated prebuild fixture verified an alternate package name and idempotent
registration on a second run. Other platforms and older dev clients retain the
fallback; these Android measurements do not establish their performance.

On-phone development React profiling measured native-wheel mounts at 16–19 ms
(a later warm mount was 10 ms), with sampled updates around 0.2–3 ms. These are
JavaScript render durations, not complete tap-to-open or production latency.
Temporary profiling and state-inspection hooks are removed from the final code.

Phone checks covered slow, fast and reverse swipes on both wheels, rapid 08-to-12
hour taps, and 23:59 / 00:00 wrapping in both directions. Visible values matched
the state Save would use after every tested gesture. Saved meal times were not
changed, and the existing workout draft's content fingerprint was unchanged.
Light/dark presentation and native accessibility labels were checked. The
original appearance choice was restored. An unset time's displayed 00:00 also
initializes the editable value to 00:00; nothing is persisted until Save.
The user reported that the native replacement was much better and authorized
split commits, push, review and merge for the completed three-task batch.
