# Workout exercise search review

October 20, 2026. Scope: Add exercise and the inline Replace exercise picker.
The routine editor's separate search is outside this pass.

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
