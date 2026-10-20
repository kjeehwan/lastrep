# Food catalog maintenance

October 20, 2026. Focused follow-up to the broader search-quality review.
Implementation is in the release batch on `fix/release-walkthrough-feedback`.
The user authorized split commits, push, PR review, merge and CI verification.
Another user-directed task comes before any AAB build.

## Implemented

`src/nutrition/data/reviewedFoodCatalog.json` separates reviewed food identities
and consumer brands from mixed legacy aliases. The initial pass reviews 15
existing records. Ranking and candidate lookup use these labels; existing
records' IDs, nutrition and serving values are not rewritten.

The same file holds two sourced additions. `reviewedFoodCatalog.ts` converts
their recorded label servings into the app's per-100g model without rounding
away label values. Additions are available offline, searchable and hydratable
by stable ID; collisions cannot replace existing records. The audit rejects
colliding additions or missing metadata references.

| Addition | Source and basis |
| --- | --- |
| Cheerios Original (US) | [Manufacturer English label](https://www.cheerios.com/products/original-cheerios) and [matching Spanish label](https://www.cheerios.com/es/products/original-cheerios), reviewed October 20: 39 g, 140 kcal, protein 5 g, carbohydrate 29 g, fat 2.5 g, dry/as packaged. Spanish label explicitly supplies the gram weight. Applies to this US Original variant, not other flavors/markets. |
| Water, tap, drinking | USDA FDC 173647, SR Legacy, from the local April 30, 2026 full CSV release linked by [USDA downloads](https://fdc.nal.usda.gov/download-datasets/). Food/nutrient rows were checked directly; energy, protein, carbohydrate and fat are 0 per 100 g. Uses the reference 100-g serving, without an assumed cup weight. |

No barcode was inferred for either addition. Source URLs, review dates, market,
raw serving values and provenance notes remain alongside the additions.

The legacy `off-0039759076110` record is named Water but contains 19.7 kcal
and 4.93 g carbohydrate per 100 g. This conflicts with a plain-water identity.
Its reviewed metadata excludes it from new search pending source verification.
Hydration by ID retains its original values for existing logs. It is not deleted,
renamed or silently corrected. Plain-water searches return the sourced USDA entry.

Future imports retain explicit `brandNames` separately from category/ingredient
aliases. Normalized imports also retain a supplied `searchIdentity`. The catalog
builder includes these explicit fields. No existing blob corpus was regenerated
or replaced by this work. Manual food entry remains available; no-results copy
now points to Enter food manually alongside search/barcode alternatives.

## Repeatable audit

```powershell
npm.cmd run audit:food-catalog
```

Optional local report:

```powershell
npm.cmd run audit:food-catalog -- --output .dev-tools/food-catalog-audit.json
```

`scripts/food-catalog-audit-cases.json` defines 32 presence checks. Required
staples must exist by a grounded name/brand/reviewed identity; ingredient and
category aliases do not establish coverage. Optional brand cases distinguish
missing source coverage from legacy-alias metadata requiring review. Presence
does not certify that every product variant or its nutrition is correct.

Current results: 65,783 original records, two additions, 15 metadata reviews;
30 of 32 cases present. Honey Nut Cheerios and Fage need a specific product,
market and source review. The audit found Optimum Nutrition in legacy aliases;
reviewing that existing whey record supplied its explicit brand metadata without
adding a duplicate. The remaining gaps are a review queue, not invented
placeholder foods. 64,315 legacy branded records still lack explicit
brand metadata; this initial focused pass does not certify the whole corpus.

Basic serving/calorie/macro bounds flag no original records in this run. Those
bounds do not catch semantic errors such as the water record above. The audit
also checks source fields, new-label values, duplicate addition IDs and stale
metadata references. Mandatory failures exit nonzero; optional coverage gaps
are reported without blocking development.

## Adding or reviewing a record

1. Search existing names, IDs and aliases first. Distinguish missing products
   from missing metadata. Reuse an existing record when its identity is supported.
2. Verify the exact preparation, market and product variant. Review labels from
   the manufacturer or original dataset; retain the source and review date.
3. For additions, preserve the source serving weight and per-serving values.
   Assign a stable ID without reusing another record's ID. Do not infer a barcode,
   missing macro or serving weight. Keep unverified candidates in the review queue.
4. For legacy records, add sidecar search metadata. Exclude a suspect record from
   new search only with a documented reason; preserve historical hydration.
5. Run the audit, search/label/hydration tests and appropriate app checks. Confirm
   native search and serving preview before approval. Builds/deployments remain
   separate explicitly authorized actions.

## Verification

- TypeScript, lint and web export passed.
- Full suite: 503 passed, 22 emulator-dependent skipped; 87 passing files,
  two skipped.
- Tests verify precise label-serving conversion, provenance/reference integrity,
  search/hydration of additions, legacy-value preservation and search exclusion.
- Existing food equivalence tests still pass. A real importer run in an isolated
  temporary working directory verifies brands survive separately from categories;
  it never writes into the workspace's corpus.
- Native search returns Cheerios Original (US) and Water, tap, drinking first for
  their queries. Cheerios preview showed one 39-g serving with 140 kcal and
  5/29/2.5 g protein/carbohydrate/fat; water's result showed 0 kcal. Preview was
  canceled and zero foods remained selected; no diary save occurred. This passed
  after restarting the verified project Metro process and fully reloading the
  dev app. The initial unknown-module error was stale development state, not
  counted as verification. No account/native configuration was changed.

This introduces no online provider, runtime network lookup, numerical nutrient
filter or automatic change to previously logged meals.

## Decimal serving labels

User approved Cheerios, tap water and their serving previews, then requested
decimal quantities across foods. The shared serving-label formatter now handles
ASCII mixed/simple fractions, Unicode fractions and nonbreaking spaces. Search,
recent/favorite descriptions and both search/logged-food reference previews use
the same display normalization. Examples: 1 1/2 cups becomes 1.5 cups, 1/8 tsp
becomes 0.125 tsp; nonterminating fractions display to three decimal places.
The original catalog/label strings and numeric serving weights remain intact.
Invalid fractions and unrelated date/code strings are retained.

Fresh verification for this formatting follow-up is recorded in the release
checklist; the earlier 503-test result above predates it.
