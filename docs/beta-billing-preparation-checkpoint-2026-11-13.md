# Beta billing preparation - November 13, 2026

Branch: `fix/beta-billing-preparation`, based on main `7307a76` (PR #95).
User approved app preparation before beta recruitment. The initial November 13
implementation preceded Git delivery or a production build; November 14 approval
and release preparation are recorded below.

## Implementation and architecture

- Central public-beta policy disables new purchases. Settings replaces the sales
  section with Beta access and the agreed free-beta / undecided-launch-pricing copy.
  Shared SettingsRow/SettingsSection typography, spacing and icons are reused.
- Existing Manage subscription and Restore purchases remain available in the
  Play-installed package, including for users whose current entitlement is inactive.
  Management copy explains that existing subscriptions must be cancelled in Play
  to stop renewal. Dev packages retain billing isolation and omit these store actions.
- The legacy paywall route redirects to Settings without mounting the sales screen
  or fetching its offerings. Its stack header is hidden during beta. The underlying
  purchase service independently returns purchases_disabled_during_beta before any
  RevenueCat configuration or purchase SDK call. Future reviewed policy can restore
  the existing sales flow; product identifiers and configured prices are unchanged.
- Entitlement ownership, paid subscription processing, restore cancellation,
  existing grants and account-scoped data are unchanged. No automatic Premium grants
  were introduced. No collection/provider/retention change requiring policy updates.
- This guard applies to the new app version. Older installed builds and their Play
  product availability are not changed by source edits. Existing recurring payments
  are not cancelled by this policy.

## Verification

- TypeScript and scoped lint passed. Fifty relevant billing/restore/Settings tests
  passed, including new behavior tests proving no SDK purchase/configuration while
  disabled, the retained purchase path when enabled, and unchanged restore behavior.
- Fresh phone dev-app review confirmed the complete Beta access copy in light mode
  and a direct /paywall link returning to Settings without sales UI. No personal
  account, workout, purchase, entitlement or preference was changed by the checks.
- Disposable local Firebase Auth/Firestore account on an isolated emulator session:
  inactive account displayed beta copy without offers; a manual Premium account
  retained beta copy; runtime purchase attempt returned the beta-disabled error;
  /paywall returned to Settings; signed-out /paywall reached Sign in without sales UI.
- Emulator dark layout inspected at font scale 1.5. Changing Android display settings
  recreated the activity and returned Home, so Settings was reopened before capture.
  Original font scale and night mode restored afterward.
- Production-only management and restore rows were reviewed in code and restore
  behavior tested with mocks. Actual Play billing handoff/restore requires the next
  Play-installed release and remains unverified for this batch.
- Local account/documents removed, signed out, generated login credentials removed.
  Task Firebase and isolated Metro servers stopped and emulator port forwards removed.
  Normal phone dev server remains available. Phone left at Settings > Beta access.

## November 14 delivery preparation

- User approved Beta access and the recruitment demo. The latest approved demo,
  silent version, preview and required music attribution are in
  `store-listing/beta-demo-2026-11-14-precise/`. Superseded delivery exports were
  removed; raw capture sources and reusable tooling remain local and ignored.
- User authorized commit/push, PR review/merge and a local production AAB build.
  Play's highest uploaded version and the EAS counter were both confirmed as 48;
  the intended next release is 1.0.1 (49).
- Fresh Expo Doctor identified five required SDK patch updates: Expo 57.0.33,
  Auth Session 57.0.17, Constants 57.0.24, Linking 57.0.14 and Router 57.0.31.
  They are included in release preparation; checks must cover the updated lockfile.
- After the patch updates, fresh Expo Doctor passed 20/20, application TypeScript,
  lint and tracked Android verification passed, and all 975 ordinary unit tests
  passed. The 100 emulator-dependent tests are not covered by that local unit run;
  PR Firebase-boundary CI supplies its own integration checks.
- Homepage beta invitations remain deferred. Recruitment posts have not been
  published. Play upload, internal acceptance and closed-track promotion follow
  artifact verification and remain separate user steps.
- Actual production subscription management/restore remains a Play-installed
  acceptance check; unit, emulator and dev-app checks do not establish it.
