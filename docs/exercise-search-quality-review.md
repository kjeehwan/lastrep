# Workout exercise search review

October 20, 2026. Scope: Add exercise and the inline Replace exercise picker.
The routine editor's separate search is outside this pass.

October 22 follow-up: [Workout and food-search usability](workout-search-usability.md)
covers uncatalogued movement names (including Pendulum Squat), alias resolution,
additional result pages and fresh emulator/phone checks. The older custom-name
limitation below describes the October 20 implementation.

## Findings and changes

- Both screens previously accepted any matching query word or arbitrary letter
  subsequences. A multiword request could return unrelated exercises.
- Replace prepended substitution suggestions regardless of the query/category
  and silently limited All to the current exercise's body part. Suggestions could
  occupy all 24 positions, hiding the intended search result.
- Both screens now use `src/workouts/exerciseSearch.ts`. Ranking favors exact
  names, genuine whole aliases, title phrases, title-word coverage, then metadata.
  Every query term must match. Primary-muscle/equipment matches precede matches
  relying on secondary muscles. Equivalent punctuation, common plurals,
  DB/BB/KB, pullup/pull-up, RDL/OHP aliases and an unfinished final word work.
- Remote aliases generated from individual title words do not receive a genuine
  whole-alias boost. Search normalization does not rename records or merge IDs.
- Replace uses suggestions only with an empty query, deduplicates names and
  excludes the target. Named variations of the same movement precede metadata
  matches. Empty-query All includes those variations across catalog body-part
  labels; an explicitly selected body part remains a strict filter. Typed queries
  use relevance order; All searches the full catalog. Custom exercises still need
  an explicit search rather than fabricated automatic alternatives.
- Add retains its favorites/recent/category pool, multi-selection and custom
  entry. No selection or workout write happens merely by searching.

## Catalog review

The built-in 39 exercises were merged core-first with 876 records downloaded from
the application's [public catalog source](https://github.com/yuhonas/free-exercise-db/blob/main/dist/exercises.json),
yielding 907 distinct display names. This is a dated snapshot; the remote catalog
and device's seven-day cache can differ later. Raw audit artifacts stay ignored.

Reviewed 51 queries across:

| Family | Queries |
| --- | --- |
| Presses | bench press; incline dumbbell press; dumbbell bench press; db bench; ohp; bench pr |
| Pulls | bb row; cable row; row; lat; lats; lateral raise; lat pulldown; pull up; pull-up; pullup; chin up; face pull |
| Legs | rdl; squat; front squat; bulgarian split squat; leg press; leg curl; leg extension; calf raise; hip thrust; kettlebell swing |
| Muscle/equipment | hamstrings; quads; chest; biceps; triceps; abs; rear delts; bodyweight; resistance band |
| Arms/flyes | db curl; hammer curl; skull crusher; pec fly; dumbbell fly; cable fly; pushup |
| Cardio | run; bike; rowing; jump rope |
| No match | zzzxxyy; incline banana press; protein powder |

All 907 full-name queries returned an entry with the same normalized name first.
Examples: Bench Press, Dumbbell Bench Press, Incline Dumbbell Press, Barbell Row,
Lat Pulldown, Romanian Deadlift and Overhead Press ranked first for their
corresponding specific query/alias. Nonsense multiword queries produced no
results. This checks lexical relevance and discoverability, not exercise safety
or individual suitability.

Broad muscle/equipment queries remain ambiguous. Stretching, strength and cardio
entries coexist; a title naming a muscle may rank ahead of an unnamed movement
using that muscle. Use a more specific exercise/equipment query or body-part
filter. Similar provider entries with different names remain separate to preserve
identity/history. No typo correction, universal synonym coverage or complete
catalog coverage is claimed; custom exercise entry remains available.

## Empty-search suggestions follow-up

User review of Barbell Deadlift exposed a gap in the initial review: the default
suggestions still used the old metadata scoring. It favored Rack Pulls, Good
Mornings and rows, while the Back-only default hid Romanian and stiff-legged
deadlifts classified as Legs. Search-query checks had not covered that ordering.

