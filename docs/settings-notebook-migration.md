# Settings Notebook Native Migration

October 19, 2026. Branch: `feature/settings-notebook-ui`, based on main after
Profile PR #38. Design authority: `training-notebook-design.md` v1.24, section 22,
and the approved `prototypes/training-notebook/settings.html` study. Implementation
is user-approved and prepared for the authorized split commit/push/PR/merge.
Settings presentation and the auth/onboarding browser designs have user approval;
remaining production-only verification is listed below. Browser fixtures are
not account data.

## Implemented

- Paper/ink light and dark themes, bundled notebook fonts, shared centered sticky
  header and notebook tab/dialog geometry. Header and Android Back return Home.
- Appearance offers Light/Dark/System, defaults to System, and persists on this
  device separately per account through app restarts. Shared providers resolve
  the same choice for all six notebook screens, tabs, dialogs and navigation without theme-based route
  keys. Controls stack at enlarged text. Failed storage settles with feedback and
  the last saved selection; no account/network write is involved.
- Ordered ruled Account, Appearance, Support, Legal, Subscription, Session and Delete account
  sections. Row icons share a 24-pixel column and 12-pixel text gap. There is no
  redundant Profile Edit link or About section.
- Live account document subscription, account-scoped identity and neutral access
  badge. Unloaded data stays explicitly unknown rather than showing a generic
  account or transient Free access. Existing saved details survive connection loss.
- Support opens an email draft on a tap and handles unavailable mail apps. Its
  draft includes only installed app metadata, without redundant directions to find
  it, account values or logs. Privacy retains the published-policy handoff and failure
  message; neither external destination opens automatically.
- Noninteractive App version row reads `ExpoApplication` native metadata, preserving
  the installed flavor suffix and build. Missing metadata says Not available.
  No Metro/OTA manifest or browser version is substituted. At enlarged text the
  version reflows below the label. The icon matches the approved filled-dot drawing.
- Existing entitlement hook, purchase/restore controller, analytics context,
  subscription-management URL and upgrade route remain. Access does not claim a
  paid store subscription. Dev builds explain unavailable billing and hide store
  actions. Production restore retains its existing outcomes and duplicate guard.
- Explicit stacked logout/deletion confirmations, safe cancellation labels,
  signed-in-account guards and duplicate account-operation protection. Deletion
  explains separate Google Play subscription cancellation. Existing account-delete
  callable, photo-cache clearing and sign-in redirect remain.
- A connectivity notice and shared dismissible bottom banner; store/account
  actions disable offline, before connectivity is known, and during operations.
  Failures settle progress and show feedback. Developer tools remain dev-only;
  their grants/reset operations were not invoked during visual checks.

## Dependency and build notes

`expo-application` 57.0.3 was already installed transitively through auth-session.
It is now an explicit SDK-compatible dependency; the lockfile moves the same
package to the root. The current installed dev client already exposes its native
module, and the displayed version/build matches Android's installed package.
No APK installation, uninstall, data clear, AAB build or backend deployment was
needed. A local dev-build attempt failed at task selection because APP_VARIANT
was not set to dev; it did not build or install an APK. Future native builds must
set APP_VARIANT=dev when selecting the dev flavor.

## Verification

- TypeScript, lint, Android native/config verification, web export and 456 unit
  tests passed; 22 emulator-dependent tests skipped in the ordinary run.
- Added coverage for installed version/build versus missing metadata, unknown
  account access, explicit account confirmations, existing billing handoffs and
  live identity subscription. Shared navigation tests now include Settings.
- Native current-bundle checks: Settings/version row loads without an error
  overlay; redundant Edit is absent. Logout and deletion confirmations open;
  Stay signed in / Keep account leave Settings and the account intact. Deletion
  includes the subscription warning. Header and Android Back both return Home.
- Native offline/reconnect: saved access remains visible, one contextual notice
  appears, logout/deletion disable, and the notice clears after reconnect. Network
  and display settings used by the checks are restored afterward.
- Native light/200% check confirmed the version row is visible and noninteractive,
  the deletion action is reachable, and Keep account safely cancels its confirmation.
  Actual landscape viewport dimensions were confirmed separately; the sticky header
  stayed visible and scrolling reached Sign out above the tabs. Portrait/font/theme
  settings were restored. Earlier helper attempts that returned Home or failed to
  reveal an action are not used as proof of these final results.
- Final current-bundle check left Settings at Account in the original portrait,
  font and theme configuration. Installed metadata still matched the package;
  no error overlay or new unhandled rejection appeared during the native checks.

### Appearance follow-up

- Native checks verified the exact shared light and dark canvas colors on Home,
  Workout, Nutrition, Sleep, Profile and Settings. Light stayed selected and active
  after restarting the dev app. System followed both OS light and dark changes.
  The original app preference and OS night-mode setting were restored; no new
  unhandled rejection appeared. Initial helper samples taken before selection
  settled are not counted as verification.
- Final-source native check confirmed all three appearance choices are reachable
  at 200% text. Original font scale was restored, Settings remained visible and
  no error overlay appeared. TypeScript, lint, web export and all 456 tests passed
  after the hydration/status-bar refinements; 22 emulator-dependent tests skipped.
- Persistence tests cover missing/invalid preferences, unavailable storage,
  save failure/retry and serialized overlapping changes. The root's web loading
  shell avoids reading browser appearance before hydration. Legacy dark login
  screens retain their existing status-bar contrast.
- User approved the version row/information icon and safe confirmation cancellation.
  Removed the redundant Settings > Support sentence from new support email drafts.
