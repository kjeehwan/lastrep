# Profile Notebook Native Migration

Branch: `feature/profile-notebook-ui`, based on main after Sleep PR #37.
Design authority: `training-notebook-design.md` v1.18 section 22 and approved
`prototypes/training-notebook/profile.html` / account study. Browser fixtures are
not used as account data. Implementation was merged into main in PR #38.
Core user review is approved; focused follow-ups below remain open.

This maintained note records implementation decisions and generalized verification
coverage. Keep account-specific observations, device details, raw logs and captures
in ignored `.dev-tools/`; do not copy them into this document.

## Scope

- Paper/ink light and dark surfaces, bundled notebook fonts, shared sticky
  centered Profile header, Home back navigation and disabled-when-clean Save.
- Ordered ruled sections: Identity, Training, Units, Body composition, TDEE,
  Nutrition targets, Sleep target, Health sync. No generic Goal or Meal labels
  editor; legacy goal and existing Nutrition-owned labels are not erased.
- Focused editors use Done to accept a section draft, not save the account.
  Cancel, outside tap and Android Back cancel that section. Cross-section drafts
  are preserved. Unit cancellation restores converted mass/calorie strings too.
- Identity photo/initial, nickname, description and real entitlement badge.
  Loading shows Checking access. Sheet cancellation restores staged photos;
  existing private cloud upload/commit/cleanup behavior runs only on Profile Save.
- Training/diet changes preview Week 1, with existing phase history/start-date
  transactions on Save. Selecting the original phase does not restart its week.
- Global RPE/RIR, kg/lbs, cm/ft-in and kcal/kJ retain existing canonical storage
  and conversion behavior. No rewrite of recorded exercise effort/history.
- All four body metrics open the grouped editor, focused on the selected metric.
  Lean body mass is now included in load, snapshot, unit conversion and save;
  it remains separate from manual skeletal muscle and unverified legacy muscle.
  Adjacent help buttons explain those distinct metrics. Recent history is retained
  in its own sheet; dates and source labels are actual account records.
- Deliberate 0.01 weight edits are not lost to the former 0.05 comparison tolerance.
  Unit-only rounded display conversions do not create new measurements. Empty
  unknown values remain absent; clearing an existing measurement directs the user
  to Home Progress instead of silently pretending to delete it.
- Existing TDEE formula, canonical cm/kg, age/height limits and activity factors.
  Applying stages Maintain / Cut minus 400 / Bulk plus 300 and preserves protein.
  Cancelling that section restores its targets. Top-level Save commits them.
- Sleep target keeps the verified bidirectional live synchronization with Sleep,
  saved-baseline reconciliation and preservation of unsaved local target edits.
- Health sync retains consent, permissions, saved records and timestamp semantics.
  Managing permissions does not accept consent. Disconnect stops future reads but
  keeps saved records; failed consent removal no longer reports disconnection.
  Android 14+ setup opens Health Connect settings, with installation fallback.
- Save/Discard/Keep editing guards remain on page Back, hardware Back and tabs,
  with explicit stacked leave labels. Offline Save retains drafts without starting
  a pending write. Validation occurs before starting account writes.

## Implementation Boundaries

- Route retains the existing controller and persistence/permission handlers.
  Legacy inline controls and dark-only stylesheet have been replaced with
  `src/profile/ProfileNotebookControls.tsx` and focused notebook presentation.
- `profileNotebookDraft.ts` provides section-scoped cancellation, validation and
  measurement-change detection with pure regression tests.
- Profile participates in shared notebook tab/dialog geometry; Settings remains
  on its existing presentation until its separate migration.
- `AdaptiveModalCard` adds a focus-registration context for wrapped field
  components. Existing direct TextInput focus tracking remains unchanged; Profile
  fields explicitly register so rotation/IME adjustment can find the active input.
- No native dependency, permission, backend endpoint or Firestore schema/rule
  change. Existing dev client can load this JS implementation through Metro.
