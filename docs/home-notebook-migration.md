# Home Notebook Native Migration

Branch: `feature/home-notebook-ui`.
Design authority: `training-notebook-design.md` v1.9, section 19, and the
approved `prototypes/training-notebook/home.html` states.

## Boundaries

Home is the second native screen to adopt the training-notebook design, after
Workout (PR #34). Nutrition, Sleep, Profile and Settings keep their current
native appearance. Shared measurement and trend components opt into notebook
styles only inside a notebook provider. No new dependencies, native build
changes, backend deployments or data-model migrations are required.

## Component Map

| Approved element | Native owner | Preservation contract |
| --- | --- | --- |
| Paper/dark, bundled Source fonts | NotebookProvider + Home styles | System theme; no app-wide text defaults |
| Compact logo/calendar/settings/profile | Home + NotebookUtilityIcon | Equal 44 dp controls, 4 dp gaps, existing destinations/photo |
| Date and daily-record heading | Home scroll content | Real current date; sticky utility header |
| Training/diet strip | Existing phase selector handlers | Same account values and phase-week tracking as Profile |
| Start/continue workout | Home + notebookPresentation | Actual draft exercise/set summary; no fabricated workout |
| Get Started | Existing history/hydration gate | No new-user card flashed to returning users |
| Complete today's picture | Existing nutrition/health status | Only relevant actions; existing navigation destinations |
| Progress ledger | BodyCompositionHistoryChart | Actual latest-per-day data, metric selection and precision retained |
| Body-data editor | AddMeasurementSheet | Existing add/edit/delete rules, unit conversion and account writes |
| Readiness/check-in | Home + HomeRecoverySheet | No score without sleep/check-in; draft sliders save explicitly |
| Pain/activity/notes | Shared TodayPlanContextModal | Same context fields used by Workout; no Home AI request |
| Weekly Trends | Home + HomeWorkoutComparison | Neutral rows; real rolling-period session comparison |
| Contribution heatmap | Existing Home implementation | Retained volume history and day-detail navigation |
| Dialogs | NotebookModal + AdaptiveModalCard | Android Back, safe-area padding and keyboard-aware scrolling |

Trend labels say "Last 7 days" and "Previous 7 days" because these are the
existing rolling windows, not calendar weeks. Calculation algorithms, queries,
subscription checks and health-sync consent are not replaced by mockup fixtures.
The new workout comparison uses those same windows, newest session first.

## Automated Verification

October 17, 2026: 345 active tests pass; 14 existing integration/emulator tests
remain skipped, not counted as passes. TypeScript (`npx tsc --noEmit`), Expo
lint, `npm run verify:android-native` and the web export pass. The export was
rerun with access to Expo's local log directory after the sandbox denied that
file access. Presentation tests cover Monday-first calendar dates, real draft
counts and rolling-session comparison boundaries.

## Phone Review: October 17, 2026

Read-only device review completed on the connected Samsung SM-A516N using
normal Metro. No native rebuild, uninstall or data clearing was performed.
The user approved committing, pushing and merging Home after the iterative
phone feedback and corrections recorded below.

### Checked on the phone

- Sticky header, equal calendar/settings/profile targets, existing cloud photo
  and profile preview with nickname/description/Premium badge.
- Existing Chest + Triceps draft summary (5 exercises / 13 planned sets),
  navigation to Workout with that draft intact, Settings entry and Back to Home.
- Log a meal opens the existing Nutrition screen at Log meals; unmigrated
  Nutrition retains its prior appearance, while Home/Workout use notebook tabs.
- Monday-first calendar, rest-day details with one empty-state message, Close
  returning to Calendar, and Android Back closing Calendar and phase selection
  without changing phases.
- Weight/body-fat/lean-mass metric switching: latest weight and sparse body-fat
  observations are selected; absent lean-mass records show an empty state.
- Body-data Add today versus Edit selected shows the correct distinct dates,
  actual selected weight, missing-field placeholders and lean-mass definition.
  The lowest measurement input stays visible above the portrait keyboard.
  Android Back dismisses the keyboard, then the dialog, without saving.
- Recovery check-in opens with saved values; a temporary soreness change from
  6 to 5 is discarded on Back. Shared context opens with nothing preselected;
  Back returns to the check-in, and another Back returns to unchanged Home.
- Workout and volume trend sheets show actual session titles/dates in the two
  rolling windows; the workout contribution heatmap is retained.
- Paper/dark themes, landscape Home and scrollable body-data sheet, and 200%
  text with stacked phase selectors, wrapping metric tabs and reachable dialog
  Save/Cancel controls. Enlarged tab labels remain above Android navigation.

### Defects found and corrected

- Outlined panels inherited zero horizontal padding from the ledger style.
  Explicit horizontal/vertical panel padding now wins over those base rules;
  Complete today's picture and Readiness were rechecked on the phone.
- The measurement unit column stayed 26 dp wide at 200% text, splitting `kg`
  into two lines. Its notebook width now scales with system text size. The
  enlarged help glyphs and single-line units were rechecked in the same sheet.

TypeScript, lint and all 345 active tests passed again after these fixes;
14 existing integration/emulator tests remain skipped. Screenshots/UI dumps
are local ignored artifacts under `.dev-tools/home-*`.

Original phone settings restored: dark mode, font scale 1.1, locked portrait
(user rotation 0, accelerometer rotation 0). No account records were saved,
deleted or modified. Slider changes were draft-only and cancelled.

### Remaining acceptance boundaries

Actual measurement saves/deletes, phase changes and saved recovery/context
propagation to Workout require intentional user-approved account writes and
were not exercised. First-user, offline/error and disconnected-health states
were not forced on this signed-in account. A production cold-launch test and
screen-reader audit are not established by this dev-client visual check.
The agent's visual review passes for the tested Home states; final product
approval remains with the user.

## Acceptance Checklist

### Graph-First Follow-Up

- Removed phase-row top margin and corner inset so the selected fill reaches
  the preceding rule without a sliver of empty space.
- All four Weekly Trends details now place the graph before the two period
  comparisons. Workout contribution squares are 44 dp with 4-dp gaps; month
  offsets, weekday rows and automatic scroll-to-latest use the same geometry.
- Calorie/sleep comparisons list all 14 calendar dates in two rolling windows.
  Zero placeholders/invalid or missing values show Not recorded, not a measured
  zero. Averages explicitly use positive recorded amounts only; the existing
  overview summary algorithms are not changed by this presentation feature.
- Added boundary/empty/invalid-value tests and graph-order/touch-target contracts.
  TypeScript/lint passed; 351 active tests pass, with 14 existing tests skipped.
- Phone check confirmed the enlarged October 16 square opens its Workout Day
  details without changing records. Calorie and sleep sheets were visually
  checked with their graphs above the daily comparisons and tabs unobstructed.

### Volume Filter And Weekday Follow-Up

- The initial phone attempt did not consistently reproduce disappearance, but
  the chart retained an out-of-range horizontal offset while filtered content
  shrank. Home filter changes now mount a fresh chart viewport; shared bar
  charts scroll after native content measurement, and visible-range scaling
  clamps offsets to the current data length.
- Regression tests cover shrinking from a long history to a short/empty one.
  Phone recheck: Hide zero days leaves zero zero-value labels and retains the
  latest nonzero volume bar (24,658 kg), rather than hiding the graph.
- Workout heatmap now labels all seven weekday rows M T W T F S S.
- TypeScript/lint and 353 active tests pass; 14 existing tests remain skipped.

### Filter Transition Follow-Up: Supersedes Viewport Remount

- The fresh-chart key prevented a stale viewport but visibly reset the graph,
  then scrolled it after layout. Removed the filter-dependent key and delayed
  scrolling rather than hiding that reset with an animation or timeout.
- Scrollable bar charts now use an inverted horizontal FlatList with newest-first
  data. Native offset zero is the newest/right edge, while dates remain oldest
  on the left and newest on the right. Filtering updates the mounted list without
  a programmatic scroll. Rendering is windowed; transformed clipping is disabled
  to avoid blank cells in the modal.
- Visible-range scaling now interprets offsets from that newest edge and clamps
  them after a shorter filtered history. Tests cover latest, partially visible,
  stale, short and empty ranges; a source contract rejects remount/timer scrolling.
- Phone recheck in both filter directions retained the latest volume bar and
  correct date order, with zero-day bars hidden/restored. Immediate and settled
  screenshots are ignored `.dev-tools/volume-stable-*` artifacts.
- TypeScript, lint and 355 active tests pass; 14 existing tests remain skipped.

### Popup Feedback Follow-Up

- Profile preview is centered in the available space above the tabs; photo,
  nickname and content-sized subscription badge align centrally inside its
  actual scroll content.
- Notebook modal geometry now uses Expo Router's actual tab-bar height, with
  12 dp clearance. This also applies to the notebook measurement/context and
  Workout sheet wrappers. Unmigrated shared components retain their legacy UI.
- Home dialogs and the shared Workout sheet shell use a sibling backdrop press
  target, not a touchable around the content. The reserved area below tall
  sheets also dismisses through the existing non-saving close handler.
- Phase choices use neutral paper/ink selection and a checkmark, with a fixed
  status slot above Cancel so Saving does not move the choices. No real phase
  was changed during this follow-up; in-flight layout is covered by the
  persistent slot, not claimed as a live account-write test.
- Recovery context row includes a right caret. Readiness remains intentionally
  outlined, as in the approved Home study; it was not converted to a ledger.
- Calendar has no missing footer: Seed sample month / Clear seeded are dev-only
  tools and are last. Neither was activated during testing.
- Trend visibility and filter state now belong to a separate component instead
  of Home. Opening/filtering a trend no longer rerenders the dashboard. The
  sheet paints before chart content mounts, with no account fetch on opening.
  A reliable before/after latency number was not obtained; do not claim the
  reported 1-2 second delay is eliminated until the user confirms responsiveness.
- Phone rechecks confirmed centered profile content, calendar clearance, phase
  outside dismissal and inside/outside behaviour on trend dialogs. Workouts
  shares its title with a background row: absence of that text alone is not
  a valid dismissal assertion; inspect the modal's own backdrop instead.
- TypeScript, lint and 349 active tests pass; 14 existing integration tests
  remain skipped. Temporary popup-timing code was removed from app source.

For further review, start normal Metro with `npm run start:dev-client` and
review the following. No native rebuild is needed for these JS-only changes.

- Header icon spacing, logo, profile photo and profile popup; Settings navigation.
- Actual draft summary and Continue workout; bottom tabs restore legacy styles
  on unmigrated screens and notebook styles on Home/Workout.
- Phase picker cancel/Back; real phase changes require explicit user testing.
- Progress metric switching, sparse/empty history, latest point and point taps.
- Add/edit body-data dialog, help, existing values/units, keyboard visibility,
  cancel/Back; actual save/delete only on user-approved test data.
- Readiness, slider draft cancellation and shared context editor. Check saved
  check-in/context in Workout after an intentional user save.
- Weekly trend session names/dates, contribution heatmap, calendar/day details,
  and Close returning from day details to the calendar.
- Paper and dark themes, portrait/landscape and enlarged system text. Check
  that tab labels and modal actions remain above Android navigation controls.
- First-user/empty/offline states need a suitable test account or controlled
  conditions; never clear app data or overwrite real records merely to test them.

Do not save workouts, edit phases, delete measurements, reset the app or alter
the user's account during read-only visual inspection.
