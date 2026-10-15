# Nutrition search quality: Batch 4

## Confirmed problems

- `rice(` and `rice [` threw invalid-regular-expression errors.
- Top oatmeal/chicken/cherry results often could not be reloaded by their IDs
  because the older search index pointed at the wrong packaged chunks.
- `brown rice cooked` returned white/jasmine rice from permissive backfilling.
- Generic Greek yogurt returned bars, cheesecake and dips near the top.
- The packaged corpus lacked common generic preparations; alphabetical capping
  left mostly branded USDA products, despite the USDA source prefix.

## Changes

- One matching/ranking pipeline replaces competing special-case ranking passes.
- Query terms are normalized and safely escaped. Matching respects whole words,
  plurals, hyphens, regional synonyms and explicit preparation/percentage terms.
- All terms must match; preparation and percentage qualifiers must occur in the
  name, not only in broad product-category aliases. Partial final words are
  attempted only when exact-token matches return nothing.
- Bounded USDA reference supplementation covers common staples and preparations.
- Generic foods rank ahead of ambiguous one-word packaged products; unrequested
  derivatives are demoted. Requested processed foods/brands remain searchable.
- Punctuation/case duplicates with equal nutrition are collapsed. Different
  preparations, nutrition or barcode identities are retained.
- Results show their USDA/Open Food Facts source and preserve facts preview,
  saved meals, recent items and barcode lookup.
- Actual catalog chunk locations restore reliable ID hydration. Existing food
  values and serving definitions are regression-tested against the old fixture.
- Zero-calorie foods remain usable by grams/servings; calorie entry rejects
  division by zero.

## Validation

- Core-query benchmark plus strict cooked rice/chicken, oats, yogurt, percentage,
  punctuation, unknown-name, prefix and limit tests.
- Ranker unit tests cover whole words, modifiers, aliases, regional spelling,
  preparation, duplicate handling and invalid nutrition.
- Every historical fixture result is checked for unchanged stored fields by ID.
- Both ends of every packaged chunk are reloaded and compared with source rows.
- Phone smoke: search oatmeal, cooked brown rice, cooked chicken breast and
  Greek yoghurt; open nutrition facts; cancel without saving test food. Confirm
  barcode/manual lookup and recent/saved items remain usable.

Completed device checks on October 15, 2026: a fresh normal-mode bundle opened,
cooked brown rice's 100 g preview showed 123 kcal with its source macros, and
the actual Hermes runtime passed oatmeal, cooked chicken breast, Greek yoghurt,
2% milk, punctuation and unknown-food queries with matching ID hydration. The
test meal remained empty. No actual camera barcode was scanned in this check;
barcode parsing/lookup regressions were covered by the existing unit tests.

Adding the asset to an already running Metro session initially produced an
unknown-module hot-reload error. A fresh bundle reload cleared it. No native
rebuild is required for these JS/data changes. Ordinary phone search timings
remain around 2-4 seconds for uncached queries in normal dev mode; this batch
does not claim to eliminate search latency.

This is a relevance and known-coverage improvement, not a claim that every food
or packaged brand exists or that crowdsourced nutrition labels are error-free.