- Existing profile save remains a sequence of account operations, not one global
  transaction. Failures retain drafts; this migration does not claim atomic saves
  across profile, phases, nutrition, body measurements and cloud photos.

## Automated Verification

- TypeScript, Expo lint and unit tests run during implementation.
- Latest October 19 suite after separating the deferred optimization: 444 passed,
  22 emulator-dependent tests skipped in the ordinary run. The earlier 447-test
  run also included three tests for the deferred code, now preserved locally.
  No new Firestore rule changes require deployment for Profile.
- October 19 TypeScript, Expo lint and web export passed. Source-contract tests guard notebook integration,
  controller preservation, lean-mass wiring and wrapped-field focus registration.
- Pure tests cover section cancellation, preserving unrelated/remote values,
  unit/TDEE rollback, validation and unit-only versus deliberate measurement edits.
- Source-contract tests do not replace native focus, visual or permission testing.

## Earlier Phone Checks and Refinements (October 17)

- Checked the native Android dev app. Clean Save is disabled. Changing nickname
  then Cancel restores it; phase change then Android
  Back restores the original phase/week without leaving the page dirty.
- Staged effort/unit changes through Done, tested Keep editing and Discard and
  leave through tab navigation, then verified restoration and clean Save. No test
  drafts saved.
- Body editor opens the selected metric. Independently populated and absent
  measurements remain distinct. Draft cancellation restores the prior state; the
  body heading returned to identical pre-sheet bounds, not the top of the page.
- Found and fixed short-landscape keyboard collapse: when available modal space is
  too short for a pinned footer, AdaptiveModalCard places that footer in the scroll
  content. Verified active input visible above IME and Cancel reachable by scrolling.
  Added a pure short-window/enlarged-text footer regression test.
- Focus now waits for native Modal onShow. Select-all applies only on first focus,
  not subsequent focus restoration or taps. Real on-screen keypad successfully
  replaced a saved value with a deliberate 0.01 draft edit, preserved it through
  rotation, then Cancel restored the original value.
  Raw ADB input-text injection is not used as proof of normal keypad behavior.
- TDEE Apply then Cancel restored all original calorie targets and unchanged
  protein. Tapping Protein opened all four nutrition targets with saved quantities.
- Health permission management opened the native Android Health Connect page;
  returning preserved access state. Cancelling disconnect confirmation also
  preserved the prior state.
  Reconnect/disconnect were not invoked. A later consented Sync now check did run;
  the latest verification is recorded below.
- Remove photo then Cancel restored the prior photo state and left Save
  disabled. Clean page Back returned Home; returning to Profile remained clean.
- A representative shared-modal regression check opened Sleep target with the
  keyboard in landscape; its direct input remained visible. Cancel preserved
  the target. Returned to Profile afterward.
- Light/dark and 200% text checked; labels/fields reflow, content remains scrollable.
  Restored original device display settings after testing.

## October 19 Feedback Refinements and Verification

- Checked native Android availability and loaded the current bundle using normal
  `start:dev-client` mode. New badge order and equal unit cells confirmed the
  current bundle. Historical tests were not used as current proof.
- Identity order is nickname / neutral access badge / description. Full phase/week
  values remain on one line when they fit, wrap on narrower screens and stack at
  enlarged text. Removed forced single-line truncation. Phase-editor week and
  save/start explanation are separate paragraphs.
- All four unit/effort choice groups use equal cells. The shared 16-pixel circled
  information icon has a 44-pixel target; Profile body definitions and Home
  Readiness/Weekly Trends reuse it. Native unit-cell bounds and Profile info
  targets were inspected on the current bundle.
- Profile focus uses minimal visible-field scrolling, with opt-in animation that
  respects reduced motion. Current native checks found the focused body field
  visible above the IME in portrait and landscape. All four fields were focused
  in portrait without typing: already-visible body-fat/lean fields stayed still;
  focusing Weight moved only the small amount needed for top clearance. Cancel
  returned the body heading/row to identical bounds and Save remained disabled.
  Smoothness, reduced-motion device behavior and the complete landscape
  field-by-field matrix remain user review items.
