# Current phase and sparse-chart fixes

October 28, 2026. Group 1 of the approved Home/Workout/Settings follow-up.

## Behavior

- Workout subscribes to the signed-in account's saved training phase alongside
  its effort preference. An old route parameter no longer overrides that value.
  Account changes clear the previous account's displayed phase. Existing saved
  workouts are not rewritten.
- The Workout phase link explicitly targets Training in Profile, waits for that
  section's layout, scrolls it into view and consumes the navigation request.
  It clears stale Health-sync navigation and cancels a pending feedback scroll.
  Returning leaves the existing workout draft intact.
- The body-composition chart uses its measured viewport width. One or two points
  sit at the right, with padding for labels and touch targets at both ends.
  Longer histories remain scrollable; selecting an older observation still uses
  its actual position. No measurements are changed or synthesized.
- Recommendation logic is unchanged. Strength intentionally defaults to four
  reps, Hypertrophy to eight and Power to three with no history. Recent performance
  can affect the prescription, and available-weight fallback can reduce reps.
  The user explicitly accepted intentional Strength prescriptions of four reps.

The approved new Workout layout, Settings styles and Day/Week/Month/Year charts
are separate groups. Their browser mockups are present but those native changes
are not included in Group 1.

## Verification

- TypeScript, ESLint and web export passed.
- 49 targeted tests passed across body-chart geometry/history, exercise
  progression, recommendation heuristics and Profile wiring. Coverage includes
  narrow/wide viewports, one/two observations, long-history edge padding,
  enlarged text, phase defaults and existing load/repetition guardrails.
- Android 16 emulator with demo-lastrep-sharing only: Home/Workout/Profile
  showed Strength. Changed the local test account to Power through Profile Save;
  Workout updated to Power. Visited Health sync through Connect steps, declined
  consent, then tapped Workout's phase: Profile scrolled to Training rather than
  the previous Health-sync position. Two synthetic October observations were
  fully visible and right aligned on native Home.
- Connected Galaxy Android 13: Home, Workout and Profile showed the saved
  Strength phase. The phase link scrolled to Training; Back returned to the same
  workout title, date, timer and first exercise. No user profile or workout fields
  were edited during this phone check. Phone-specific sparse data was not created;
  sparse-chart visual verification used the emulator fixture.

No native dependency, backend deployment or AAB build is required for dev review.

## Routine association follow-up

Workout drafts now include the selected routine's stable ID and cached name.
Reopening restores the ID independently of the editable workout title; the saved
name keeps the source label readable while the routine list loads. Once loaded,
the current routine name takes precedence. Account changes, empty/new/custom
workouts, appended/shared combinations, repeated historical workouts and cleared
sessions cannot inherit a different session's routine link. Existing intentional
deload behavior remains unchanged.

Older drafts without this metadata remain custom. The app does not infer a source
routine from a matching title or reapply a routine over an existing workout.
The user's already-open draft was left untouched.

Verification: TypeScript and ESLint passed; 17 targeted draft/feedback/cardio tests
passed, including legacy metadata, explicit clearing, routine ID/name retention,
and preservation of completed sets and timer values. Android 16 local emulator:
selected a synthetic routine, confirmed its source label, force-stopped/reopened
Lastrep Dev and confirmed the association survived. This follow-up did not apply
or replace a routine on the connected user's phone.
