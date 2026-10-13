# Restore purchases outcomes

## Behavior

Settings and the paywall use the same restore controller and messages.
Both active and inactive production users can restore; dev builds hide Restore.
Paywall restoration does not depend on loading purchase offerings successfully.

The RevenueCat wrapper retains CustomerInfo from the restore response. The flow
checks active Lastrep subscription products and the active Google Play Premium
entitlement. It supports bare subscription IDs and base-plan-qualified IDs.
An active product with missing Premium mapping is unconfirmed, not "no purchase".

After finding a purchase, the app listens for a matching server-backed Firestore
entitlement for at most 10 seconds. Cache-only data, pending writes, manual
grants, expired records and mismatched products do not confirm restored access.
The backend remains the access authority; this flow does not grant Premium.
An existing matching paid backend entitlement may confirm immediately.

## Exact feedback

| Outcome | Message |
| --- | --- |
| Loading | Checking purchases... |
| Store purchase and backend paid access confirmed | Purchases restored. Premium is active. |
| No active Lastrep subscription | No active subscription found. Make sure you're using the Google Play account you subscribed with. |
| Active subscription found, access not confirmed | An active subscription was found, but Lastrep hasn't confirmed Premium access yet. Please try again shortly. |
| Identity, store request or malformed response failure | Couldn't restore purchases. Check your connection and try again. |

A backend read failure or confirmation timeout after finding a purchase uses the
unconfirmed message, not the no-purchase message. Manual Premium is displayed
by the existing access UI but is not counted as a restored paid purchase.

## Lifecycle

- Duplicate taps are ignored while the request is in flight.
- Leaving the screen, unmounting or changing accounts cancels confirmation and
  suppresses late feedback. Firestore listeners and timers are cleaned up.
- Native RevenueCat requests cannot be aborted by the JS AbortSignal; it stops
  subsequent processing and UI updates, not an already-issued store operation.
- The 10-second limit applies to backend confirmation, not total SDK/network
  request duration. No message claims verification continues after timeout.
- Restore lifecycle analytics are retained. Only confirmed paid access logs
  restore_completed; other terminal outcomes have explicit result_status.

## Verification

Automated tests cover exact controller feedback for every outcome, SDK response
preservation, monthly/annual and base-plan matching, manual grants, duplicate
taps, cancelled/account-changed results, retry, server/cache distinctions,
confirmation timeout and subscription cleanup. These are mocked SDK/Firestore
tests, not proof of an actual Play Store transaction or rendered device layout.

Lint and TypeScript must pass before commit. No native dependency or backend
deployment change is needed. Do not build an AAB just for this batch; include
it in the next planned release.

On that release's Play-installed internal build, check Settings and paywall
with an active test subscription and an account without a purchase. Confirm
the corresponding exact messages, retry, and leaving during a request. Use
Google Play license testing rather than real payment methods. Previously
verified purchase activation and Settings back navigation are not reimplemented
by this change.

## Sources

- https://www.revenuecat.com/docs/getting-started/entitlements/android-products
- https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