- Sync feedback now waits for settled feedback/content-size layout before
  scrolling to the bottom. The reveal is consumed once so later unrelated updates
  do not keep pulling the reader down. Results retain a polite live region.
- Checked multiline Sync now feedback at 110% and 200% text; the result remained
  fully above bottom tabs, with approximately 64 dp clearance in each case.
  These were live sync checks, which can refresh imported account data/timestamps;
  no manual measurement or Profile draft was saved.
  All-no-data, permission-error and unusually long provider errors were not forced.
- Restored original device display settings after testing.
- Inspected all four Today's Plan corners in a temporary native preview of the
  real `WorkoutTodayPlan` component with `plan=null` and no-op actions. Bottom
  corners are rounded. No plan generation/apply or real workout modification was
  triggered. The preview and temporary navigation entry were removed; checks
  below were rerun afterward. This verifies component rendering, not plan behavior.
- Regression contracts cover badge order, equal selectors, phase explanation,
  untruncated values, focus/motion wiring, settled feedback reveal and all-corner
  Workout sheet styles. These are source contracts, not native interaction tests.
- Verification before user-review follow-ups: TypeScript and lint exit 0; 77 test files passed,
  2 emulator-dependent files skipped (426 tests passed, 22 skipped); web export
  generated 44 routes. No dependencies or native build changed.

## User Review and Follow-ups (October 19)

- User approved the Profile presentation, Save/reopen persistence, photo
  persistence after reopening, landscape keyboard behavior and health
  disconnect/reconnect.
- Sync now no longer opens Health Connect settings when access is missing. It
  shows an inline explanation directing the user to Health Connect permissions
  and refreshes the displayed access state. The explicit permissions action and
  intentional Connect/Reconnect flow retain their existing roles.
- Added a regression contract preventing permission requests/settings navigation
  inside Sync now. After this fix, TypeScript, lint, web export and 427 tests
  passed; 22 emulator-dependent tests were skipped. Native revoked-access retest remains.
- Photo save now reports Uploading photo, Saving profile and Finalizing photo
  at their corresponding stages. The pipeline remains upload/process, profile
  writes, then photo commit/previous-photo cleanup. The subsequent timing and
  optimization follow-up is recorded below; server startup is not a confirmed cause.

### Photo-save performance and final feedback follow-up

- User approved the missing-permission behavior. Sleep sync now reports
  `No new sleep data found.` for an unchanged import; saved history is not absence.
- Reduced-motion functional checks showed no usability difference. This is expected
  for visible fields/manual scrolling; only automatic field-reveal animation is
  conditional. Native settings reported animations disabled during inspection.
  A visible on/off animation comparison was not established.
- Two instrumented photo-only saves in normal dev mode measured 10.15 s before
  selective writes and 2.97 s after. The baseline spent 4.34 s uploading, 4.18 s
  committing and 1.40 s on unchanged general/sleep/nutrition writes. The later run
  skipped those writes and also had faster cloud calls. These are two observations,
  not proof that the code change alone caused the full reduction.
- An additional instrumented photo-only save on the current deployed backend
  completed in 3.23 s: local read 0.20 s, upload 1.84 s and commit 1.18 s.
  The subsequent authenticated photo download took 0.45 s, excluding final image
  decoding/rendering. This is consistent with the preceding 2.97 s repeat but
  does not establish cold-start or cross-network latency. No deployment is needed
  to retain the selective-write improvement; the optional one-call path remains
  deferred pending an explicit request. Recheck timing hooks were removed afterward.
- Read-only cloud logs put baseline upload/commit handler execution at about
  2.45 s combined, versus 8.52 s elapsed in the client calls. The remainder is
  outside handler execution; network/startup overhead was not separately proven.