Default suggestions now recognize named movement families before scoring muscle,
equipment and movement metadata. Generic provider labels such as compound and
isolation are not rewarded as matching movement patterns. Body-part agreement
does not boost one same-family variation over another. Existing target-name
modifiers support continuity; added bands/chains or specialty apparatus rank
lower unless already in the target. This is browsing order, not a personalized
prescription or a claim that every same-family exercise is interchangeable.

The family rules also cover squat, row, press, pull-up/pulldown and other named
movements. Categories still distinguish ambiguous names such as chest and
shoulder presses; cardio rowing is not treated as a resistance row. Unrecognized
families retain metadata-based same-category fallback. No saved identities,
exercise classifications or workout records are rewritten.

Regression cases cover the four requested Romanian/stiff-legged entries ahead
of rows/good mornings, cross-category All versus explicit filters, limiting only
after ranking the full pool, added apparatus, press boundaries and cardio rows.
Native follow-up confirmed Romanian Deadlift second after Deficit Deadlift,
all four requested Romanian/stiff-legged entries available in empty-query All,
and the empty-query Legs filter. All and the initial alternatives were restored
for review without selecting or replacing an exercise. The agent also closed
and reopened the dev app at the user's request for splash review; user visual
approval remains separate.

## Catalog-wide relevance follow-up

The next review applied the relevance gate to every catalog item, rather than
expanding the deadlift case alone. Named families now cover 595 of the 907 entries,
including all 39 built-in exercises. Other entries use primary-muscle overlap
with a specific movement pattern or meaningful name anchor; mobility uses its
primary muscle and cardio prefers matching named activities. Category, equipment,
difficulty or secondary-muscle overlap alone cannot populate resistance results.
The remote adapter now retains its public activity category so stretches,
plyometrics, cardio and resistance remain separate. These catalog-only tags do
not change saved workouts or exercise IDs.

The complete 907-target audit found no self-replacements or activity-category
crossings. It returned alternatives for 823 entries and none for 84. Plank and
Face Pull are the two built-in entries without a close automatic match in this
catalog snapshot; search remains available. The default list is no longer padded
with alphabetical same-body-part entries. Explicit body-part filtering happens
before the displayed limit. No completeness or personalized suitability claim is
made for the source catalog.

The first five suggestions for each of the 39 built-in exercises were inspected.
Additional regression cases cover 32 movement pairs across all body parts/cardio,
unknown names, specific-pattern fallback, activity boundaries, mobility and
equivalent spellings of the current exercise. A native Bench Press check confirmed
press variations in the default list and an explicit RDL search across movement
families. An empty explicit category displayed the search prompt and All restored
the relevant alternatives. No exercise was selected or replaced.

## Splash follow-up

The dev native splash used brown `#1F130B`; production used dark blue `#0d0d1a`.
Both flavors now use black in native day/night resources, Expo splash config and
the temporary app loading screen. The initial bitmap fix removed the colored
matte, but user review found the old artwork differed from Home and was clipped
by Android's splash mask. That composition has been replaced.

Home and native startup now share `src/branding/wordmarkGeometry.json`: the
existing Home Android sans-serif bold wordmark converted to stable vector paths.
Home keeps its header geometry. The native logo is
112dp wide (about 1.5 times Home), centered in a 288dp canvas, entirely inside
Android's [192dp safe circle](https://developer.android.com/develop/ui/views/launch/splash-screen#dimensions).
The dev orange/red and production blue/purple gradients remain separate; launcher
icons are unchanged.

Run `npm.cmd run generate:wordmarks` after a deliberate geometry change. The
script generates flavor SVGs, Expo-compatible PNGs and Android vector drawables
from the shared path. The pinned development-only SVG rasterizer is not imported
by app code. Native verification detects drift and incorrect flavor selection;
rendered-pixel tests guard the mask boundary. A Metro reload cannot update the
installed native icon; the updated dev APK was built and installed.

## Verification

