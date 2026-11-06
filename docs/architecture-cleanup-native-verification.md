# Architecture cleanup: native verification and billing deployment

Verified November 6, 2026, from clean `main` source `afaaf30`.
Related: [cleanup backlog](architecture-cleanup-backlog.md).

## Billing deployment

- Fresh `npm.cmd --prefix functions run build` passed.
- Deployed only `functions:revenuecatWebhook` to `lastrep-ebac5`, region
  `asia-northeast3`. No other functions, rules, hosting or data were deployed.
- Google Cloud reports successful update, ACTIVE, function version 23,
  update time `2026-11-06T03:04:21.846Z`.
- Live GET returned 405 `method_not_allowed`; unauthenticated empty POST returned
  401 `unauthorized`. These requests do not identify or update any account.
- Authenticated lifecycle behavior was covered by the seven disposable emulator
  regression tests recorded in PR #81. No real RevenueCat purchase, production
  entitlement mutation or production account deletion was performed during this
  deployment check. Guard responses alone are not proof of a real store purchase.

## Native environment and isolation

Android 16 emulator `emulator-5554`, package `com.kjeehwan.lastrep.dev`, current
JavaScript from Metro 8082. Verified `firebaseConfig.projectId` was exactly
`demo-lastrep-sharing` before creating fixtures or changing account state.
Reused the existing local Auth/Firestore services at 19100/18081.
Confirmed the current entitlement-store module was loaded in the native runtime.

Created two new local accounts, premium and free, with synthetic profile data.
No phone was connected or required. Native SDK operations seeded isolated fixtures;
ADB drove input/save/review actions and inspected the rendered Android UI.
A React control handler opened one body-entry form during automation recovery.
Account transitions used the Firebase SDK in the running app, not a real Google
sign-in or Play purchase.

## Results

| Path | Evidence and result |
| --- | --- |
| Account access | Profile displayed Premium for the premium fixture. Direct sign-in to the free fixture produced native billing diagnostics `loading` then `inactive` and Profile displayed Free. No active entitlement was emitted for the free owner. |
| Sign-out | Returned to the native sign-in screen. Signing into the fixture again did not carry premium state. |
| Body composition | Entered and saved a partial weight entry, then weight/body-fat entry. Firestore retained both. A later successful retry added a third entry; earlier records remained. |
| Connection failure | Temporarily removed only the emulator's Firestore reverse port. Saving displayed "Couldn't save. Check your connection and try again." The form retained `81.2`. Restoring forwarding and tapping Save data saved successfully and closed the form. |
| Today's Plan context | Actual native loader returned sleep 8 hours, calorie target 2,800 and recovery 2/3/8 from the seeded profile. Journal summary took precedence over the legacy 2-hour sleep value. |
| Today's Plan review | Resumed the synthetic three-set bench draft through the native picker. Review opened with "Train as planned" and one unchanged exercise; Review context displayed the saved recovery ratings and Strength/Maintain phases. No comparable history was fabricated. |

An initial attempt to use Firestore SDK `disableNetwork` did not block the
transaction RPC and therefore did not count as a failed-connection test. The
port-removal test above established the actual failure/retry behavior. Connection
settings were restored afterward.

## Cleanup and release boundary

- Restored the emulator's original demo session and confirmed its UID matched the
  captured original user. Restored the temporary console observer.
- Restored Firestore networking and `tcp:18081` forwarding; other reverse ports
  and existing Metro/Firebase services were left running.
- Removed only the two task-created local accounts, their account documents and
  account-scoped local caches. Existing demo accounts/drafts were preserved.
- No application source behavior changed during these checks. No health-service
  permissions, personal records or real purchases were changed.
- The billing fix is deployed. Client fixes remain in source/dev until a future
  app build is distributed. No AAB was built, and real Play purchase/restore was
  outside this verification scope.