- Selective writes are implemented and exercised against the current backend.
  Profile/phase, sleep and nutrition changes still save when staged; a photo-only
  save does not rewrite those unrelated preferences.
- A compatible one-call photo-only upload/commit path was prepared and unit-tested,
  including normalized-image reuse, old-backend fallback and failed-commit cleanup.
  Mixed drafts retain two-phase ordering. See `cloud-profile-photos.md` for scope.
  The required `stageProfilePhoto` deployment has **not** been performed or authorized;
  live one-call performance and persistence remain unverified.
  Before committing the migration, this optional client/backend change was moved
  into an ignored local patch and full source backup. The branch retains the
  deployed two-call flow, selective writes and interruption/retry regression test.
- Temporary timing hooks were removed. Detailed timings and raw cloud logs remain
  in ignored `.dev-tools/`; no account values or image contents enter maintained notes.
- After tracing removal: TypeScript, lint, backend build and 439 tests passed;
  22 emulator-dependent tests were skipped. Backend preparation has unit coverage,
  not a deployed/native one-call verification.

### Offline feedback follow-up

- User verified that an offline Save retains the draft, Keep editing preserves it,
  and restoring the original field after reconnection returns Save to disabled.
- The review exposed duplicate offline notices and a persisted offline save message
  after reconnection. Profile now uses one connectivity-driven notice in place of
  save feedback while offline; a blocked Save returns without storing another
  message. The shared dismissible bottom banner remains available on Profile,
  matching other screens; it is separate from the contextual draft notice.
  The notice disappears when connectivity returns without modifying the draft.
- User verified one top notice and its offline behavior. Restored the shared bottom
  banner after follow-up review; its dismissal behavior is unchanged. Regression
  coverage retains the pre-write guard and shared-banner visibility. The later
  native interruption check below verifies failure/retry during an upload request;
  this is separate from the offline-before-Save case.

### Offline restart and background refresh follow-up

- An offline dev-app restart exposed an unhandled deferred sleep-profile read;
  the dev error overlay remained after connectivity recovered. Deferred Profile
  health refresh now handles offline rejection, including a connection loss after
  scheduling, and reports unexpected failures without an unhandled promise.
- An unfinished initial Profile load waits for connectivity and retries when it
  returns. Failed/unavailable loads show a noneditable state with Retry and no
  saved baseline; default field values cannot become a saveable account. An
  already-loaded draft is preserved through connectivity transitions. Cancelled
  loads cannot apply stale results after an auth/connectivity effect changes.
- Home's profile preview distinguishes unavailable data from a loaded profile;
  it no longer presents the generic name, empty description and entitlement badge
  as an actual loaded account when its profile document is absent from cache.
- Added async rejection tests and initial-load/preview wiring coverage. TypeScript,
  lint, web export and 444 tests passed; 22 emulator-dependent tests were skipped.
- Reloaded the dev client after connectivity was restored. Profile loaded normally,
  clean Save was disabled, the old error overlay was absent and no new unhandled
  rejection appeared in the post-reload native log. No manual account changes were
  saved. The later cold-start/reconnect checks below supersede the initial pending review.
- Native offline cold-start check subsequently passed: Home preview explicitly
  reported unloaded profile data without a Free badge. Profile showed the
  unavailable-data message with Save and Retry disabled. No Firebase error overlay
  or new unhandled rejection appeared. The shared offline banner was dismissed to
  reach Profile. No edits or account saves were performed; automatic recovery was
  subsequently tested after the readiness fix below.
- The first reconnect attempt exposed a readiness race: NetInfo reported online
  before Firestore could finish the initial load. The safe unavailable state
  remained, without an unhandled error. Initial loading now also retries when a
  server-confirmed profile snapshot arrives, with metadata events enabled; cached
  snapshots and already-loaded/draft baselines cannot trigger that retry. Added
  regression coverage for this recovery gate; 446 tests passed, 22 skipped.