Search verification: 51 catalog review queries, all 907 exact-name queries and
the focused search/replacement regression cases passed. Native Add checks passed
for bench press, DB bench, RDL, kettlebell swing and no match. Native Replace
checks passed for OHP and bench press across body parts with All, no match,
and Shoulders/Chest filtering. No result was selected or exercise replaced.

Full suite after the catalog-wide and wordmark follow-up: 630 passed,
22 emulator-dependent skipped. TypeScript, lint,
web export, native configuration verification and diff checks passed. The dev
APK compiled and installed with the same signing certificate, retaining app data.
The final launcher cold-start recording showed the smaller complete orange/red
wordmark on continuous black, without clipping. The shared fallback/loading logo
is defined at Home size; it was not separately visible in the sampled cold-start
recording. Both source flavors/day-night resources are guarded. A production build/device splash has not been tested.

The development-client launcher is configured to open its server picker on an
ordinary icon launch; the agent reconnected the dev app to the existing Metro
server after the native splash check. Local device artifacts remain ignored.
No production AAB, deployment or production-app installation is part of this pass.

### Single-splash handoff follow-up

User accepted Replace and requested a single native splash until Home is ready.
The index route no longer displays a second logo or hides the splash while
navigation is merely starting. Focused notebook destinations release it after
font readiness and two animation frames; Home additionally waits for initial
profile, insight and health-status results. Background tabs cannot release it.
Home has an eight-second escape into its normal loading/error UI for stalled
reads; this is a maximum wait, not a minimum display duration.

The Metro-connected dev client explicitly hides the native splash in Expo's
launcher before application JavaScript runs. Its cold-start recording therefore
does not verify the standalone handoff. Expo documents this limitation and
recommends [testing a standalone build](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).
The local standalone **dev-flavor**, arm64 APK was built with code/resource
shrinking disabled by command-line flags for this focused check; tracked release
settings were unchanged. Its signing certificate matched the installed dev app.
Installation retained app data. A cold-start recording showed one native logo
held until populated Home, then the native fade directly into Home, including
the saved workout draft and profile photo. No second logo screen was present.
The Metro-connected dev client was restored afterward. Production splash,
signed-out/onboarding cold starts and native offline fallback were not retested
in this follow-up.

Latest checks: 25 focused branding/native configuration tests passed, TypeScript,
lint and web export passed, and `git diff --check` passed. The four new handoff
tests cover readiness/paint ordering, the stalled-read escape, readiness loss
and unmount cancellation. The earlier full-suite count above predates this
single-splash change. No AAB, production installation or deployment was performed.

After the user reproduced Expo's black/loading screens on the restored Metro
client, the same verified standalone dev APK was reinstalled and reopened for
visual review. It is currently left installed for that review, retaining app
data. Restore the Metro-connected dev client before expecting JavaScript edits
to appear on the phone; do not mistake the standalone bundle for a live Metro
session.

The user subsequently reported a brief flicker between the retained splash and
Home. A new 30fps recording showed a monotonic brightness transition through
Expo's default 400ms fade, without a separate blank frame. The startup now sets
`duration: 0, fade: false` to reveal the prepared destination directly. This
changes the exit animation only; the readiness/deadline gate is unchanged.
TypeScript, lint and diff checks passed after this change. The unminified arm64
standalone dev APK rebuilt successfully and was installed with app data retained.
A new 30fps recording showed the splash changing directly to populated Home,
without the previous multi-frame fade or an intervening sampled blank screen.
The user accepted the updated transition after another cold start. This
standalone dev build remains installed; restore the Metro-connected client before
expecting live JavaScript changes on the phone.

### Final batch verification and approval

On October 20, the user approved the exercise relevance and final direct
splash-to-Home transition, then authorized split commits, push, PR review and
merge after CI. Fresh full-suite verification passed with **634 tests passed and
22 emulator-dependent tests skipped** (91 files passed, two skipped). TypeScript,
lint, web export, Android configuration verification and diff checks passed.
The earlier counts above describe earlier snapshots. Production splash,
signed-out/onboarding cold starts and native offline fallback remain unverified
for this splash change. No production AAB or deployment is authorized.
