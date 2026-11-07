# Today's Plan review height — November 7, 2026

Branch: `fix/todays-plan-sheet-height`, based on `9e979a3`.

The fixed 85% height left a large empty body when disclosure rows were collapsed.
The review now uses intrinsic content height with an 85% maximum. Its body can
shrink and scroll at the limit; the heading and action remain outside that
scrolling body. Internal bottom padding is 16 dp; NotebookModal already reserves
the system/tab-bar space. Explanation, context, unchanged-exercise and individual
exercise disclosures animate their layout unless system reduced motion is on.

This change is limited to the review presentation and its design rule. It does
not change progression rules, Apply/Undo, recovery inputs, account storage or
sharing. The embedded Recovery check-in retains its existing layout. Sharing's
approved stable height across tabs is not changed. No privacy update is needed.

## Verification

- TypeScript, focused ESLint and all seven native notebook contract checks pass.
- Actual Android dev-client checks use a new disposable account and synthetic
  records in local Firebase emulators (`demo-lastrep-sharing`), not cloud or
  personal records. Reviewed collapsed, explanation-only, context-only, both
  expanded and re-collapsed states, plus light/dark appearances.
- At normal portrait text size, the body measured about 231 dp collapsed,
  461 dp with explanation and 550 dp with both sections expanded at the cap.
  Re-collapsing returned to the original 231 dp body height. The footer remained
  at the bottom of the sheet. No imperative scroll-to-top or remount is used;
  native scrolling retains its offset, bounded by the new content size.
- Landscape retains a visible action and a scrolling body. At 200% portrait
  text, native swipes reveal longer explanations while Apply changes stays
  visible. These are separate checks, not a combined landscape/200% claim.
- Disabling Android transition animations updates the component's reduced-motion
  state; disclosures continue to work. Original font scale, rotation and
  animation settings are restored after the check.

No physical-phone review, Git delivery, deployment or new AAB is included.
The store-listing compositions still show the previous review height; refresh
their native sources after this app presentation is approved. The separate
Last-column capture, Sharing-menu and Health Connect capture feedback remains
outstanding.

Follow-up: these capture/menu items and regeneration are now completed in
`sharing-listing-polish-2026-11-07.md`; the original review-height verification
above remains unchanged.
