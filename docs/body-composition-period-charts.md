# Body-composition period charts

October 28, 2026. Native implementation of the approved chart study, following
PR #64 (065e80f). Branch: feat/body-composition-period-charts. User-approved for split commits and PR review. No production build is included.

## Behavior

Day retains the existing latest-per-local-day series and its record identity.
Week (Monday-Sunday), Month and Year average recorded daily values independently
for Weight, Body fat, Lean mass and Skeletal muscle. Missing days and future local
dates are excluded. Multiple raw records on one day do not give that day extra
weight. No stored measurement, sync setting or backend schema changes.

The default view fits 7 daily, 8 weekly, 10 monthly or 5 yearly points, or the
available sparse points at the right. All older history remains scrollable.
Arrow actions page through the plot. Numeric day/week labels use the weekly end
date where applicable. Monthly labels alternate calendar months, with the year
wrapped below the first recorded month of each year. Current unfinished periods
say To date. Enlarged text increases point spacing and uses two rows of period
controls rather than compressing labels.

The plot resolves taps to the nearest visible observation and exposes an
adjustable accessibility control for moving between points. Averages are derived
values: selecting one clears the editable-record selection in Home. Day still
offers Edit selected. The period summary shows its recorded-day count; missing
days never appear as zero measurements.

## Verification

- TypeScript and ESLint passed. Web export passed.
- Full local suite: 823 passed, 40 skipped before the final presentation tweaks.
  Focused final calendar/history tests: 17 passed. Calendar tests also passed
  with America/New_York timezone, including daylight-saving boundaries.
- Android 16 emulator: synthetic history confined to demo-lastrep-sharing,
  spanning 2021-2026. Checked all period windows, touch scrolling to older years,
  arrow paging, tapping an older monthly point, two-point Day labels (10/12, 15),
  one yearly aggregate, an empty metric, and dark mode. Day offered Edit selected;
  Month offered Add today without Edit selected. Canceled both sheets.
- At 360 dp / 200% text, period controls reflowed and chart labels remained
  readable through scrolling. Restored density 420 and font scale 1.0 afterward.
- Galaxy Android 13, light mode: checked Day, Week, Month and Year against the
  existing account history, including right-aligned sparse monthly/yearly views.
  No measurements or profile fields were edited. Phone left at Home's chart.
- Native TalkBack interaction was not repeated; the adjustable actions and
  spoken value are implemented, but require a separate spoken-navigation check
  before claiming TalkBack verification.

The separate Settings consistency task and a new AAB build have not started.


## Point-label and control review follow-up

Added compact numeric values for every visible point (up to one decimal, without
repeated units). The selected summary retains its existing precision and unit.
A pure label layout lifts overlapping labels and reserves any additional top
space without changing the plotted values. Labels are laid out across the full
series so scrolling does not continually change their vertical placement.

Metric choices retain underlines. Period choices now use a compact secondary row of 13 dp text, muted when
inactive and accent semibold when selected, with no background, border, fill or
underline. Metric choices remain more prominent. Tap targets stay at least
44 dp and enlarged-text reflow remains available.
Verified phone light-mode daily labels and Android 16 dark-mode ten-month labels.
Label collision tests cover dense values, pounds-length numbers and enlarged text.

The final secondary-selector treatment was verified on Galaxy Android 13 in
light mode and the Android 16 emulator in dark mode. Period switching still
updates the chart. TypeScript and lint passed; 44 dp minimum targets remain.

Day shows the selected value directly. Only Week/Month/Year retain an explicit
average heading and To date qualifier for the current partial period.

Daily chart summaries shorten Samsung Health / Galaxy Watch to Samsung Health.
The stored origin label and selected record metadata remain unchanged.

## Current calendar week labels

Calendar weeks remain Monday-Sunday. For the current partial week only, the
summary, window range and point label stop at today's local date (Oct 26-28,
10/28). Completed weeks retain Sunday. The full bucket boundary, daily values,
recorded-day count and average are unchanged. Home's existing foreground-aware
clock refreshes the as-of day without requiring a new measurement.
Verified on Android 16: Oct 26-28 in the selected summary, To date heading,
and 10/28 under the latest point. Twelve calendar tests, TypeScript and lint
passed, including next-day advance and conversion to a completed Sunday week.

Final pre-PR checks passed: TypeScript, ESLint, web export and 827 tests
(40 skipped). Reviewed the final chart calculation, selection/edit boundary,
point labels, local-day refresh and display-only source shortening.
