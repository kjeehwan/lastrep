# Startup navigation and appearance loading

## November 20, 2026 investigation

An offline v49 Android 14 sign-up check recorded one fatal JavaScript exception:
`Attempted to navigate before mounting the Root Layout component`.
It occurred during rapid system appearance/font changes. Individually spaced
changes and eight further v49 launch/display-change rounds did not reproduce it.
The trigger and root cause of that particular occurrence remain unconfirmed.

The retained production source map resolves the saved stack to Expo Router's
`useImperativeApiEmitter` → `routingQueue.run` → `getNavigateAction` →
`store.assertIsReady`. It establishes that a queued action reached a navigator
that was not ready; it does not identify the original action's caller.

Inspection found an independent startup invariant violation: `AppThemeProvider`,
above the root Stack, omitted its children until the first account-scoped
appearance read completed. Expo requires the root navigator to mount before
navigation events. See its [navigation-without-navigation guidance](https://docs.expo.dev/router/advanced/authentication-rewrites/#navigating-without-navigation).

## Change and architecture impact

The appearance provider now always renders its child tree. A stable flex wrapper
hides it visually and disables touches/accessibility while initial appearance is
pending; the existing loading indicator remains visible. When the read settles,
the same tree becomes visible with the resolved theme. Loading no longer removes
the root navigator. This is startup hardening, not proof that the one-off crash
has been reproduced and eliminated.

Screen/provider effects can now mount before the initial appearance read settles.
Appearance readiness is a presentation concern, not an authentication boundary:
existing auth subscriptions and UID checks still own account access. The theme
store's account keys, stale-read protection, write ordering, error fallback and
subsequent account-switch behavior are unchanged. Authentication destinations,
draft storage and backend contracts are unchanged. No data-collection, retention,
sharing or provider-transfer changes require policy/declaration updates.

## Validation

- A new component rendering regression test failed against the old provider
  because the navigator was absent while appearance was pending. Four cases now
  cover initial mounting/masking, saved light/dark presentation and the settled
  storage-error state. These are render tests, not a native lifecycle simulation.
- TypeScript and lint passed. Full ordinary suite: 979 passed, 100 emulator-dependent
  tests skipped. The first highly parallel run overlapped emulator/Metro startup
  and timed out in branding/backend tests; reduced parallelism passed without
  changing those tests or their timeouts.
- Expo web export passed for 47 static routes.
- Current code ran in the existing dev APK through fast-mode Metro
  (`--no-dev --minify`) on the disposable Android 14/API 34 emulator,
  1080×2436 at 420 dpi. Confirmed actual rendered Sign up, Sign in and Android
  Back; light/dark mode; font scale 1.3 with high contrast; and two cold starts
  reaching Sign up. Final crash buffer was empty. Early captures behind the
  first-run dev menu or before rendering completed were excluded.
- The emulator was offline before either QA package's first launch. No account
  sign-in, Google credential exchange or personal-record mutation was performed.

Native signed-in/account-switch flows, real phones, iOS, an updated standalone
production APK and production verification are not covered by these checks.
Existing theme-store tests cover account isolation and stale requests. The
tester-reported grey strip remains a separate, unreproduced rendering issue.

Raw logs, screenshots and local reproduction scripts remain ignored under
`.dev-tools/auth-device-qa/`. No production build or deployment is included.
