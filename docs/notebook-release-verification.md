# Notebook migration release verification

Started October 20, 2026, against main `fc6a00c` (onboarding PR #41).
All eight planned screen migrations are merged. This checklist tracks the final
cross-screen pass; individual migration notes retain detailed earlier coverage.

## Baseline

- Main working tree was clean before these documentation updates.
- PR #41 is merged and its feature branch deleted.
- Main's [Quality Checks](https://github.com/kjeehwan/lastrep/actions/runs/39279615605)
  completed successfully: backend build, lint, Android configuration verification,
  unit tests and web export. That run covers the merged migration baseline;
  the subsequent walkthrough fixes below have separate local verification.
- Connected Android phone and Metro availability were checked afresh. Metro was
  stopped; normal dev mode was started and the dev client reloaded successfully.
- Fresh bundle reached notebook Home without repeating onboarding. This confirms
  the current signed-in session's startup, not a fresh authentication test.

## Current walkthrough

Use intended records or a disposable account. Do not overwrite existing records
for a test. Record actual results here; pending items are not release approval.

| Check | Current result |
| --- | --- |
| Cold reopen reaches the appropriate signed-in screen | Home reached after force-stop/reopen, including a fresh repeat after the walkthrough fixes |
| Main tabs and Settings open without an error overlay | Agent opened Home, Workout, Nutrition, Sleep, Profile and Settings; all rendered without an error overlay in the current Light preference |
| Email sign-in, Google chooser/cancellation and successful sign-in | Pending fresh cross-screen pass; earlier auth acceptance is in its migration notes |
| New account completes onboarding and reopening reaches Home | Pending fresh cross-screen pass; earlier onboarding acceptance is in its migration notes |
| Workout entry and reopen preserve intended data | Visible app text/fields matched before and after restart once async loading settled; full history not compared |
| Nutrition entry and reopen preserve intended data | Visible app text/totals matched before and after restart; offscreen meal detail not exhaustively compared |
| Sleep entry and reopen preserve intended data | Visible app text/session summary matched before and after restart; full history not compared |
| Profile edit/save/reopen preserves intended data | Visible app text/identity/training fields matched before and after restart; all offscreen targets not exhaustively compared |
| Light / Dark / System across the main screens and account preference restore | User confirmed all three work; reported delay investigated below; restart restore still pending this pass |

Previously verified interruption, offline and native accessibility cases remain
documented in the individual migration notes. Repeat them when a new issue or
source change warrants it; this pass does not imply exhaustive device coverage.
The initial navigation pass did not edit or save profile fields, workout sets,
meals or sleep sessions. No plan Review, health sync, account operations or
purchases were invoked. Captures remain in ignored local tooling only.

## October 20 walkthrough fixes

Branch: `fix/release-walkthrough-feedback`; includes the migration status updates.

- Add exercise: list content now uses the search area's 12-point side insets.
  Agent confirmed aligned list dividers/search edges on the native phone.
- Food search: incidental fortification matches no longer receive the reference
  food provenance boost unless the query names the primary food or explicitly
  requests fortification/enrichment. Matching foods remain searchable. Regression
  tests cover protein powder ahead of protein-fortified spaghetti using both
  fixtures and the actual bundled catalog, plus the existing food benchmarks.
  User subsequently found yogurt's protein-amount description ranked first.
  The follow-up removes the provenance boost for incidental nutrient mentions
  outside the primary food name as well. Bundled-catalog tests now require the
  first five broad "protein" results to be protein-named foods, ahead of yogurt
  and fortified spaghetti, and "protein powder" to return Protein Powder first.
  Fresh ranking/benchmark coverage: 22 passed; TypeScript, lint and diff checks
  passed. This follow-up still needs native user review; the earlier full-suite
  and export results below predate this ranking refinement.
- TDEE: applying changes gives an immediate action-label confirmation and a live
  draft-target summary inside the calculator, with Done/Save instructions. Changing
  the estimate restores the apply label. An initial native check confirmed summary
  creation but found it could be below the visible viewport; the action-label
  confirmation addresses that limit. The final native repeat confirmed the
  visible Targets applied to draft action and summary creation. Agent canceled
  the calculator to restore its entry snapshot; no test targets were saved.
- Appearance: freeze inactive tab rendering while retaining mounted state, so
  hidden screens do not all rerender during a theme change. Same normal dev mode,
  same device/capture method: Light/Dark canvas first observed at approximately
  3.7-4.3 seconds before and 1.5-1.6 seconds after. These timings include ADB and
  screenshot overhead; they are not production-build latency measurements.
  Workout, Nutrition, Sleep and Profile reopened without an error overlay after
  enabling freezing. The original Light preference was restored.
- Fresh TypeScript, lint and web export passed; full suite: 479 passed,
  22 emulator-dependent skipped. TypeScript, lint and diff checks also passed
  after the final action-label copy adjustment.
- The agent initially misread the enabled text label inside the disabled Profile
  Save button as an unsaved draft. User reported grey Save; inspecting its parent
  native button confirmed disabled. No user save/discard was needed. The
  calculator test was canceled and cold-reopen verification resumed.
- The repeated force-stop/reopen reached Home. Visible app text on Workout,
  Nutrition, Sleep and Profile matched each pre-restart snapshot. Workout's first
  snapshot was taken during async loading; after settling, it matched as well.
  This comparison covers visible values, not every saved field/history entry.
- User approved exercise-list margins, TDEE application feedback and theme
  switching after this walkthrough. Food ranking remains under review.
- User confirmed the specific protein-powder query returns Protein Powder first
  and requested a broader review. See [food search review](food-search-quality-review.md)
  for the 86-query scope, general ranking refinements and remaining ambiguity.
  Fresh checks after that refinement: 496 tests passed, 22 emulator-dependent
  skipped; TypeScript, lint, web export and diff checks passed.
- The broader ranking review received user approval. The subsequent authorized
  [catalog maintenance pass](food-catalog-maintenance.md) adds two sourced records,
  15 reviewed metadata entries and a 32-case repeatable audit. Existing values
  remain intact; the suspect legacy water record is excluded from new search.
  Current suite: 503 passed, 22 emulator-dependent skipped. Native searches and
  the Cheerios serving preview passed without selecting/saving food after a
  Metro restart/full reload. User review of this catalog follow-up is separate
  from the earlier ranking approval.
- User approved the catalog additions and serving preview, then requested decimal
  serving quantities for all foods. A shared display formatter now covers search,
  recent/favorite labels and both new/logged-food reference previews, preserving
  raw source labels and numeric quantities. It handles mixed/simple and Unicode
  fractions, nonbreaking spaces, invalid fractions and date/code boundaries.
  Fresh suite: 529 passed, 22 emulator-dependent skipped; TypeScript, lint,
  web export and diff checks passed. Native read-only checks confirmed Cheerios
  1.5 cups in its result and reference preview, plus Chili-O 1.5 Tbsp. Preview was
  canceled; no food was selected or saved. Logged-food preview uses the same
  formatter but was not opened against a real saved entry in this pass.

## Separate release steps

After walkthrough findings are resolved, request explicit authorization for any
commit/push/PR, production AAB build or deployment. Production subscription,
purchase and restore checks require the Play-installed production app and a
separately authorized billing test. Dev Premium access is not billing evidence.

Phase-week correction remains postponed. The deferred one-call photo backend
optimization is outside this release verification. No build or deployment is
authorized by starting this checklist.

October 20 release authorization: user approved the reviewed batch and requested
split commits, push, PR review, merge and CI verification. The user wants another
task before the production AAB. This does not authorize a build or deployment.

That batch merged in PR #42 (`abc0ad3`), with successful post-merge Quality Checks.
The subsequent requested task covers [Workout search quality and splash
backgrounds](exercise-search-quality-review.md). Its verification and review are
separate from PR #42; production AAB work remains pending an explicit request.