- Real logout/deletion can be tested in the dev app, using a disposable account
  for deletion. They do not require an AAB. For the current production billing
  UI, use the production package on the internal test track with a license tester.
  The separately packaged dev app deliberately blocks billing. Android also
  supports matching-package sideloaded license-test builds, so a new AAB is not a
  universal technical requirement; this project retains its Play-installed release
  validation workflow. No AAB or billing operation was performed in this follow-up.

Keep screenshots, raw UI dumps/logs, device identifiers and account observations
in ignored `.dev-tools/`. This maintained note contains generalized results only.

## October 19 review follow-up

- User approved Light/Dark/System, real sign-out/sign-in and deletion using their
  own account checks. Settings now consistently says Sign out in the action,
  confirmation, progress and failure copy.
- The observed Dark selection came from the shared installation preference.
  At the user's request, preferences now belong to each account on this device;
  missing account choices default to System. The old global value is retained in
  storage but not inherited because its owner is unknown. Existing users choose
  their override again once. Signed-out appearance is separately scoped.
- Account-switch tests cover defaults, returning choices, late reads and queued
  writes. Theme changes do not remount navigation or clear drafts.
- Macro colors intentionally retain green/brown/gray families with theme-specific
  brightness and percentage foregrounds. Recommendation: retain these contrast
  adjustments. No Nutrition color change was requested or made.
- Authentication/onboarding browser proposals are linked from the existing study
  site. Native authentication/onboarding presentation has not been migrated.

## Latest verification after account-specific preference changes

- TypeScript, lint and web export passed. App suite: 458 passed, 22
  emulator-dependent tests skipped. Profile/Workout prototype model checks: 23
  passed. These results cover the latest appearance and Sign out changes.
- New browser proposals passed 280 layout combinations (14 states, five viewport
  sizes, both palettes and normal/200% text), plus validation, password visibility,
  sign-in simulation, onboarding progression, retained Back selections/nickname
  and optional-health return. No browser exceptions or external requests occurred.
  Representative light screenshots were visually inspected.
- Current-bundle phone check confirmed a Light override and restoration of the
  original selection with Settings still visible. Sign out confirmation wording and
  Stay signed in cancellation also passed on the current bundle. Cross-account native behavior
  remains pending; no account was created, signed out or deleted by the agent.

## Remaining review

- Sign in / Sign up, revised four-step onboarding, final availability controls
  and consistent sidebars are user-approved. Native auth/onboarding migration
  has not started. Phase-start correction remains postponed.
- User phone checks passed: a new account defaults to System and a returning
  account restores its own choice.
- External support-compose/privacy handoffs remain separate acceptance checks.
- Real paid/free/manual-grant restore outcomes require the Play-installed
  production app. Dev presentation and unit tests do not verify production billing.

The user explicitly authorized split commits, push, PR creation and merge for
this Settings/browser-study batch on October 19 after confirming the sign-in
overlap was gone. Branch deletion, deployment, AAB builds and native auth/onboarding
migration are outside that release authorization.


## Approved authentication/onboarding browser baseline

Sign in / Sign up and the final onboarding refinement are user-approved.
Onboarding uses the existing Home logo at the upper left, Back/Skip below,
Experience, a 1-7 availability slider without visible minus/plus controls,
optional Nickname and a standalone final health-info screen with Go to Home.
Production retains blue-purple branding; dev retains orange-red.

User chose removal of the old goal question and phase management in Profile.
Sample program and standalone save-error review state were removed. Existing
account goal data, phase dates and native account/onboarding behavior are
unchanged. Phase-start correction is agreed in principle but explicitly postponed;
do not implement it in the current migration.

All eight study sidebars use matching Review labels without prototype suffixes,
with screen links grouped above the controls in the shared documented order.
The current screen is omitted; Scope and review guide remains below. User approved
this sidebar revision as well.

Latest browser verification: 220 layout combinations passed across all 11 entry
states, five viewport presets, both palettes and normal/200% text. Flow checks
covered validation, password visibility, header placement, optional nickname,
retained Back entries, Skip progression, final Home navigation and keyboard
Arrow/Home/End slider changes, 1-7 bounds and the accessible value. No browser
exceptions, overflow defects or external requests occurred. Representative
availability/final-health screenshots were inspected. Separate sidebar checks
passed on all eight pages, including all 56 screen-link destinations and the
reported Onboarding-to-Home path. These results supersede the first proposal's
280-check snapshot and the intermediate checks that included minus/plus controls.
Native code was not changed or retested in these browser-only revisions.


## Sign-in transition follow-up

User confirmed both per-account appearance phone checks passed. They separately
reported logo/text briefly overlapping Android status icons after sign-in before
settling. This is a content-inset defect, not normal edge-to-edge background.
Home now applies top/left/right inset values from useSafeAreaInsets directly to
its outer View instead of the native SafeAreaView. This follows React Navigation's
safe-area guidance for animated transitions. Bottom space stays owned by tabs;
no hard-coded status-bar height, account flow or auth UI migration is introduced.
User repeated sign-out/sign-in on the phone after this change and confirmed
the overlap is gone. This is the native transition acceptance result; settled
screenshots and unit tests alone were not used as proof.
Reference: https://reactnavigation.org/docs/handling-safe-area/

Fresh checks after the Home inset change: TypeScript, lint, web export and 458
app tests passed; 22 emulator-dependent tests skipped. The connected dev app was
reloaded through its dev menu and reached Home with the logo below the status
bar. This settled-layout observation does not verify the reported sign-in
transition. The subsequent user sign-out/sign-in retest passed: overlap is gone.
