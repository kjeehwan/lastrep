# Authentication Notebook Native Migration

Merged in PR #40 as 502934d; the auth feature branch was deleted with user
authorization. The later onboarding migration is tracked separately in
`onboarding-notebook-migration.md`. Implementation/verification below records the
auth release scope on October 19.

Reviewed October 19, 2026. Branch: `feature/auth-notebook-ui`, based on Settings
PR #39. Scope is native Sign in / Sign up; onboarding remains legacy.
User authorized split commits, push and PR review. Merge, branch deletion,
deployment and AAB builds require separate authorization.

## Implementation

- Shared paper/dark form uses notebook typography, the existing flavor-aware
  logo, explicit labels, ink primary actions and Continue with Google.
- The entire form scrolls within a 540dp maximum width. Safe-area padding applies
  from first layout. Android bounds the viewport by the keyboard frame when
  edge-to-edge leaves the native window unresized, and disables fullscreen IME
  extraction. Focused inputs scroll minimally without animation. iOS uses
  KeyboardAvoidingView; native iOS behavior has not been verified.
- Password visibility uses an inset eye/eye-off icon with a 48dp target and
  Show password / Hide password accessibility labels. Reserved text padding
  prevents overlap; email/password borders have equal width.
- Email validation trims the email but preserves the password exactly. Existing
  accounts can sign in with short legacy passwords; sign-up retains the existing
  six-character minimum. Autofill roles and keyboard actions are supplied.
- A synchronous lock covers both providers through session finalization. Busy
  controls disable repeat submissions and account-form switching. Inline errors
  retain fields and avoid raw provider diagnostics or credential logging.
- Each explicit Google attempt clears the SDK's previous account selection before
  opening signIn. Cancellation stops before getTokens or Firebase credential
  exchange. Successful selection retains the established getTokens path.
- Shared dialogs/status icons recognize the auth routes. Auth dialogs reserve no
  nonexistent bottom-tab space. Browser reference and design rules match the
  inset visibility control.

## Preserved behavior and boundaries

Firebase email authentication, Google credential exchange, token storage, default
new-user document creation, legacy isSignedUp flag, decision-usage normalization
and existing account destinations remain. Both session-finalization bodies were
compared with the Settings baseline and are unchanged. Existing accounts return
Home; new accounts still enter `/onboarding/goal` until onboarding migration.
No existing goal or phase records are removed.

No password-reset service, new provider, backend deployment, health permission
request, native build or account-data migration is included. The next onboarding
migration must reconcile the approved optional nickname and removed goal/sample
screens with startup routing and account-scoped completion. Phase-start correction
remains postponed.

## Google configuration repair

The installed dev build returned DEVELOPER_ERROR before token retrieval. A
controlled comparison using the complete Settings-baseline handler failed too.
User subsequently verified production Google sign-in works and clarified that
their earlier remembered dev success may have been confusion with production.

With explicit authorization, the verified installed certificate was registered
for the dev Firebase app. Read-back confirmed the matching dev Android OAuth
entry; the production certificate list was unchanged. Only ignored local dev
OAuth configuration was refreshed, with originals backed up. User then verified
Google sign-in succeeds. No production registration was changed. Temporary
comparison handlers and stage/code instrumentation have been removed.

Concrete configuration IDs, certificate hashes, raw provider logs, account
values, screenshots, APKs and comparison backups remain ignored in local tooling.
They are excluded from this migration's commit candidates.

## Verification

Final release-preparation checks on October 19:

- TypeScript, lint, web export and diff whitespace checks passed.
- App suite: 467 passed, 22 emulator-dependent tests skipped; 84 passing test
  files and two skipped files. Eight auth tests cover validation, sanitized
  failures, Google cancellation, token behavior and selection-clear ordering/failure.
- Browser: 220 study layouts/flow checks passed with no overflow, exceptions or
  external requests. Forty additional auth layouts passed equal-edge, inset-icon
  and minimum-target geometry checks across sizes, themes and enlarged text.
- Fresh phone/Metro availability and current bundle were confirmed during native
  checks. Native layout checks covered both themes, 200% text, landscape keyboard
  visibility, local invalid-email feedback, retained synthetic fields and reachable
  actions. Final landscape behavior was visually inspected; earlier insufficient
  bounds-only captures are superseded. Display/orientation settings were restored.
- User approved appearance, real email sign-in, disposable-account sign-up into
  legacy onboarding, dev Google sign-in, eye toggling and equal field borders.
- User verified the Google chooser opens after sign-out. Pressing Back returns
  to Sign in with "Google sign-in was canceled." and remains signed out.

These checks do not establish screen-reader coverage, native iOS/other-device
behavior, production billing, or the separately deferred onboarding migration.
The user's real credential submissions were performed by the user.
