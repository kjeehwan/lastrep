# Food search quality review

October 20, 2026. Working branch: `fix/release-walkthrough-feedback`.

User confirmed that searching "protein powder" returns Protein Powder first,
then requested a broader review after incidental nutrient descriptions crowded
the broad "protein" results. This review extends beyond that one query.

## Method and scope

Reviewed the top five results for 86 queries against the bundled food catalog,
using the production matching/ranking functions and catalog-selected records.
The local review helper mirrors candidate hydration and stays in ignored tooling.
Maintained integration tests also exercise the actual async search/hydration path.
This is a qualitative relevance review, not a complete catalog or nutrition audit.

Queries covered:

- Products/nutrients: protein, protein powder, whey protein, protein bar,
  protein shake, fiber, sugar, calcium, iron, fat, low fat milk, sugar free,
  low sodium.
- Meat/fish/eggs: chicken, chicken breast, chicken breast raw, chicken breast
  cooked, ground beef, beef, pork, salmon, salmon raw, tuna, tuna canned, egg,
  egg whites.
- Grains/starches: rice, brown rice, brown rice cooked, white rice, basmati rice,
  pasta, spaghetti, bread, whole wheat bread, oatmeal, rolled oats, quinoa,
  potato, sweet potato.
- Produce: banana, apple, orange, cherry, melon, strawberry, blueberry, broccoli,
  carrot, spinach, tomato, avocado.
- Dairy/alternatives: milk, milk 2%, almond milk, soy milk, oat milk, yogurt,
  greek yogurt, greek yoghurt, plain yogurt, cheddar cheese, cottage cheese, tofu.
- Legumes/fats/drinks: chickpeas, lentils, black beans, peanut butter,
  almond butter, olive oil, butter, coffee, tea, water.
- Prepared foods/brands: pizza, chocolate, chocolate chip cookie, ice cream,
  Nutella, Oreo, Coca Cola, Cheerios, Quest.
- Partial/unknown queries: chicken brea, oatmea, zzzznotfood.

## Findings and changes

The large reference-source boost previously applied even when the query named
only a packing liquid, flavor, nutrient amount or fortification. Category tags,
ingredients and partial company names could also outrank the intended food.

| Query | Previous problem | Result after changes |
| --- | --- | --- |
| water | Canned cherries/tuna in water came first | Water comes first |
| butter | Peanut butter filled the first results | Butter comes first |
| apple | Dried/frozen apples displaced ordinary raw apples | Raw apples come first |
| milk | Dried buttermilk and specialized milks crowded ordinary milk | Ordinary fluid milk comes first |
| sweet potato | Leaves ranked ahead of the root | Ordinary sweet potato comes first |
| tofu | Tofu yogurt and processed variants came first | Tofu comes first |
| oat milk | Chocolate, cookies and meatloaf matched through metadata | Oat beverages come first |
| soy milk | Non-soy imitation milk ranked first | Soy Milk comes first; non-soy is excluded unless explicitly requested |
| Quest | Unrelated company names containing Quest ranked first | The Quest-branded protein bar comes first |
| protein | Incidental protein amounts/fortification crowded results | Protein-named foods lead; protein powder remains first for its specific query |

Ranking now gives more weight to the primary food identity and direct name/brand
matches. Reference provenance helps matching ordinary foods rather than incidental
descriptors. Unrequested specialized forms receive less of that boost; explicit
qualifiers still find them. "Without skin" no longer penalizes ordinary produce.
Regional synonyms and plurals use consistent scoring. Plant-milk searches also
recognize beverages/drinks, with a guard against unrelated soy protein powders.
Explicit hyphenated negations such as non-soy are respected.

No food IDs, nutrient/serving values, diary records or source assets were changed.
Lower-ranked ingredient/category matches remain searchable. Search remains a
name/product lookup, not a numerical high-protein/iron or low-sodium filter.

## Verification and limits

New tests cover identity versus compound names/packing liquids, raw produce,
explicit dried preparation, direct brand versus company/ingredient matches,
plant beverages and non-soy qualifiers. Real-catalog regression cases cover 11
ordinary-food queries plus Quest/Coca-Cola; existing food, preparation, spelling,
percentage, partial-word and hydration-order checks continue to pass.

- Search unit/integration coverage: 38 passed.
- Full suite: 496 passed, 22 emulator-dependent skipped; 86 passing files,
  two skipped.
- TypeScript, lint, web export and diff checks passed on the revised source.
- Connected phone and Metro were checked live. Native read-only searches
  returned Butter for "butter", Oat Beverage for "oat milk", the Quest protein
  bar for "Quest", and Protein Powder for "protein powder" as their first result.
  No food was selected or saved. The dev app was left on the protein-powder search.

The initial review had no Cheerios result. The subsequent
[catalog maintenance pass](food-catalog-maintenance.md) adds a sourced US Original
record and reviewed metadata, while retaining the initial review above as dated
evidence. Broad words remain ambiguous:
"iron" can match a product/brand or cookware description, and "water" can also
match water chestnuts. Brand/company aliases and ingredient provenance are not
structured enough to resolve every ambiguity. The 86-query review does not
establish universal ranking quality or complete brand coverage. Native performance
and user acceptance are separate from host-side relevance tests.
