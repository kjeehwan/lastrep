# Top and Back-off native implementation

November 25, 2026. Branch: `feat/top-backoff-progression`. Approved study:
[proposal and mockup](top-backoff-progression-proposal.md).

## Behavior and architecture

Explicit `top` and `backoff` roles extend the existing set model and menu. T/B
markers appear in the workout and history. Normal, Warm-up, Failure and Drop
retain their prior meaning. Resistance exercises expose the new roles; loads
never infer a role. Recorded effort remains separate from prescribed targets.

Optional exercise `groupTargets.top` / `groupTargets.backoff` override the whole
exercise-default target object. Null/missing overrides inherit defaults. Only
active roles appear in summaries and the grouped editor; hidden overrides are
retained. The existing staged target editor handles validation, cancellation,
RPE/RIR and clear/use-default actions. Editors remain account scoped.

`setGroupReview.ts` adapts explicit groups to the existing deterministic review
engine, reusing its recovery, pain, activity, diet, deload, rep-step, equipment
and recent-performance rules. This version supports one Top followed by uniform
Back-off sets. Other arrangements stay recordable, with manual-review reasons.
No progression is proposed after recording starts. Role-specific target effort
governs qualification; the legacy exercise-wide high-RPE adjustment is not used
to override a deliberate group effort target.

Recent role-specific sessions must match prescription and set count. Missing or
ambiguous latest roles cannot be skipped to borrow an older success. Rebuild
and available-weight constraints remain in the shared progression algorithm.
Untyped historical records are never relabelled. Routine loading uses recent
values only when explicit role order/count still match; otherwise it preserves
the routine's own prescription. Last displays the previous workout by working-set
order, excluding warm-ups, independently of today's role labels. The same mapping
is used by Copy Last. Changing a role never hides/shifts historical effort or
changes saved history. Progression eligibility remains stricter than Last display.
Missing role history, absent recent sessions and mixed/count-mismatched groups
have distinct explanations. Missing latest effort is not filled from older records.

The review retains one exercise heading and group-level selections. Apply checks
the current group prescription and protects recorded sets, warm-ups, other roles
and duplicate exercise blocks. Undo retains the existing subsequent-edit guard.
Group targets, per-set targets and role-specific deload markers participate in
review identity. Separate deload markers prevent repeated reductions after a
partial Apply. Successive deload selections retain the original untouched plan;
Undo restores the preceding backup. An intervening set edit establishes a new
chosen prescription rather than authorizing restoration over that edit.

The optional fields are carried through local drafts, workout history/repeat,
routine saves/updates, program loading and workout/program sharing adapters.
No account-wide data migration is required. Old app versions do not understand
these roles; use the updated app when editing this new data on another device.

## Sharing compatibility and rollout

The canonical strict sharing contract remains
`src/sharing/sharingContract.ts`; the backend copy is generated during build.
Workout/program envelope versions retain their existing meanings. New clients
and the hosted preview send `supportsSetRoles: true`. The backend checks that
capability before returning or importing a snapshot containing roles or group
targets, including roles nested in programs. Older clients receive an explicit
Update Lastrep error. Roles and targets are preserved, not silently flattened
to Normal. Plans without the new fields keep their existing behavior.

Deploy the sharing backend and hosting together before distributing a build
that shares the new fields. Git delivery, sharing deployment and a local production AAB were authorized
after the user accepted the follow-up changes. See the delivery checkpoint below. Review `doc/privacy.md` and hosted policy:
existing exercise-prescription/target sharing wording covers these additions;
no new provider, analytics event, permission or data category was introduced.

## Verification

- Follow-up to phone feedback: 83 focused decision/presentation/copy tests pass,
  including partial role edits/reversion, historical RPE preservation, missing
  effort, role-history explanations and recovery advice taking precedence.
  These changes do not infer historical roles or modify saved workouts.
- Copy review covers the group headings, expanded reasons and unchanged-exercise
  text in `WorkoutTodayPlan`, plus all shared progression explanations. Missing
  labels, duplicate history entries, missing/unsupported effort, exceeded effort
  and changed prescriptions have distinct cause/action wording. Session metadata
  retains duplicate-entry identity solely to select the correct explanation;
  progression eligibility and persistence are unchanged. No promise is made that
  recording a labeled workout guarantees a future increase. The design guide
  now requires this review for user-facing messages. This copy follow-up has not
  had a new native visual review.

- Application TypeScript, lint, backend build, Expo web export and tracked Android checks pass.
- Full unit run: 1,035 passed; 102 environment-gated tests skipped in that run.
  The separate disposable Firebase gate executed 101 tests across 11 suites with
  no skips, including new workout/program role compatibility and import tests.
- Tests cover independent qualification/selection, mixed and recorded holds,
  missing/ambiguous history, recovery/nutrition, equipment and rebuild limits,
  group defaults, draft/program/sharing round trips, review identity and deload
  restoration. Existing uniform Normal progression remains covered.
- Native Android 16 emulator, dev package, verified disposable account on the
  configured Lastrep backend: set markers/menu, group summaries/editor,
  cancellation, RIR conversion, disabled Apply with no selection, Apply/Undo,
  Back-off-only Apply and Top-to-Normal changes checked. Persisted Back-off-only
  result kept Top at 130 x 8 while both Back-offs became 110 x 10, with empty
  recorded effort. No personal account records were mutated.
- Dark normal-size review, light picker/editor, 200% text picker/editor and
  landscape picker/editor visually checked. Landscape rows outside the short
  viewport remain scrollable. Original emulator font, rotation and Dark
  appearance settings restored after verification.
- Connected Galaxy A51: the cold dev-client launch remained on the native black
  splash at Home despite loaded fonts and a live JS runtime. Navigating to
  Workout after startup revealed the screen. This launch behavior was not
  changed by this feature; investigate separately if it recurs. The rendered
  Workout choices screen was inspected and left open for user review. No
  personal workout, routine or health record was edited. The user reviewed the roles, targets and review, then accepted the Last/history
  display and American English copy follow-ups. This acceptance covers the
  reviewed flow; historical roles are not inferred.

Unrelated `docs/production-access-application-notes.md` remains untouched and
untracked. Local screenshots, credentials, CDP helpers and logs remain private
under ignored `.dev-tools/`.

## Delivery checkpoint

- Final local feature checks: 1,035 unit tests passed (102 environment-gated
  tests skipped); the separate Firebase gate passed all 101 tests with no skips.
  Backend build, native configuration, contract generation and web export pass.
  Application TypeScript and lint passed after the final copy edits.
- Final review traced account-scoped target editing, draft/history/routine/program
  mappings, independent Apply/Undo, deload restoration and old-client sharing
  capability checks. No new collection/provider/permission is introduced.
- Fresh Expo Doctor found nine SDK-compatible patch updates. Resolve these as a
  separate maintenance commit and repeat release checks before the local AAB.
- Deployment target: lastrep-ebac5, functions workoutSharing/sharingPage and
  hosting target sharing (lastrep.web.app). Firestore/storage rules are unchanged.