- Final native airplane-mode cycle passed after that fix: an offline cold start
  reached the unavailable Profile state with Save disabled; restoring connectivity
  loaded the saved profile automatically, without Retry or another reload. Clean
  Save remained disabled and no new unhandled rejection appeared. Airplane mode,
  Wi-Fi, mobile data and Bluetooth were restored to their original settings.
  Earlier Wi-Fi/data-only cycles did not establish the same unavailable state and
  are not used as proof of this cold-start recovery result. No manual edits or
  account saves were made.

### In-flight photo upload interruption follow-up

- Native check on October 19 against the existing deployed two-call backend:
  started Save with a user-selected photo, observed the actual upload HTTP request
  in flight, then enabled airplane mode and disabled Wi-Fi before an upload
  acknowledgement or commit. The request failed offline with the existing Save
  failed explanation; no commit call or unhandled rejection occurred. This checks
  an interrupted in-flight request, not a measured percentage of body bytes sent.
- Restored all original connectivity/Bluetooth settings. After dismissing the
  failure message, Save remained enabled for the retained draft. Retrying without
  selecting the photo again completed upload and commit, showed Changes saved,
  and disabled clean Save. Restarting the dev app resolved the saved cloud photo
  successfully, with no unhandled rejection. No runtime fix was needed.
- Added an async regression test for upload rejection, no subsequent commit, and
  retry using the same local file. Temporary request tracing was removed exactly;
  private artifacts remain ignored. The optional one-call backend remains
  undeployed and was not covered by this native test. Loss of a commit response
  after the server has saved is a separate ambiguity, not established here.
- Final checks after removing tracing: TypeScript, lint and all 447 tests passed;
  22 emulator-dependent tests skipped. The final native Profile was loaded with
  clean Save disabled and no error overlay. No deployment or build was performed.

### Commit preparation

- The user authorized split commits and push on October 19. Shared modal/Workout
  refinements, Profile implementation/recovery and sanitized documentation form
  separate commits; merge, deployment and AAB build remain separate requests.
- Preserved all pre-separation changes in an ignored source backup. The optional
  one-call code and its three exclusive tests are in a reapplicable ignored local
  patch, excluded from committed source. Backend source matches the branch base.
- Final source checks after separation passed: TypeScript, lint, web export and
  444 tests; 22 emulator-dependent tests skipped. Existing native interruption
  evidence used the same deployed two-call flow, before removing the optional flag.

## Remaining User Review

Earlier agent checks are separate from the user approvals recorded above.
Sync now was explicitly invoked as recorded above. No fake measurements, Profile
Save, workout edits or health-access changes were performed in the resumed checks.

1. Verify the revised `No new sleep data found.` wording on the current bundle.
2. Reduced-motion functionality is reviewed; a clear on/off contrast for automatic
   field-reveal animation remains unconfirmed. Manual scrolling is unaffected.
3. Open/edit/cancel each group. Confirm the main page stays at its prior scroll
   position; Done stages edits; Cancel/Back/outside revert only the active section.
4. Review the locally preserved one-call backend optimization before reintroducing
   it. Deployment needs an explicit request, followed by native
   replacement/reopen/failure checks and fresh timings.
5. Retest the restored shared bottom banner on Profile: it dismisses on tap, while
   one contextual top notice remains offline and clears on reconnection. Draft
   retention and clean Save are user-verified. In-flight upload loss and retry now
   pass the native check above; other save-failure cases remain separate.
6. Verify phase weeks, global units/effort, TDEE target staging, and Sleep target
   synchronization both ways without reload. Protein should survive TDEE apply.
7. Health disconnect/reconnect is user-approved; other untested permission/device
   edge cases remain separate from that approval.

Do not commit, push or merge until the user reviews the native migration.

The temporary sanitized checkpoint was retired on October 19 after its durable
decisions, current verification and remaining review items were transferred here
and to design specification v1.18. The ignored local original was left untouched.
